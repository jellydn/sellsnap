import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe;
if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY not set, Stripe will not work");
} else {
  stripe = new Stripe(stripeSecretKey);
}

export { stripe };
