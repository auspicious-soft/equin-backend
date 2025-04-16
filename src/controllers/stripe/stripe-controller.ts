import { Request, Response } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorParser } from "src/lib/errors/error-response-handler";
import stripe from "src/config/stripe";
import { pricePlanModel } from "src/models/admin/price-plan-schema";

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

    const product = await pricePlanModel.findOne({ productId });

    if (!product) {
      return res.status(httpStatusCode.NOT_FOUND).json({
        success: false,
        message: "Product not found",
      });
    }

    // Create a customer (optional, good for future)
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: userData._id,
        email,
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${product.type} - ${product.months} months - ${product.priceText}`,
            },
            unit_amount: product.price!, // in paise (e.g. ₹199.00 => 19900)
          },
          quantity: 1,
        },
      ],
      success_url: `https://api.fastingvibe.com/success-test?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://api.fastingvibe.com/cancel-test`,
      metadata: {
        userId: userData._id,
        productId,
      },
    });

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Checkout session created",
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
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
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

    if (!sig || !endpointSecret) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Stripe signature or endpoint secret missing",
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );
    } catch (err: any) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: `Webhook Error: ${err.message}`,
      });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        
        // Extract metadata from the session
        const { userId, productId } = session.metadata;
        
        // Update user's subscription status in your database
        await pricePlanModel.findOneAndUpdate(
          { productId },
          {
            $push: {
              subscribers: {
                userId,
                status: 'active',
                paymentId: session.payment_intent,
                startDate: new Date(),
                endDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
              }
            }
          }
        );

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        // Handle successful payment
        // You might want to update payment status in your database
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        // Handle failed payment
        console.log('Payment failed:', paymentIntent.id);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        // Handle subscription updates
        console.log('Subscription updated:', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        // Handle subscription cancellation
        console.log('Subscription cancelled:', subscription.id);
        break;
      }

      // Add more event types as needed

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "Webhook handled successfully",
    });

  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res
      .status(code || httpStatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: message || "An error occurred" });
  }

}

