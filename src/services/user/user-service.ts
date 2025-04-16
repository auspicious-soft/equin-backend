import { Request, Response } from "express";
import { errorResponseHandler } from "../../lib/errors/error-response-handler";
import { UserDocument, usersModel } from "../../models/user/user-schema";
import { configDotenv } from "dotenv";
import { fastingRecordModel } from "src/models/user/fasting-schema";
import { httpStatusCode } from "src/lib/constant";
import { healthDataModel } from "src/models/user/health-data-schema";
import { waterTrackerModel } from "src/models/user/water-tracker-schema";
import { userPlanModel } from "src/models/user-plan/user-plan-schema";
import { essentialTipModel } from "src/models/admin/essential-tips-schema";
import { pricePlanModel } from "src/models/admin/price-plan-schema";

configDotenv();

export interface UserPayload {
  _id?: string;
  email: string;
  fullName: string;
  password?: string;
  phoneNumber?: string;
  language?: string;
  authType?: string;
  role?: string;
}

const sanitizeUser = (user: any): UserDocument => {
  const sanitized = user.toObject();
  delete sanitized.password;
  delete sanitized.otp;
  return sanitized;
};

//*****************************FOR EQUIN APP *********************************/

//Home Page APIS

export const userHomeService = async (req: Request, res: Response) => {
  const userData = req.user as any;

  // Calculate fasting streak
  const today = new Date().toISOString().split("T")[0];
  let fastingStreak = 0;

  // Get records sorted by date in descending order
  const fastingRecords = await fastingRecordModel
    .find({
      userId: userData.id,
      isFasting: true,
    })
    .sort({ date: -1 });

  // Calculate streak
  for (const record of fastingRecords) {
    const recordDate = new Date(record.date);
    const previousDate = new Date(today);
    previousDate.setDate(previousDate.getDate() - fastingStreak);

    if (
      recordDate.toISOString().split("T")[0] ===
      previousDate.toISOString().split("T")[0]
    ) {
      fastingStreak++;
    } else {
      break;
    }
  }

  // Calculate this week's fasting days and hours (Monday to Sunday)
  const currentDate = new Date();
  const currentDay = currentDate.getDay(); // 0 is Sunday, 1 is Monday, etc.

  // Calculate the start of week (Monday)
  const startOfWeek = new Date();
  startOfWeek.setDate(
    currentDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1)
  );
  startOfWeek.setHours(0, 0, 0, 0);

  // Calculate the end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const thisWeekRecords = await fastingRecordModel.find({
    userId: userData.id,
    date: {
      $gte: startOfWeek.toISOString().split("T")[0],
      $lte: endOfWeek.toISOString().split("T")[0],
    },
    isFasting: true,
  });

  const thisWeekFastingDays = thisWeekRecords.length;
  const thisWeekFastingHours = thisWeekFastingDays * 16;

  // Get water intake goal settings
  const waterGoalData = await healthDataModel.findOne({ userId: userData.id });

  // Get today's water intake records
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const todayWaterRecords = await waterTrackerModel.find({
    userId: userData.id,
    date: {
      $gte: startOfToday,
      $lte: endOfToday,
    },
  });

  const todayTotalWaterIntake = todayWaterRecords.reduce(
    (sum, record) => sum + ((record as any)?.waterIntake || 0),
    0
  );

  return {
    success: true,
    message: "User home page",
    data: {
      fastingStreak,
      thisWeekFastingDays,
      thisWeekFastingHours,
      todaysFastingStatus: fastingRecords[0]?.date === today ? true : false,
      weekRange: {
        start: startOfWeek.toISOString().split("T")[0],
        end: endOfWeek.toISOString().split("T")[0],
      },
      waterIntake: {
        today: todayTotalWaterIntake,
        goal: waterGoalData?.waterIntakeGoal.dailyGoal || 0,
        containerType: waterGoalData?.waterIntakeGoal.containerType || "glass",
        containerSize: waterGoalData?.waterIntakeGoal.containerSize || 0,
        unit: waterGoalData?.waterIntakeGoal.unit || "ml",
        progress: waterGoalData?.waterIntakeGoal.dailyGoal
          ? Math.round(
              (todayTotalWaterIntake /
                waterGoalData.waterIntakeGoal.dailyGoal) *
                100
            )
          : 0,
      },
    },
  };
};

