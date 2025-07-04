import { configDotenv } from 'dotenv';
import Stripe from 'stripe';
configDotenv()

const apiVersion : any = '2025-03-31.basil';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {apiVersion});

export default stripe
