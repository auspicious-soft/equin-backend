import mongoose, { Document } from "mongoose";

export interface HealthDataDocument extends Document {
  userId: mongoose.Types.ObjectId;
  waterIntakeGoal: {
    containerType: string;
    unit: string;
    containerSize: number;
    dailyGoal: number;
  };
  otherDetails: any;
  deviceId: string;
  notification: boolean;
  mealReminder: boolean;
  appleHealth: boolean;
  waterReminder: boolean;
  Language: string;
}

const healthDataSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
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
        default: 0,
      },
      dailyGoal: {
        type: Number,
        default: 0,
      },
    },
    mealReminder: {
      type: Boolean,
      default: true,
    },
    appleHealth:{
      type: Boolean,
      default: false,
    },
    waterReminder: {
      type: Boolean,
      default: true,
    },
    otherDetails: {
      type: Object,
    },
    notification: {
      type: Boolean,
      default: true,
    },
    fastingMethod:{
      type: String,
      enum: ["16:8", "5:2"],
      default: "16:8",
    },
    Language: {
      type: String,
      default: "english",
    }
  },
  { timestamps: true }
);

export const healthDataModel = mongoose.model<HealthDataDocument>(
  "healthData",
  healthDataSchema
);
