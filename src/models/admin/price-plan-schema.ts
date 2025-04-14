import mongoose, { Document } from "mongoose";

export interface PricePlanDocument extends Document {
  type: string;
  months: number;
  price: number;
  priceText: string;
  description?: string;
  perks: {
    fastingTimer: string;
    fastingStages: string;
    customFastingGoal: string;
    nutritionScoring: string;
    advancedAnalysis: string;
    learningCenter: string;
  };
}

const pricePlanSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    months: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    priceText: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    perks: {
      fastingTimer: {
        type: String,
        enum: ["Yes", "Limited", "No"],
        default: "Yes",
      },
      fastingStages: {
        type: String,
        enum: ["Yes", "Limited", "No"],
      },
      customFastingGoal: {
        type: String,
        enum: ["Yes", "Limited", "No"],
      },
      nutritionScoring: {
        type: String,
        enum: ["Yes", "Limited", "No"],
      },
      advancedAnalysis: {
        type: String,
        enum: ["Yes", "Limited", "No"],
      },
      learningCenter: {
        type: String,
        enum: ["Yes", "Limited", "No"],
      },
    },
  },
  { timestamps: true }
);

export const pricePlanModel = mongoose.model<PricePlanDocument>(
  "pricePlan",
  pricePlanSchema
);
