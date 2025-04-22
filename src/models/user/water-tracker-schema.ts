import mongoose, { Document } from "mongoose";

export interface WaterTrackerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  waterIntake?: number;
}

const waterTrackerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    waterIntake: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export const waterTrackerModel = mongoose.model<WaterTrackerDocument>(
  "waterTracker",
  waterTrackerSchema
);
