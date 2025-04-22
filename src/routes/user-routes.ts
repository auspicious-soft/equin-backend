import { Router } from "express";
import { cancelSubscription } from "src/controllers/stripe/stripe-controller";
import {
  changePassword,
  fastingToday,
  getMealDateWise,
  getUserSettings,
  myPlan,
  myProfile,
  savePricePlan,
  saveWaterRecord,
  updateMealTracker,
  updateUserDetails,
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
router.post("/record-meal", updateMealTracker);
router.post("/save-price-plan", savePricePlan);
router.post("/cancel-subscription", cancelSubscription);

//*********************USER SETTINGS ***************************** */

router.get("/get-settings", getUserSettings);
router.put("/update-user-profile", updateUserDetails);
router.get("/my-profile", myProfile);
router.get("/get-meal-by-date", getMealDateWise);
router.put("/change-password", changePassword);

export { router };
