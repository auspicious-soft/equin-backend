import mongoose, { Document } from "mongoose";

export interface QuestionResponseDocument extends Document {
  deviceId?: string;
  order: number;
  userId?: mongoose.Types.ObjectId | null;
  questionId: mongoose.Types.ObjectId;
  selectedOptionValues: any[];
}

const questionResponseSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "questions",
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    selectedOptionValues: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
    },
  },
  { timestamps: true }
);

export const questionResponseModel = mongoose.model<QuestionResponseDocument>(
  "questionResponse",
  questionResponseSchema
);
