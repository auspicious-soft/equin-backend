import { configDotenv } from 'dotenv';
import Stripe from 'stripe';
configDotenv()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {apiVersion: '2025-03-31.basil'});

export default stripe
