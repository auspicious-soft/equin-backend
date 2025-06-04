import mongoose from "mongoose";

const termConditionSchema
 = new mongoose.Schema(
  {
    summary: {
      type: String,
      required: true,
    },
    content: [
      {
        title: { type: String, required: true },
        subtitle: { type: String},
        pointers: [{ type: String}],
      },
    ],
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

export const termConditionModel = mongoose.model(
  "termCondition",
  termConditionSchema

);
