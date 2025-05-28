import mongoose, { Document } from "mongoose";

export interface TrackUserMealDocument extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId | null;
  firstMealStatus: any;
  secondMealStatus: any;
  thirdMealStatus: any;
  otherMealStatus: any;
  planDay: Date;
  microNutrients: any;
}

const trackUserMealSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MealPlan30Days",
      default: null,
    },
    firstMealStatus: {
      carbs: {
        type: Number,
        default: 0,
      },
      protein: {
        type: Number,
        default: 0,
      },
      fat: {
        type: Number,
        default: 0,
      },
      status: {
        type: Boolean,
        default: false,
      },
      microNutrients: {
        type: Object,
        default: null,
      },
    },
    secondMealStatus: {
      carbs: {
        type: Number,
        default: 0,
      },
      protein: {
        type: Number,
        default: 0,
      },
      fat: {
        type: Number,
        default: 0,
      },
      status: {
        type: Boolean,
        default: false,
      },
      microNutrients: {
        type: Object,
        default: null,
      },
    },
    thirdMealStatus: {
      carbs: {
        type: Number,
        default: 0,
      },
      protein: {
        type: Number,
        default: 0,
      },
      fat: {
        type: Number,
        default: 0,
      },
      status: {
        type: Boolean,
        default: false,
      },
      microNutrients: {
        type: Object,
        default: null,
      },
    },
    otherMealStatus: {
      carbs: {
        type: Number,
        default: 0,
      },
      protein: {
        type: Number,
        default: 0,
      },
      fat: {
        type: Number,
        default: 0,
      },
      status: {
        type: Boolean,
        default: false,
      },
      microNutrients: {
        type: Object,
        default: null,
      },
    },
    planDay: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

export const trackUserMealModel = mongoose.model<TrackUserMealDocument>(
  "trackUserMeal",
  trackUserMealSchema
);
