import { Request, Response } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorParser } from "src/lib/errors/error-response-handler";
import stripe from "src/config/stripe";
import { pricePlanModel } from "src/models/admin/price-plan-schema";
import { userPlanModel } from "src/models/user-plan/user-plan-schema";
import { Client } from "twilio/lib/base/BaseTwilio";
import { Stripe } from "stripe";
import mongoose from "mongoose";

//********************Test Controllers*******************/
export const stripeSuccess = async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id as string;

    if (!sessionId) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Missing session_id in query.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Payment successful.",
      data: {
        sessionId: session.id,
        customerEmail: session.customer_details?.email,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
    });
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const stripeCancel = async (req: Request, res: Response) => {
  try {
    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Payment was cancelled by the user.",
    });
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

//********************Test Controllers*******************/

export const checkoutSession = async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;
    const userData = req.user as any;
    const { email } = userData;

    if (!productId) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Product ID is required.",
      });
    }

    console.log(`Creating checkout for product: ${productId}`);
    const stripeProduct = await stripe.products.retrieve(productId);
    console.log(`Retrieved product: ${stripeProduct.name}`);

    if (!stripeProduct.default_price) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "No price found for this product.",
      });
    }

    const priceDetails = await stripe.prices.retrieve(
      stripeProduct.default_price as string
    );
    console.log(
      `Retrieved price: ${priceDetails.id}, ${priceDetails.unit_amount} ${priceDetails.currency}`
    );

    // Find or create Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log(`Using existing customer: ${customer.id}`);
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: {
          userId: userData.id,
        },
      });
      console.log(`Created new customer: ${customer.id}`);
    }

    // Create a PaymentIntent for mobile clients
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceDetails.unit_amount ?? 0,
      currency: priceDetails.currency,
      customer: customer.id,
      setup_future_usage: "off_session",
      metadata: {
        userId: userData.id,
        productId: productId, // Explicitly use the productId from request
        priceId: priceDetails.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    console.log(`Created payment intent: ${paymentIntent.id}`);

    // Create a record in your database
    const userPlan = await userPlanModel.create({
      userId: userData.id,
      stripeProductId: productId, // Explicitly use the productId from request
      stripePriceId: priceDetails.id,
      planName: stripeProduct.name,
      price: priceDetails.unit_amount,
      currency: priceDetails.currency,
      interval: priceDetails.recurring?.interval,
      intervalCount: priceDetails.recurring?.interval_count,
      paymentStatus: "pending",
      startDate: getTodayUTC(), // Use UTC date instead of local date
      transactionId: paymentIntent.id,
      planId: await getPlanIdFromProductId(productId), // Add planId field
    });
    console.log(`Created user plan record: ${userPlan._id}`);

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "PaymentIntent created successfully",
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customer: customer.id,
        productDetails: {
          id: productId, // Include the product ID in the response
          name: stripeProduct.name,
          description: stripeProduct.description,
          currency: priceDetails.currency,
          unitAmount: priceDetails.unit_amount,
          type: priceDetails.type,
          interval: priceDetails.recurring?.interval,
        },
      },
    });
  } catch (error: any) {
    console.error("Checkout session error:", error);
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const getStripeProducts = async (req: Request, res: Response) => {
  try {
    const products = await stripe.products.list({ limit: 100 });

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Stripe products fetched successfully",
      data: products.data,
    });
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res.status(code || httpStatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message || "An error occurred while fetching Stripe products",
    });
  }
};

