import mongoose, { Document, Schema } from "mongoose";

const mealSchema = new mongoose.Schema({
    day: Number,
    firstMeal: {
      time: String,
      calories: String,
      items: [String],
    },
    snack: {
      time: String,
      calories: String,
      items: [String],
    },
    lastMeal: {
      time: String,
      calories: String,
      items: [String],
    },
  });
  
  const fastingPlanSchema = new mongoose.Schema({
    title: String,
    fastingWindow: {
      start: String,
      end: String,
      duration: String,
    },
    eatingWindow: {
      start: String,
      end: String,
      duration: String,
    },
    dailyCalories: String,
    targetGroup: {
      ageCategory: {
        type: String,
        enum: ["20-35", "35-55", "55+"],
      },
      gender: {
        type: String,
        enum: ["Male", "Female"],
      },
      dietType: {
        type: String,
        enum: [
          "Normal",
          "Vegetarian",
          "Vegan",
          "Ketogenic",
          "Pescatarian",
          "Gluten Free",
          "Mediterranean diet",
        ],
      },
      weightCategory: {
        type: String,
        enum: ["Moderately-overweight", "Very-overweight"],
      },
    },
    mealPlan: [mealSchema],
  });

  export const mealPlanModel = mongoose.model("MealPlan", fastingPlanSchema);
  