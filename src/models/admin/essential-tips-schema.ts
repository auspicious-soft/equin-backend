import mongoose, { Document } from "mongoose";

export interface EssentialTipDocument extends Document {
  title: string;
  description: string;
  image?: string;
  isActive: boolean;
  publishDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const essentialTipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    publishDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const essentialTipModel = mongoose.model<EssentialTipDocument>(
  "essentialTips",
  essentialTipSchema
);