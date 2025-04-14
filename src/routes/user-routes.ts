import { Router } from "express";
import { fastingToday, saveWaterRecord, userHome, waterTracker } from "src/controllers/user/user-controller";

const router = Router();

router.get("/user-home", userHome);
router.post("/fasting-today", fastingToday);
router.post("/save-water-record", saveWaterRecord);
router.post("/water-tracker", waterTracker);

export { router }