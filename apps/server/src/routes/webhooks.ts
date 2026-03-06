import { randomUUID } from "node:crypto";
import { logger } from "@sellsnap/logger";
import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { sendEmail } from "../lib/email";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";

export async function webhookRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/webhooks/stripe", async (request, reply) => {
    const sig = request.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event;

    try {
      const rawBody = request.body as string;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      logger.error("Webhook signature verification failed:", err);
      return reply.status(400).send({ error: "Webhook signature verification failed" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const productId = session.metadata?.productId;
      const customerEmail = session.customer_email;

      if (!productId || !customerEmail) {
        logger.error("Missing metadata in webhook event");
        return reply.status(400).send({ error: "Missing metadata" });
      }

      const downloadToken = randomUUID();
      const downloadExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        logger.error(`Product not found: ${productId}`);
        return reply.status(400).send({ error: "Product not found" });
      }

      const existingPurchase = await prisma.purchase.findFirst({
        where: { stripeSessionId: session.id },
      });
      if (existingPurchase) {
        logger.warn(`Duplicate webhook event for session ${session.id}, skipping`);
        return reply.status(200).send({ received: true });
      }

      await prisma.purchase.create({
        data: {
          productId,
          customerEmail,
          customerName: session.customer_details?.name || null,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? ""),
          stripeSessionId: session.id as string,
          amount: session.amount_total || 0,
          status: "completed",
          downloadToken,
          downloadExpiresAt,
        },
      });

      const apiUrl = process.env.API_URL || process.env.FRONTEND_URL || "http://localhost:3000";
      const downloadLink = `${apiUrl}/api/download/${downloadToken}`;
      const emailContent = `Thank you for your purchase!

Product: ${product.title}
Download Link: ${downloadLink}
This link will expire in 24 hours.

If you have any questions, please contact the seller.`;

      await sendEmail(
        customerEmail,
        `Thank you for your purchase - ${product.title}`,
        emailContent,
      );

      logger.success(`Purchase completed for product ${productId}, email: ${customerEmail}`);
    }

    return reply.status(200).send({ received: true });
  });
}
