import mongoose, { Document } from "mongoose";

export interface UserPlanDocument extends Document {
  userId?: mongoose.Types.ObjectId | null;
  deviceId?: string;
  planId: mongoose.Types.ObjectId;
  stripeProductId: string;
  autoPayment: boolean;
  paymentStatus:
    | "pending"
    | "success"
    | "failed"
    | "cancelled"
    | "expired"
    | "initiated";
  startDate: Date | null;
  endDate: Date | null;
  transactionId?: string | null;
  paymentMethod?: string | null;
  currency: any;
  interval: any;
  intervalCount: any;
}

const userPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    deviceId: {
      type: String,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "pricePlan",
      required: true,
    },
    stripeProductId: {
      type: String,
    },
    autoPayment: {
      type: Boolean,
      default: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "success",
        "failed",
        "cancelled",
        "expired",
        "initiated",
      ],
      default: "pending",
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    currency :{
      type: String,
      default: null
    },
    interval :{},
    intervalCount :{},
    paymentMethod: {},
  },
  { timestamps: true }
);

export const userPlanModel = mongoose.model<UserPlanDocument>(
  "userPlan",
  userPlanSchema
);
