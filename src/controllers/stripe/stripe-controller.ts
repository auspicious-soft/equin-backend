import { Request, Response } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorParser } from "src/lib/errors/error-response-handler";
import stripe from "src/config/stripe";
import { pricePlanModel } from "src/models/admin/price-plan-schema";
import { userPlanModel } from "src/models/user-plan/user-plan-schema";
import { Client } from "twilio/lib/base/BaseTwilio";


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

    // Log incoming webhook data for debugging
    console.log("Webhook received:", {
      headers: req.headers,
      body:
        typeof req.body === "string"
          ? "(raw body)"
          : JSON.stringify(req.body).substring(0, 100) + "...",
    });

    if (!sig || !endpointSecret) {
      console.error("Missing signature or endpoint secret");
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Stripe signature or endpoint secret missing",
      });
    }

    let event;

    try {
      // For webhooks, req.body should be raw, not parsed JSON
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log("Webhook event constructed:", event.type);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: `Webhook Error: ${err.message}`,
      });
    }

    // Log the event type and data for debugging
    console.log(`Processing webhook event: ${event.type}`);
    console.log(
      "Event data:",
      JSON.stringify(event.data.object).substring(0, 200) + "..."
    );

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as any;
        console.log("Payment intent succeeded:", paymentIntent.id);
        console.log("Metadata:", paymentIntent.metadata);

        // Make sure we have the required metadata
        if (
          !paymentIntent.metadata ||
          !paymentIntent.metadata.userId ||
          !paymentIntent.metadata.productId
        ) {
          console.error("Missing required metadata in payment intent");
          break;
        }

        const { userId, productId, priceId } = paymentIntent.metadata;

        // Find the pending user plan
        const existingPlan = await userPlanModel.findOne({
          userId,
          stripeProductId: productId,
          paymentStatus: "pending",
        });

        if (!existingPlan) {
          console.log(
            `No pending plan found for user ${userId} and product ${productId}`
          );

          // Create a new plan if none exists
          try {
            // Get product details if we have a product ID
            const product = await stripe.products.retrieve(productId);
            const price = priceId
              ? await stripe.prices.retrieve(priceId)
              : product.default_price
              ? await stripe.prices.retrieve(product.default_price as string)
              : null;

            if (!price) {
              console.error("No price found for product", productId);
              break;
            }

            // Calculate end date based on interval using UTC dates
            const startDate = getTodayUTC();
            const endDate = new Date(startDate);
            
            if (price.recurring?.interval === "month") {
              endDate.setUTCMonth(
                endDate.getUTCMonth() + (price.recurring.interval_count || 1)
              );
            } else if (price.recurring?.interval === "year") {
              endDate.setUTCFullYear(
                endDate.getUTCFullYear() + (price.recurring.interval_count || 1)
              );
            } else {
              // Default to 1 month if interval is not specified
              endDate.setUTCMonth(endDate.getUTCMonth() + 1);
            }

            // Get planId from productId
            const planId = await getPlanIdFromProductId(productId);
            if (!planId) {
              console.error(`No planId found for productId ${productId}`);
              break;
            }

            // Create new user plan
            await userPlanModel.create({
              userId,
              stripeProductId: productId,
              stripePriceId: price.id,
              planId: planId, // Ensure planId is set
              planName: product.name,
              price: price.unit_amount,
              currency: price.currency,
              interval: price.recurring?.interval,
              intervalCount: price.recurring?.interval_count,
              paymentStatus: "success",
              startDate: startDate,
              endDate,
              transactionId: paymentIntent.id,
              paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
            });

            console.log(
              `Created new plan for user ${userId} and product ${productId}`
            );
          } catch (err) {
            console.error("Error creating new plan:", err);
          }
          break;
        }

        // Get product and price details to calculate end date
        const product = await stripe.products.retrieve(productId);
        const price = priceId
          ? await stripe.prices.retrieve(priceId)
          : product.default_price
          ? await stripe.prices.retrieve(product.default_price as string)
          : null;

        // Calculate end date based on price recurring info
        const startDate = new Date();
        const endDate = new Date();
        if (price && price.recurring) {
          const { interval, interval_count } = price.recurring;
          if (interval === "day")
            endDate.setDate(endDate.getDate() + (interval_count || 1));
          else if (interval === "week")
            endDate.setDate(endDate.getDate() + (interval_count || 1) * 7);
          else if (interval === "month")
            endDate.setMonth(endDate.getMonth() + (interval_count || 1));
          else if (interval === "year")
            endDate.setFullYear(endDate.getFullYear() + (interval_count || 1));
        } else {
          // Default to 30 days for one-time payments
          endDate.setDate(endDate.getDate() + 30);
        }

        // Update the existing plan with end date and payment details
        await userPlanModel.findByIdAndUpdate(existingPlan._id, {
          $set: {
            paymentStatus: "success",
            transactionId: paymentIntent.id,
            paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
            startDate: startDate,
            endDate: endDate,
          },
        });

        console.log(
          `Updated plan for user ${userId} and product ${productId} to success`
        );
        break;
      }

      // Add other event handlers as needed

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Webhook handled successfully",
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
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
    throw new Error(JSON.stringify({
      success: false,
      message: "Price plan not found for the given product ID",
      code: httpStatusCode.NOT_FOUND
    }));
  }
  return pricePlan._id;
};

// Helper function to get today's date in UTC
const getTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
