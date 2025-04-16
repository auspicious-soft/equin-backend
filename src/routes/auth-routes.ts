import { Router } from "express";
import {
  createEssentialTips,
  createMealPlan,
  createPricePlan,
  createQuestions,
  forgotPassword,
  getPricePlan,
  getQuestions,
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



router.get("/get-price-plan", getPricePlan);
router.get("/get-questions", getQuestions);
router.post("/save-answers", saveAnswers);


router.post("/user-signup", userSignUp);
router.post("/verify-otp", verifyOTP);

router.post("/forgot-password", forgotPassword)
router.post("/verify-forgot-pass-otp", verifyForgotPassOTP)
router.post("/update-forgotten-password",updateForgottenPassword)
router.post("/user-signIn",userSignIn)

export { router };
