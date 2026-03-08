import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";

const checkoutBodySchema = z.object({
  customerEmail: z.string().email().optional(),
});

export async function checkoutRoutes(server: FastifyInstance): Promise<void> {
  server.post(
    "/api/checkout/:productSlug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { productSlug } = request.params as { productSlug: string };

      let customerEmail: string | undefined;
      const parsed = checkoutBodySchema.safeParse(request.body);
      if (parsed.success) {
        customerEmail = parsed.data.customerEmail;
      }

      const product = await prisma.product.findUnique({
        where: { slug: productSlug, published: true },
      });

      if (!product) {
        return reply.status(404).send({ error: "Product not found" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.title,
                description: product.description || undefined,
              },
              unit_amount: product.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/p/${product.slug}`,
        customer_email: customerEmail,
        metadata: {
          productId: product.id,
        },
      });

      return { url: session.url };
    },
  );
}
