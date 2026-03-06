import { logger } from "@sellsnap/logger";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  logger.warn("STRIPE_SECRET_KEY is not set — Stripe payments will not work");
}

export const stripe = new Stripe(stripeSecretKey || "sk_not_configured");
