import { Router } from "express";
import { cancelSubscription } from "src/controllers/stripe/stripe-controller";
import multer from "multer";
import {
  changePassword,
  chatWithGPT,
  fastingToday,
  getChatHistory,
  getMealDateWise,
  getNutritionByImage,
  getPrivacyAndContactSupport,
  getRating,
  getUserSettings,
  logoutUser,
  myPlan,
  myProfile,
  nutrition,
  rateApp,
  savePricePlan,
  saveWaterRecord,
  updateMealTracker,
  updateSettings,
  updateUserDetails,
  updateUserProfilePhoto,
  userHome,
  waterTracker,
} from "src/controllers/user/user-controller";
import { getPricePlan } from "src/controllers/auth/auth-controller";


const router = Router();

//**********************HOME SCREEN ROUTES **********************/

router.get("/user-home", userHome);
router.post("/fasting-today", fastingToday);
router.post("/save-water-record", saveWaterRecord);
router.post("/water-tracker", waterTracker);
router.get("/get-price-plan-info", getPricePlan);

// *********************MY PLAN ROUTES *************************/
router.get("/get-users-plan", myPlan);
router.post("/save-price-plan", savePricePlan);
router.post("/cancel-subscription", cancelSubscription);

//**********************NUTRITION PAGE **************************/
router.get("/get-nutrition", nutrition)
router.post("/record-meal", updateMealTracker);

//*********************USER SETTINGS ****************************/

router.get("/get-settings", getUserSettings);
router.put("/update-user-profile", updateUserDetails);
router.put("/update-settings", updateSettings);
router.post("/update-profile-pic", updateUserProfilePhoto);
router.get("/my-profile", myProfile);
router.get("/get-meal-by-date", getMealDateWise);
router.put("/change-password", changePassword);
router.post("/logout-user", logoutUser);
router.get("/get-privacy-and-contact-support", getPrivacyAndContactSupport);
router.route("/rate-app").post(rateApp).get(getRating)

//*********************GPT ROUTES *******************************/

router.route("/chat-with-gpt").post(chatWithGPT).get(getChatHistory);

const upload = multer({ storage: multer.memoryStorage() });
router.post("/get-nutrition-by-image",upload.single("image"), getNutritionByImage)

export { router };
