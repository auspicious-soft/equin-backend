import mongoose from "mongoose";
import { notificationModel } from "../../models/notifications/notification-schema";
import { sendNotification } from "../../utils/FCM/FCM";
import { usersModel } from "src/models/user/user-schema";

interface CreateNotificationProps {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: string;
  subType: string;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  actionData?: string | null;
  scheduledFor?: Date | null;
  expiresAt?: Date | null;
  deviceId?: string | null;
}

export const createNotification = async ({
  userId,
  title,
  message,
  type,
  subType,
  priority = "MEDIUM",
  actionData = null,
  scheduledFor = null,
  expiresAt = null,
  deviceId = null,
}: CreateNotificationProps) => {
  try {
    const notification = await notificationModel.create({
      userId,
      title,
      message,
      type,
      subType,
      priority,
      actionData,
      scheduledFor,
      expiresAt,
      deviceId,
      status: "PENDING",
    });

    if (userId) {
      try {
        const fcmTokens = await usersModel.findById(userId, {
          fcmToken: 1,
        }).lean();
        if (!fcmTokens || !fcmTokens.fcmToken || fcmTokens.fcmToken.length === 0) {
          console.warn("No FCM tokens found for user:", userId);
          return notification;
        }
        await sendNotification(fcmTokens.fcmToken, title, message);
        await notificationModel.findByIdAndUpdate(notification._id, {
          status: "SENT",
        });
      } catch (error) {
        console.error("Failed to send push notification:", error);
        await notificationModel.findByIdAndUpdate(notification._id, {
          status: "FAILED",
        });
      }
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

export const createSystemNotification = async ({
  userId,
  title,
  message,
  subType,
  actionData = null,
  deviceId = null,
}: Omit<CreateNotificationProps, "type">) => {
  return createNotification({
    userId,
    title,
    message,
    type: "SYSTEM",
    subType,
    priority: "HIGH",
    actionData,
    deviceId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
  });
};

export const createSecurityNotification = async ({
  userId,
  title,
  message,
  deviceId = null,
}: Omit<CreateNotificationProps, "type" | "subType">) => {
  return createSystemNotification({
    userId,
    title,
    message,
    subType: "ACCOUNT_UPDATE",
    actionData: null,
    deviceId,
  });
};
