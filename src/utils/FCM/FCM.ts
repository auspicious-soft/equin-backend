import admin from "firebase-admin";

// Firebase Admin SDK Initialization
export const initializeFirebase = () => {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("Missing Firebase service account credentials");
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    serviceAccount.private_key = serviceAccount.private_key.replace(
      /\\n/g,
      "\n"
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized");
    }
  } catch (error) {
    console.error("❌ Error initializing Firebase:", error);
    throw error;
  }
};

// Notification message interface
interface NotificationMessage {
  notification: {
    title: string;
    body: string;
  };
  token: string;
}

// Function to send a push notification
export const sendNotification = async (
  fcmToken: string[],
  title: string,
  body: string
): Promise<void> => {
  for (const token of fcmToken) {
    const message: NotificationMessage = {
      notification: {
        title,
        body,
      },
      token: token,
    };

    if (!token || token === null || token.trim() === "") {
      console.warn("❗ No FCM token provided, skipping notification");
      continue;
    }

    try {
      const response = await admin.messaging().send(message);
      console.log("✅ Notification sent:", response);
    } catch (error) {
      console.error("❌ Failed to send notification:", error);
      // throw error;
    }
  }
};
