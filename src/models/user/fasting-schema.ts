import mongoose, { Document } from "mongoose";

export interface FastingRecordDocument extends Document {
  userId: mongoose.Types.ObjectId;
  date: string;
  isFasting: boolean;
  fastingHours?: number;
}

const fastingRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    isFasting: {
      type: Boolean,
      required: true,
    },
    fastingHours: {
      type: String,
      default: 16,
    },
  },
  { timestamps: true }
);

export const fastingRecordModel = mongoose.model<FastingRecordDocument>(
  "fastingRecord",
  fastingRecordSchema
);
