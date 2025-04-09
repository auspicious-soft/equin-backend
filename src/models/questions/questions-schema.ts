import mongoose from "mongoose";

export interface OptionDocument {
    text: string;
    value: string | number;
}

export interface QuestionDocument extends Document {
    text: string;
    subtitle: string;
    options: OptionDocument[];
    order: number;
}

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
      required: true,
    },
    options: [
      {
        text: { type: String, required: true },
        value: { type: Number, required: true, unique: true },
      },
    ],
    order: {
      type: Number,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

export const questionModel = mongoose.model<QuestionDocument>("questions", questionSchema);
