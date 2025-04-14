import mongoose, { Document } from "mongoose";

export interface HealthDataDocument extends Document {
  userId: mongoose.Types.ObjectId;
  waterIntakeGoal: {
    containerType: string;
    unit: string;
    containerSize: number;
    dailyGoal: number;
    waterReminder: boolean;
  };
}

const healthDataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    waterIntakeGoal: {
      containerType: {
        type: String,
        enum: ["bottle", "cup", "glass"],
        default: "glass",
      },
      unit: {
        type: String,
        enum: ["ml", "oz"],
        default: "ml",
      },
      containerSize: {
        type: Number,
        default: 250,
      },
      dailyGoal: {
        type: Number,
        default: 3600,
      },
      waterReminder: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

export const healthDataModel = mongoose.model<HealthDataDocument>(
  "healthData",
  healthDataSchema
);
