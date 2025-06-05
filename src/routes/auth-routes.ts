import { Router } from "express";
import { sendPushNotificationToUser } from "src/controllers/admin/admin-controller";
import {
  createContactSupport,
  createEssentialTips,
  createMealPlan,
  createPricePlan,
  createPrivacyPolicy,
  createQuestions,
  createTermCondition,
  forgotPassword,
  getPricePlan,
  getQuestions,
  resendOtp,
  saveAnswers,
  socialSignUp,
  updateForgottenPassword,
  userSignIn,
  userSignUp,
  verifyForgotPassOTP,
  verifyOTP,
} from "src/controllers/auth/auth-controller";
import { createNotification } from "src/services/admin/notification-service";

const router = Router();

//Auth Routes

router.post("/create-questions", createQuestions);
router.post("/create-price-plan", createPricePlan);
router.post("/create-meal-plan", createMealPlan);
router.post("/add-essential-tips", createEssentialTips);
router.post("/create-30days-plan", createMealPlan);
router.post("/send-push-notifications", sendPushNotificationToUser);
router.post("/create-privacy-policy", createPrivacyPolicy);
router.post("/create-contact-support", createContactSupport);
router.post("/create-term-condition", createTermCondition);

router.get("/get-price-plan", getPricePlan);
router.get("/get-questions/:deviceId", getQuestions);
router.post("/save-answers", saveAnswers);

router.post("/user-signup", userSignUp);
router.post("/user-social-signup", socialSignUp);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOtp);

router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-pass-otp", verifyForgotPassOTP);
router.post("/update-forgotten-password", updateForgottenPassword);
router.post("/user-signIn", userSignIn);

//test route
router.get("/test-api", async (req, res) => {
  console.log("Test route hit", req.body.userId);
  createNotification({
    userId: req.body.userId,
    title: "Test Notification",
    message: "This is a test notification",
    type: "WATER_REMINDER",
    subType: "WATER_GOAL_REMINDER",
    priority: "HIGH",
  })
  res.status(200).json({ message: "Test route is working!" });
});

export { router };
