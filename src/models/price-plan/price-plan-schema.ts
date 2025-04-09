import mongoose, { Document } from "mongoose";

export interface PricePlanDocument extends Document {
  type: string;
  months: number;
  price: number;
  priceText: string;
  deviceId?: string;
  description?: string;
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
    deviceId: {
      type: String,
    },
    description: {
      type: String, 
    }
  },
  { timestamps: true }
);

export const pricePlanModel = mongoose.model<PricePlanDocument>(
  "pricePlan",
  pricePlanSchema
);