export const updateProductPrice = async (req: Request, res: Response) => {
  try {
    const { productId, newPrice, priceText } = req.body;

    if (!productId || !newPrice) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Product ID and new price are required.",
      });
    }

    // Step 1: Find your price plan from DB
    const pricePlan = await pricePlanModel.findOne({ productId });
    if (!pricePlan) {
      return res.status(httpStatusCode.NOT_FOUND).json({
        success: false,
        message: "Price plan not found",
      });
    }

    // Step 2: Fetch current default price from Stripe
    const product = await stripe.products.retrieve(productId);

    if (!product.default_price || typeof product.default_price !== "string") {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "No valid default price found for the product in Stripe.",
      });
    }

    const existingPrice = await stripe.prices.retrieve(product.default_price);

    // Step 3: Create a new recurring price with updated amount
    const newStripePrice = await stripe.prices.create({
      currency: existingPrice.currency || "usd",
      unit_amount: Math.round(newPrice * 100), // Ensure cents
      product: productId,
      recurring: existingPrice.recurring
        ? {
            interval: existingPrice.recurring.interval,
            interval_count: existingPrice.recurring.interval_count,
          }
        : {
            interval: "month",
            interval_count: 1,
          },
    });

    // Step 4: Update the product to set new default price
    const updatedStripeProduct = await stripe.products.update(productId, {
      default_price: newStripePrice.id,
    });

    // Step 5: Update in your local DB
    const updatedPricePlan = await pricePlanModel.findOneAndUpdate(
      { productId },
      {
        price: newStripePrice.unit_amount,
        priceText: priceText || `$${(newStripePrice.unit_amount ?? 0) / 100}`,
      },
      { new: true }
    );

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Product price updated successfully",
      data: {
        pricePlan: updatedPricePlan,
        stripeProduct: updatedStripeProduct,
        newStripePrice,
      },
    });
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

    // Validate signature and secret
    if (!sig || !endpointSecret) {
      console.error("Missing signature or endpoint secret");
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Stripe signature or endpoint secret missing",
      });
    }

    // Construct webhook event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`Webhook event constructed: ${event.type}`);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: `Webhook Error: ${err.message}`,
      });
    }

    // Handle payment_intent.succeeded event
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment intent succeeded: ${paymentIntent.id}`);

      const { userId, productId, priceId } = paymentIntent.metadata || {};
      if (!userId || !productId) {
        console.error("Missing userId or productId in payment intent metadata");
        return res.status(httpStatusCode.BAD_REQUEST).json({
          success: false,
          message: "Missing required metadata",
        });
      }

      // Start a MongoDB session for transaction
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Check if payment intent has already been processed
          const existingProcessedPlan = await userPlanModel
            .findOne({
              transactionId: paymentIntent.id,
              paymentStatus: "success",
            })
            .session(session);

          if (existingProcessedPlan) {
            console.log(`Payment intent ${paymentIntent.id} already processed for user ${userId}`);
            return;
          }

          // Find pending plan
          let existingPlan = await userPlanModel
            .findOne({
              userId,
              stripeProductId: productId,
              paymentStatus: "pending",
            })
            .session(session);

          // Fetch product and price details
          const product = await stripe.products.retrieve(productId);
          const price = priceId
            ? await stripe.prices.retrieve(priceId)
            : product.default_price
            ? await stripe.prices.retrieve(product.default_price as string)
            : null;

          if (!price) {
            console.error(`No price found for product ${productId}`);
            throw new Error("Price not found");
          }

          // Calculate dates in UTC
          const startDate = getTodayUTC();
          const endDate = addUTCInterval(
            startDate,
            price.recurring?.interval || "day",
            price.recurring?.interval_count || 30
          );

          if (existingPlan) {
            // Update existing plan
            await userPlanModel
              .findByIdAndUpdate(
                existingPlan._id,
                {
                  $set: {
                    paymentStatus: "success",
                    transactionId: paymentIntent.id,
                    paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
                    startDate,
                    endDate,
                    currency: price.currency,
                    interval: price.recurring?.interval,
                    intervalCount: price.recurring?.interval_count,
                  },
                },
                { session }
              );

            console.log(`Updated plan for user ${userId} and product ${productId}`);
          } else {
            // Create new plan
            const planId = await getPlanIdFromProductId(productId);
            if (!planId) {
              console.error(`No planId found for productId ${productId}`);
              throw new Error("Plan ID not found");
            }

            // Ensure no other active plan exists for the user
            const activePlan = await userPlanModel
              .findOne({
                userId,
                paymentStatus: "success",
                endDate: { $gte: startDate },
              })
              .session(session);

            if (activePlan) {
              console.warn(`Active plan already exists for user ${userId}, skipping plan creation`);
              return;
            }

            await userPlanModel.create(
              [
                {
                  userId,
                  planId,
                  stripeProductId: productId,
                  paymentStatus: "success",
                  transactionId: paymentIntent.id,
                  paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
                  startDate,
                  endDate,
                  currency: price.currency,
                  interval: price.recurring?.interval,
                  intervalCount: price.recurring?.interval_count,
                },
              ],
              { session }
            );

            console.log(`Created new plan for user ${userId} and product ${productId}`);
          }
        });
      } finally {
        session.endSession();
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Webhook handled successfully",
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    const { code, message } = errorParser(error);
    return res.status(code || httpStatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message || "An error occurred",
    });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userData = req.user as any;

    // Check if the user has a subscription
    const userPlan = await userPlanModel.findOne({
      userId: userData.id,
      endDate: { $gte: new Date() },
      paymentStatus: "success",
    });

    if (!userPlan) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "No active subscription found for this user.",
      });
    }

    // Retrieve the Stripe subscription ID from the userPlan model (it might be stored in `transactionId`)
    const subscriptionId = userPlan.transactionId;

    if (!subscriptionId) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "No subscription ID found for this user.",
      });
    }

    // Cancel the subscription in Stripe
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true, // Cancel at the end of the current billing period
    });

    // Update the user's plan status in MongoDB to 'cancelled'
    await userPlanModel.findOneAndUpdate(
      { _id: userPlan._id },
      {
        $set: {
          paymentStatus: "cancelled", // Or "expired" based on your logic
        },
      }
    );

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Subscription cancelled successfully.",
    });
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }
};

// Helper function to get planId from productId
const getPlanIdFromProductId = async (productId: string) => {
  const pricePlan = await pricePlanModel.findOne({ productId });
  if (!pricePlan) {
    throw new Error(
      JSON.stringify({
        success: false,
        message: "Price plan not found for the given product ID",
        code: httpStatusCode.NOT_FOUND,
      })
    );
  }
  return pricePlan._id;
};

// Helper function to get today's date in UTC
const getTodayUTC = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

export function getUTCDate(date: Date): Date {
  // Creates a new UTC date at midnight based on the input date
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
  return utcDate;
}

export function addUTCInterval(date: Date, interval: string, count: number): Date {
  // Adds a time interval (day, week, month, year) to a UTC date
  const result = new Date(date);
  switch (interval) {
    case "day":
      result.setUTCDate(result.getUTCDate() + count);
      break;
    case "week":
      result.setUTCDate(result.getUTCDate() + count * 7);
      break;
    case "month":
      result.setUTCMonth(result.getUTCMonth() + count);
      break;
    case "year":
      result.setUTCFullYear(result.getUTCFullYear() + count);
      break;
    default:
      // Default to 30 days for one-time payments
      result.setUTCDate(result.getUTCDate() + 30);
  }
  return result;
}
