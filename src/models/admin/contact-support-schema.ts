import mongoose from "mongoose";

const contactSupportSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    faq: [
      {
        question: { type: String, required: true },
        answer: { type: String}
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

export const contactSupportModel = mongoose.model(
  "contactSupport",
  contactSupportSchema
);
