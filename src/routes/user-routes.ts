import { Router } from "express";
import { cancelSubscription } from "src/controllers/stripe/stripe-controller";
import {
  changePassword,
  chatWithGPT,
  fastingToday,
  getChatHistory,
  getMealDateWise,
  getNutritionByImage,
  getUserSettings,
  logoutUser,
  myPlan,
  myProfile,
  nutrition,
  savePricePlan,
  saveWaterRecord,
  updateMealTracker,
  updateUserDetails,
  updateUserProfilePhoto,
  userHome,
  waterTracker,
} from "src/controllers/user/user-controller";

const router = Router();

//**********************HOME SCREEN ROUTES **********************/

router.get("/user-home", userHome);
router.post("/fasting-today", fastingToday);
router.post("/save-water-record", saveWaterRecord);
router.post("/water-tracker", waterTracker);

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
router.post("/update-profile-pic", updateUserProfilePhoto);
router.get("/my-profile", myProfile);
router.get("/get-meal-by-date", getMealDateWise);
router.put("/change-password", changePassword);
router.post("/logout-user", logoutUser);

//*********************GPT ROUTES *******************************/

router.route("/chat-with-gpt").post(chatWithGPT).get(getChatHistory);
router.post("/get-nutrition-by-image", getNutritionByImage)

export { router };
