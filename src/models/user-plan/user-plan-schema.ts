import mongoose, { Document } from "mongoose";

export interface UserPlanDocument extends Document {
  userId?: mongoose.Types.ObjectId | null;
  deviceId?: string;
  planId: mongoose.Types.ObjectId;
  paymentStatus: "pending" | "success" | "failed";
  startDate: Date | null;
  endDate: Date | null;
  transactionId?: string | null;
  paymentMethod?: string | null;
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
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
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
    paymentMethod: {
      type: String, // e.g., "card", "upi", "paypal"
      default: null,
    },
  },
  { timestamps: true }
);

export const userPlanModel = mongoose.model<UserPlanDocument>(
  "userPlan",
  userPlanSchema
);
