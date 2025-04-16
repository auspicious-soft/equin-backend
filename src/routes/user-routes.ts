import { Router } from "express";
import { fastingToday, myPlan, savePricePlan, saveWaterRecord, userHome, waterTracker } from "src/controllers/user/user-controller";

const router = Router();

//**********************HOME SCREEN ROUTES **********************/

router.get("/user-home", userHome);
router.post("/fasting-today", fastingToday);
router.post("/save-water-record", saveWaterRecord);
router.post("/water-tracker", waterTracker);

// *********************MY PLAN ROUTES *************************/
router.get("/get-users-plan", myPlan)
router.post("/save-price-plan", savePricePlan);

export { router }