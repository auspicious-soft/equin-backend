import mongoose from 'mongoose';

const mealSchema = new mongoose.Schema({
  meal_time: {
    type: String,
    required: true
  },
  items: {
    type: [String],
    required: true
  },
  calories: {
    type: String,
    required: true
  }
});

const dayPlanSchema = new mongoose.Schema({
  plan_type: {
    type: String,
    required: true,
    enum: ['Men', 'Women']
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 30
  },
  meals: {
    type: [mealSchema],
    required: true,
  },
  total_calories: {
    type: String,
    required: true
  }
});

export const mealPlanModel30 = mongoose.model('MealPlan30Days', dayPlanSchema);