export const fastingTodayService = async (req: Request, res: Response) => {
  const userData = req.user as any;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Check if a record already exists for today
  const existingRecord = await fastingRecordModel.findOne({
    userId: userData.id,
    date: today,
  });

  if (existingRecord) {
    return errorResponseHandler(
      "Fasting record already exists for today",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Create new fasting record for today
  const fastingRecord = await fastingRecordModel.create({
    userId: userData.id,
    date: today,
    isFasting: true,
  });

  return {
    success: true,
    message: "Fasting record created for today",
    data: fastingRecord,
  };
};

export const waterDataService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const {
    containerType,
    containerSize,
    dailyGoal,
    waterReminder = false,
  } = req.body;

  // Validate input data
  if (!containerType || !containerSize || !dailyGoal) {
    return errorResponseHandler(
      "containerType, containerSize, and dailyGoal are required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Validate containerType
  const validContainerTypes = ["bottle", "cup", "glass"];
  if (!validContainerTypes.includes(containerType)) {
    return errorResponseHandler(
      `containerType must be one of: ${validContainerTypes.join(", ")}`,
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Validate containerSize and dailyGoal as positive numbers
  if (containerSize <= 0 || dailyGoal <= 0) {
    return errorResponseHandler(
      "containerSize and dailyGoal must be positive numbers",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Check if record exists
  const existingRecord = await healthDataModel.findOne({ userId: userData.id });

  let response;
  if (existingRecord) {
    // Update existing record
    response = await healthDataModel.findOneAndUpdate(
      { userId: userData.id },
      {
        waterIntakeGoal: {
          containerType,
          containerSize,
          dailyGoal,
          waterReminder: waterReminder,
        },
      },
      { new: true }
    );
  } else {
    // Create new record
    response = await healthDataModel.create({
      userId: userData.id,
      waterIntakeGoal: {
        containerType,
        containerSize,
        dailyGoal,
        waterReminder: waterReminder,
      },
    });
  }

  return {
    success: true,
    message: existingRecord
      ? "Water tracker updated successfully"
      : "Water tracker created successfully",
    data: response,
  };
};

export const waterTracketService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { waterIntake } = req.body;

  // Get today's date in YYYY-MM-DD format
  const today = new Date();

  // Create new fasting record for today
  const fastingRecord = await waterTrackerModel.create({
    userId: userData.id,
    waterIntake: waterIntake,
    date: today,
  });

  return {
    success: true,
    message: "Water record created",
    data: fastingRecord,
  };
};

//My Plan Page APIS

export const myPlanService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const currentDate = new Date();

  const [activePlan, essentialTips] = await Promise.all([
    userPlanModel
      .findOne({
        userId: userData.id,
        paymentStatus: "success",
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate },
      })
      .populate("planId"),

    essentialTipModel
      .find({
        isActive: true,
        publishDate: { $lte: currentDate },
      })
      .sort({ publishDate: -1 })
      .limit(5),
  ]);

  return {
    success: true,
    message: activePlan ? "Active plan found" : "No active plan found",
    data: {
      hasActivePlan: !!activePlan,
      plan: activePlan,
      essentialTips,
    },
  };
};

export const savePricePlanServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { planId } = req.body;

  if (!planId) {
    return errorResponseHandler(
      "Invalid payload",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const pricePlan = await pricePlanModel.findById(planId);
  if (!pricePlan) {
    return errorResponseHandler(
      "Invalid planId",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const existingActivePlan = await userPlanModel.findOne({
    userId: userData.id,
    planId: planId,
    endDate: { $gte: new Date() },
    paymentStatus: "success",
  });

  if (existingActivePlan) {
    return errorResponseHandler(
      "Active plan already exists",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const result = await userPlanModel.create({
    userId: userData.id,
    planId: planId,
    paymentStatus: "pending",
    startDate: null, 
    endDate: null, 
    transactionId: null, 
    paymentMethod: null,
  });

  return {
    success: true,
    message: "Plan initialized successfully",
    data: {
      planDetails: result,
      priceInfo: {
        amount: pricePlan.price,
        currency: "INR",
        duration: `${pricePlan.months} months`
      }
    }
  };
};

//*****************************FOR EQUIN APP *********************************/
