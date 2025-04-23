import mongoose, { Document } from "mongoose";

export interface NotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: string;
  subType: string;
  priority: string;
  isRead: boolean;
  actionData?: Record<string, any>;
  scheduledFor?: Date;
  expiresAt?: Date;
  status: string;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "WATER_REMINDER",
        "MEAL_REMINDER",
        "FASTING",
        "SUBSCRIPTION",
        "PAYMENT",
        "ACHIEVEMENT",
        "SYSTEM",
        "HEALTH_UPDATE",
        "TIPS",
        "PROGRESS",
      ],
      index: true,
    },
    subType: {
      type: String,
      required: true,
      enum: [
        // Water related
        "WATER_GOAL_REMINDER",
        "WATER_GOAL_ACHIEVED",
        "WATER_STREAK",
        
        // Meal related
        "FIRST_MEAL_REMINDER",
        "SECOND_MEAL_REMINDER",
        "DINNER_REMINDER",
        "SNACK_REMINDER",
        "MEAL_LOGGED",
        "MEAL_PLAN_UPDATE",
        
        // Fasting related
        "FAST_START_REMINDER",
        "FAST_END_REMINDER",
        "FAST_MILESTONE",
        "FAST_COMPLETED",
        "FAST_STREAK_ACHIEVEMENT",
        
        // Subscription/Payment related
        "SUBSCRIPTION_EXPIRING",
        "SUBSCRIPTION_EXPIRED",
        "SUBSCRIPTION_RENEWED",
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "PAYMENT_PENDING",
        "TRIAL_ENDING",
        
        // Achievement related
        "STREAK_MILESTONE",
        "WEIGHT_GOAL",
        "BMI_UPDATE",
        
        // System related
        "APP_UPDATE",
        "MAINTENANCE",
        "ACCOUNT_UPDATE",
        
        // Health related
        "WEIGHT_REMINDER",
        "HEALTH_TIP",
        "EXERCISE_REMINDER",
        
        // Progress related
        "WEEKLY_SUMMARY",
        "MONTHLY_REPORT",
        "GOAL_PROGRESS",
      ],
    },
    priority: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      default: "MEDIUM",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Can contain specific data related to the notification:
      // - Deep links
      // - Reference IDs
      // - Additional parameters
      // - Screen navigation data
    },
    scheduledFor: {
      type: Date,
      default: null,
      // For scheduled notifications like reminders
    },
    expiresAt: {
      type: Date,
      default: null,
      // When the notification should expire/be auto-deleted
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "CANCELLED"],
      default: "PENDING",
    },
    deviceId: {
      type: String,
      // For device-specific notifications
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1 });

// Auto-delete expired notifications (optional)
notificationSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0 
});

export const notificationModel = mongoose.model<NotificationDocument>(
  "notifications",
  notificationSchema
);