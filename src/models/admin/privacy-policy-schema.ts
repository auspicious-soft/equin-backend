import mongoose from "mongoose";

const privacyPolicySchema = new mongoose.Schema(
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

export const privacyPolicyModel = mongoose.model(
  "privacyPolicy",
  privacyPolicySchema
);
