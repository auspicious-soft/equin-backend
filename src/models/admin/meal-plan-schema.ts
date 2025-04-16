import mongoose from "mongoose";

const mealEntrySchema = new mongoose.Schema({
  title: String,
  meal: [String],
});

const dayPlanSchema = new mongoose.Schema({
  day: Number,
  firstMeal: mealEntrySchema,
  snack: mealEntrySchema,
  lastMeal: mealEntrySchema,
});

const mealPlanSchema = new mongoose.Schema(
  {
    ageCategory: String,
    gender: String,
    dietType: String,
    filePath: String,
    weightCategory: String,
    fastingWindow: String,
    eatingWindow: String,
    calories: String,
    weekPlan: [dayPlanSchema],
  },
  { timestamps: true }
);

export const mealPlanModel = mongoose.model("mealPlan", mealPlanSchema);
