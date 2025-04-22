import mongoose, { Document, Schema } from "mongoose";

export interface UserDocument extends Document {
  fullName?: string;
  email?: string;
  countryCode?: string | null;
  phoneNumber?: string | null;
  password?: string;
  otp?: {
    code: string;
    expiresAt: Date;
  };
  emailVerified: boolean;
  role?: "user" | "admin" | "superAdmin";
  level?: string;
  profilePic?: string;
  authType?: "Email" | "Facebook" | "Apple" | "Google";
  language?:
    | "english"
    | "french"
    | "mandarin"
    | "portuguese"
    | "russian"
    | "trukish"
    | "korean";
  token?: string | null;
  fcmToken?: string | null;
  deviceId?: string | null;
  country?: string | null;
  subscription?: boolean;
  isActive?: boolean;
}

const usersSchema = new mongoose.Schema<UserDocument>(
  {
    fullName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
    },
    countryCode: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      unique: true,
      default: null,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "superAdmin"],
      default: "user",
    },
    profilePic: {
      type: String,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },
    authType: {
      type: String,
      enum: ["Email", "Facebook", "Apple", "Google"],
      default: "Email",
    },
    language: {
      type: String,
      enum: [
        "english",
        "french",
        "mandarin",
        "portuguese",
        "russian",
        "trukish",
        "korean",
      ],
      default: "english",
    },
    token: {
      type: String,
      default: null,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    subscription: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deviceId: {
      type: String,
      default: null,
    },

  },
  { timestamps: true }
);

export const usersModel = mongoose.model<UserDocument>("users", usersSchema);
