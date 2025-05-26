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

    const stripeProduct = await stripe.products.retrieve(productId);

    if (!stripeProduct.default_price) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "No price found for this product.",
      });
    }

    const priceDetails = await stripe.prices.retrieve(
      stripeProduct.default_price as string
    );

    if (!priceDetails.unit_amount || !priceDetails.currency) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Price details are incomplete.",
      });
    }

    // Find or create Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = await stripe.customers.update(existingCustomers.data[0].id, {
        metadata: {
          userId: userData.id,
        },
      });
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: {
          userId: userData.id,
        },
      });
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceDetails.unit_amount,
      currency: priceDetails.currency,
      customer: customer.id,
      metadata: {
        userId: userData.id,
        productId,
        priceId: priceDetails.id,
      },
      automatic_payment_methods: {
        enabled: true, // Enables Apple Pay, Google Pay, etc.
      },
    });

    return res.status(httpStatusCode.OK).json({
      success: true,
      message: "PaymentIntent created successfully",
      data: {
        clientSecret: paymentIntent.client_secret,
        productDetails: {
          name: stripeProduct.name,
          description: stripeProduct.description,
          currency: priceDetails.currency,
          unitAmount: priceDetails.unit_amount,
          type: priceDetails.type,
        },
      },
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
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

    if (!sig || !endpointSecret) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: "Stripe signature or endpoint secret missing",
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      return res.status(httpStatusCode.BAD_REQUEST).json({
        success: false,
        message: `Webhook Error: ${err.message}`,
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const { userId, productId } = session.metadata;

        const existingPlan = await userPlanModel.findOne({
          userId,
          stripeProductId: productId,
        });

        if (existingPlan?.paymentStatus !== "pending") {
          console.log("checkout.session.completed skipped: already processed");
          break;
        }

        const product = await stripe.products.retrieve(productId);
        const priceDetails = await stripe.prices.retrieve(
          product.default_price as string
        );

        let endDate = new Date();
        if (priceDetails.recurring) {
          const intervalCount = priceDetails.recurring.interval_count || 1;
          switch (priceDetails.recurring.interval) {
            case "day":
              endDate.setDate(endDate.getDate() + intervalCount);
              break;
            case "week":
              endDate.setDate(endDate.getDate() + intervalCount * 7);
              break;
            case "month":
              endDate.setMonth(endDate.getMonth() + intervalCount);
              break;
            case "year":
              endDate.setFullYear(endDate.getFullYear() + intervalCount);
              break;
          }
        } else {
          endDate.setDate(endDate.getDate() + 30);
        }

        await userPlanModel.findOneAndUpdate(
          {
            userId,
            stripeProductId: productId,
            paymentStatus: "pending",
          },
          {
            $set: {
              paymentStatus: "success",
              startDate: new Date(),
              endDate: endDate,
              transactionId: session.payment_intent || session.subscription,
              paymentMethod: "card",
            },
          },
          { upsert: true, new: true }
        );
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const subscription = invoice.subscription;

        if (subscription) {
          const subscriptionDetails = await stripe.subscriptions.retrieve(
            subscription
          );
          const metadata = subscriptionDetails.metadata;

          if (metadata?.userId && metadata?.productId) {
            const existingPlan = await userPlanModel.findOne({
              userId: metadata.userId,
              stripeProductId: metadata.productId,
            });

            if (existingPlan?.paymentStatus !== "pending") {
              console.log("invoice.paid skipped: already processed");
              break;
            }

            await userPlanModel.findOneAndUpdate(
              {
                userId: metadata.userId,
                stripeProductId: metadata.productId,
                paymentStatus: "pending",
              },
              {
                $set: {
                  paymentStatus: "success",
                  endDate: new Date(
                    subscriptionDetails.current_period_end * 1000
                  ),
                  transactionId: invoice.payment_intent,
                  paymentMethod: invoice.payment_method_types?.[0] || "card",
                },
              }
            );
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as any;
        const metadata = paymentIntent.metadata;

        if (metadata?.userId && metadata?.productId) {
          const existingPlan = await userPlanModel.findOne({
            userId: metadata.userId,
            stripeProductId: metadata.productId,
          });

          if (existingPlan?.paymentStatus !== "pending") {
            console.log("payment_intent.succeeded skipped: already processed");
            break;
          }

          await userPlanModel.findOneAndUpdate(
            {
              userId: metadata.userId,
              stripeProductId: metadata.productId,
              paymentStatus: "pending",
            },
            {
              $set: {
                paymentStatus: "success",
                startDate: new Date(),
                transactionId: paymentIntent.id,
                paymentMethod:
                  paymentIntent.payment_method_types?.[0] || "card",
              },
            }
          );
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as any;
        const metadata = paymentIntent.metadata;

        if (metadata.userId && metadata.productId) {
          await userPlanModel.findOneAndUpdate(
            {
              userId: metadata.userId,
              stripeProductId: metadata.productId,
              paymentStatus: "pending",
            },
            {
              $set: {
                paymentStatus: "failed",
                transactionId: paymentIntent.id,
              },
            }
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const metadata = subscription.metadata;

        if (metadata.userId && metadata.productId) {
          const status =
            subscription.status === "active" ? "success" : "failed";

          await userPlanModel.findOneAndUpdate(
            {
              userId: metadata.userId,
              stripeProductId: metadata.productId,
            },
            {
              $set: {
                paymentStatus: status,
                endDate: new Date(subscription.current_period_end * 1000),
              },
            }
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const metadata = subscription.metadata;

        if (metadata.userId && metadata.productId) {
          // Don't delete the record, just mark it as expired
          await userPlanModel.findOneAndUpdate(
            {
              userId: metadata.userId,
              stripeProductId: metadata.productId,
              paymentStatus: "success",
            },
            {
              $set: {
                paymentStatus: "expired",
                endDate: new Date(), // Set end date to now
              },
            }
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscription = invoice.subscription;

        if (subscription) {
          const subscriptionDetails = await stripe.subscriptions.retrieve(
            subscription
          );
          const metadata = subscriptionDetails.metadata;

          if (metadata.userId && metadata.productId) {
            await userPlanModel.findOneAndUpdate(
              {
                userId: metadata.userId,
                stripeProductId: metadata.productId,
              },
              {
                $set: {
                  paymentStatus: "success",
                  endDate: new Date(
                    subscriptionDetails.current_period_end * 1000
                  ),
                },
              }
            );
          }
        }
        break;
      }

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
