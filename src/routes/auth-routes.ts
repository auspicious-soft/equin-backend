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
  updateForgottenPassword,
  userSignIn,
  userSignUp,
  verifyForgotPassOTP,
  verifyOTP,
} from "src/controllers/auth/auth-controller";


const router = Router();

//Auth Routes

router.post("/create-questions", createQuestions);
router.post("/create-price-plan", createPricePlan);
router.post("/create-meal-plan", createMealPlan);
router.post("/add-essential-tips", createEssentialTips);
router.post("/create-30days-plan", createMealPlan);
router.post("/send-push-notifications", sendPushNotificationToUser)
router.post("/create-privacy-policy", createPrivacyPolicy)
router.post("/create-contact-support", createContactSupport)
router.post("/create-term-condition", createTermCondition)



router.get("/get-price-plan", getPricePlan);
router.get("/get-questions/:deviceId", getQuestions);
router.post("/save-answers", saveAnswers);


router.post("/user-signup", userSignUp);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOtp);

router.post("/forgot-password", forgotPassword)
router.post("/verify-forgot-pass-otp", verifyForgotPassOTP)
router.post("/update-forgotten-password",updateForgottenPassword)
router.post("/user-signIn",userSignIn)

export { router };
