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
import { trackUserMealModel } from "src/models/user/track-user-meal";
import { mealPlanModel30 } from "src/models/admin/30days-meal-plan-schema";
import { createSecurityNotification } from "../admin/notification-service";

import bcrypt from "bcryptjs";
import { startOfWeek, endOfWeek } from "date-fns";
import { chatModel } from "src/models/user/chat-schema";
import { openai } from "src/config/openAI";
import { ChatCompletionMessageParam } from "openai/resources";
import { Readable } from "stream";
import Busboy from "busboy";
import { createS3Client } from "src/config/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { uploadStreamToS3Service } from "src/utils/s3/s3";
import { privacyPolicyModel } from "src/models/admin/privacy-policy-schema";
import { contactSupportModel } from "src/models/admin/contact-support-schema";
import { ratingModel } from "src/models/admin/app-rating-schema";
import {
  getTodayUTC,
  getTomorrowUTC,
  getDateMidnightUTC,
  debugDateComparison,
} from "src/utils/date-utils";
import { termConditionModel } from "src/models/admin/term-condition-model";

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

//*************Home Page APIS

export const userHomeService = async (req: Request, res: Response) => {
  const userData = req.user as any;

  const today = getTodayUTC();
  let fastingStreak = 0;

  // Get fasting records sorted by date (descending)
  const fastingRecords = await fastingRecordModel
    .find({
      userId: userData.id,
      isFasting: true,
    })
    .sort({ date: -1 });

  const fastingMethod = await healthDataModel
    .findOne({
      userId: userData.id,
    })
    .lean();

  if (fastingMethod?.fastingMethod === "5:2") {
    // 5:2 Method: Streak = Number of consecutive weeks with at least 2 fasts
    let weekOffset = 0;

    while (true) {
      const referenceDate = new Date();
      referenceDate.setDate(referenceDate.getDate() - weekOffset * 7);

      const weekStart = new Date(referenceDate);
      const day = weekStart.getDay(); // 0 (Sun) - 6 (Sat)
      weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const records = await fastingRecordModel.find({
        userId: userData.id,
        date: {
          $gte: weekStart.toISOString().split("T")[0],
          $lte: weekEnd.toISOString().split("T")[0],
        },
        isFasting: true,
      });

      if (records.length >= 2) {
        fastingStreak++;
        weekOffset++;
      } else {
        break; // Streak ends
      }
    }
  } else {
    // Default (e.g. 16:8): Count consecutive fasting days
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
  }

  // Calculate this week's fasting stats
  const currentDate = new Date();
  const currentDay = currentDate.getDay(); // 0 is Sunday, 1 is Monday, etc.

  const startOfWeekUTC = getDateMidnightUTC(
    startOfWeek(currentDate, { weekStartsOn: 1 })
  );
  const endOfWeekUTC = getDateMidnightUTC(
    endOfWeek(currentDate, { weekStartsOn: 1 })
  );

  const thisWeekRecords = await fastingRecordModel.find({
    userId: userData.id,
    date: {
      $gte: startOfWeekUTC.toISOString().split("T")[0],
      $lte: endOfWeekUTC.toISOString().split("T")[0],
    },
    isFasting: true,
  });

  const thisWeekFastingDays = thisWeekRecords.length;
  const thisWeekFastingHours =
    fastingMethod?.fastingMethod === "5:2"
      ? thisWeekFastingDays * 16
      : thisWeekFastingDays * 16;

  // Water intake tracking
  const waterGoalData = await healthDataModel.findOne({ userId: userData.id });

  const startOfToday = getTodayUTC();
  const endOfToday = getTomorrowUTC();

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

  const waterReminder = await healthDataModel
    .findOne({
      userId: userData.id,
    })
    .lean();

  return {
    success: true,
    message: "User home page",
    data: {
      fastingStreak,
      fastingMethod: fastingMethod?.fastingMethod || "16:8",
      thisWeekFastingDays,
      thisWeekFastingHours,
      todaysFastingStatus:
        fastingRecords[0]?.date === today.toISOString().split("T")[0]
          ? true
          : false,
      weekRange: {
        start: startOfWeekUTC.toISOString().split("T")[0],
        end: endOfWeekUTC.toISOString().split("T")[0],
      },
      waterIntake: {
        waterReminder: waterReminder?.waterReminder || false,
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
}; // Install via: npm install date-fns

export const fastingTodayService = async (req: Request, res: Response) => {
  const userData = req.user as any;

  const today = getTodayUTC().toISOString().split("T")[0];

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

  const fastingMethod = await healthDataModel
    .findOne({
      userId: userData.id,
    })
    .lean();

  let fastingRecord = {};

  if (fastingMethod?.fastingMethod === "5:2") {
    // Get the start and end of the current week (Monday to Sunday)
    const startOfWeekDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // 1 = Monday
    const endOfWeekDate = endOfWeek(new Date(), { weekStartsOn: 1 });

    const weeklyRecordsCount = await fastingRecordModel.countDocuments({
      userId: userData.id,
      date: {
        $gte: startOfWeekDate.toISOString().split("T")[0],
        $lte: endOfWeekDate.toISOString().split("T")[0],
      },
    });

    if (weeklyRecordsCount >= 2) {
      return errorResponseHandler(
        "You can only create 2 fasting records per week for the 5:2 method.",
        httpStatusCode.BAD_REQUEST,
        res
      );
    }

    // Create new fasting record
    fastingRecord = await fastingRecordModel.create({
      userId: userData.id,
      date: today,
      fastingHours: 16,
      isFasting: true,
    });
  } else if (fastingMethod?.fastingMethod === "16:8") {
    fastingRecord = await fastingRecordModel.create({
      userId: userData.id,
      date: today,
      fastingHours: 16,
      isFasting: true,
    });
  }

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
        },
        waterReminder: waterReminder,
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
      },
      waterReminder: waterReminder,
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

  // Use UTC date utility
  const today = getTodayUTC();

  const waterData = await healthDataModel.findOne({ userId: userData.id });

  if (!waterData?.waterIntakeGoal?.dailyGoal) {
    return errorResponseHandler(
      "Water intake goal not set",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Create new water record for today
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

//*************My Plan Page APIS

export const myPlanService = async (req: Request, res: Response) => {
  const userData = req.user as { id: string; gender: string };

  const today = getTodayUTC();
  const tomorrow = getTomorrowUTC();

  let mealTracking = null;
  let mealPlan = null;

  const activePlan = await userPlanModel
    .findOne({
      userId: userData.id,
      startDate: { $lt: tomorrow },
      endDate: { $gte: today },
      paymentStatus: "success",
    })
    .populate("planId")
    .lean();

  const essentialTips = await essentialTipModel
    .find({
      isActive: true,
      publishDate: { $lte: today },
    })
    .sort({ publishDate: -1 })
    .limit(5);

  if (activePlan?.planId) {
    const startDate = getDateMidnightUTC(
      new Date(activePlan?.startDate ?? today)
    );
    const endDate = getDateMidnightUTC(new Date(activePlan?.endDate ?? today));

    const existingRecords = await trackUserMealModel.find({
      userId: userData.id,
      planDay: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    const existingRecordsByDate: { [key: string]: any } = {};
    existingRecords.forEach((record) => {
      const dateKey = record.planDay.toISOString().split("T")[0];
      existingRecordsByDate[dateKey] = record;
    });

    const mealPlans = await mealPlanModel30.find({
      plan_type: userData.gender === "Male" ? "Men" : "Women",
    });

    if (mealPlans.length === 0) {
      console.error(`No meal plans found for gender: ${userData.gender}`);
    }

    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
      ) + 1;

    const bulkOperations = [];
    const bulkEntries = [];

    for (let i = 0; i < totalDays; i++) {
      const currentDayDate = new Date(startDate);
      currentDayDate.setUTCDate(startDate.getUTCDate() + i);
      currentDayDate.setUTCHours(0, 0, 0, 0);

      const dateKey = currentDayDate.toISOString().split("T")[0];
      const dayIndex = i % 30;
      const planForDay = mealPlans.find((plan) => plan.day === dayIndex + 1);

      if (planForDay) {
        const existingRecord = existingRecordsByDate[dateKey];
        if (existingRecord) {
          if (
            !existingRecord.planId ||
            existingRecord.planId.toString() !== planForDay._id.toString()
          ) {
            bulkOperations.push({
              updateOne: {
                filter: { _id: existingRecord._id },
                update: { $set: { planId: planForDay._id } },
              },
            });
          }
        } else {
          bulkEntries.push({
            userId: userData.id,
            planId: planForDay._id,
            planDay: currentDayDate,
            firstMealStatus: {
              carbs: 0,
              protein: 0,
              fat: 0,
              status: false,
            },
            secondMealStatus: {
              carbs: 0,
              protein: 0,
              fat: 0,
              status: false,
            },
            thirdMealStatus: {
              carbs: 0,
              protein: 0,
              fat: 0,
              status: false,
            },
            otherMealStatus: {
              carbs: 0,
              protein: 0,
              fat: 0,
              status: false,
            },
          });
        }
      }
    }

    if (bulkOperations.length > 0) {
      await trackUserMealModel.bulkWrite(bulkOperations);
    }

    if (bulkEntries.length > 0) {
      await trackUserMealModel.insertMany(bulkEntries);
    }

    const sixDaysAhead = new Date(today);
    sixDaysAhead.setUTCDate(today.getUTCDate() + 6);

    const sevenDayMealTracker = await trackUserMealModel
      .find({
        userId: userData.id,
        planDay: {
          $gte: today,
          $lte: sixDaysAhead,
        },
      })
      .sort({ planDay: 1 })
      .populate("planId");

    mealTracking = sevenDayMealTracker;
  } else {
    mealPlan = await pricePlanModel.find();
  }

  return {
    success: true,
    message: activePlan?.planId ? "Active plan found" : "No active plan found",
    data: {
      hasActivePlan: !!mealTracking,
      plan: mealTracking || mealPlan,
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
      `Active plan already exists till ${existingActivePlan.endDate}`,
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const result = await userPlanModel.create({
    userId: userData.id,
    planId: planId,
    stripeProductId: pricePlan.productId,
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
        currency: "usd",
        duration: `${pricePlan.months} months`,
      },
    },
  };
};

//**************Nutrition Page

export const nutritionServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const currentDate = getTodayUTC();
  const todayUTC = getTodayUTC();
  const tomorrowUTC = getTomorrowUTC();

  // Check for active plan with explicit planId validation
  const activePlan = await userPlanModel
    .findOne({
      userId: userData.id,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
      paymentStatus: "success",
    })
    .populate("planId")
    .lean();

  let todayMeal;

  // Default meal status structure
  const defaultMealStatus = {
    carbs: 0,
    protein: 0,
    fat: 0,
    status: false,
  };

  // Step 1: Try to find existing meal record first
  todayMeal = await trackUserMealModel
    .findOne({
      userId: userData.id,
      planDay: {
        $gte: todayUTC,
        $lt: tomorrowUTC,
      },
    })
    .populate("planId")
    .lean();

  // Step 2: If no existing meal found, create one using findOneAndUpdate with upsert
  if (!todayMeal) {
    // Prepare the meal data to upsert
    const mealData = {
      userId: userData.id,
      planDay: todayUTC,
      firstMealStatus: defaultMealStatus,
      secondMealStatus: defaultMealStatus,
      thirdMealStatus: defaultMealStatus,
      otherMealStatus: defaultMealStatus,
    };

    // Add planId only if active plan exists
    if (activePlan && activePlan.planId) {
      (mealData as any).planId = activePlan.planId._id;
    }

    try {
      // Use findOneAndUpdate with upsert - this is atomic and prevents race conditions
      todayMeal = await trackUserMealModel
        .findOneAndUpdate(
          {
            userId: userData.id,
            planDay: {
              $gte: todayUTC,
              $lt: tomorrowUTC,
            },
          },
          {
            $setOnInsert: mealData, // Only set these fields if creating new document
          },
          {
            upsert: true, // Create if doesn't exist
            new: true, // Return the updated/created document
            runValidators: true,
          }
        )
        .populate("planId")
        .lean();
    } catch (error: any) {
      // Handle potential duplicate key error (in case of race condition)
      if (
        error.code === 11000 ||
        error.message?.includes("duplicate") ||
        error.message?.includes("E11000")
      ) {
        // If duplicate error occurs, fetch the existing record that was created by concurrent request
        todayMeal = await trackUserMealModel
          .findOne({
            userId: userData.id,
            planDay: {
              $gte: todayUTC,
              $lt: tomorrowUTC,
            },
          })
          .populate("planId")
          .lean();
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    // Step 3: Final safety check - if still no meal found, something went wrong
    if (!todayMeal) {
      // Last resort: try a simple create (this should rarely happen)
      try {
        const newMeal = await trackUserMealModel.create(mealData);
        todayMeal = await trackUserMealModel
          .findById(newMeal._id)
          .populate("planId")
          .lean();
      } catch (createError: any) {
        // If this also fails due to duplicate, just fetch the existing one
        if (createError.code === 11000) {
          todayMeal = await trackUserMealModel
            .findOne({
              userId: userData.id,
              planDay: {
                $gte: todayUTC,
                $lt: tomorrowUTC,
              },
            })
            .populate("planId")
            .lean();
        } else {
          throw createError;
        }
      }
    }
  }

  // Step 4: Update planId if there's an active plan but meal doesn't have planId
  if (activePlan && activePlan.planId && !todayMeal?.planId) {
    await trackUserMealModel.updateOne(
      { _id: todayMeal?._id },
      { planId: activePlan.planId._id }
    );
    (todayMeal as any).planId = activePlan.planId;
  }

  // Initialize any missing meal status fields (defensive programming)
  const mealStatusFields = [
    "firstMealStatus",
    "secondMealStatus",
    "thirdMealStatus",
    "otherMealStatus",
  ];

  mealStatusFields.forEach((field: any) => {
    if (!(todayMeal as any)[field]) {
      (todayMeal as any)[field] = { ...defaultMealStatus };
    }
  });

  // Calculate calories for each meal
  const calculateMealCalories = (mealStatus: any) => {
    return mealStatus && mealStatus.status
      ? (mealStatus.carbs || 0) * 4 +
          (mealStatus.protein || 0) * 4 +
          (mealStatus.fat || 0) * 9
      : 0;
  };

  const firstMealCalories = calculateMealCalories(todayMeal?.firstMealStatus);
  const secondMealCalories = calculateMealCalories(todayMeal?.secondMealStatus);
  const thirdMealCalories = calculateMealCalories(todayMeal?.thirdMealStatus);
  const otherMealCalories = calculateMealCalories(todayMeal?.otherMealStatus);

  // Add calories to each meal status
  if (todayMeal && todayMeal.firstMealStatus) {
    todayMeal.firstMealStatus.calories = firstMealCalories;
  }
  if (todayMeal && todayMeal.secondMealStatus) {
    todayMeal.secondMealStatus.calories = secondMealCalories;
  }
  if (todayMeal && todayMeal.thirdMealStatus) {
    todayMeal.thirdMealStatus.calories = thirdMealCalories;
  }
  if (todayMeal && todayMeal.otherMealStatus) {
    todayMeal.otherMealStatus.calories = otherMealCalories; // Assuming otherMealStatus doesn't have calories
  }

  // Calculate total consumed nutrients
  const calculateConsumedNutrient = (nutrient: string) => {
    return mealStatusFields.reduce((total, field) => {
      const mealStatus = (todayMeal as any)[field];
      return (
        total +
        (mealStatus && mealStatus.status ? mealStatus[nutrient] || 0 : 0)
      );
    }, 0);
  };

  const consumedCarbs = calculateConsumedNutrient("carbs");
  const consumedProtein = calculateConsumedNutrient("protein");
  const consumedFat = calculateConsumedNutrient("fat");

  // Calculate target nutrients (from meal plan if available)
  let targetCarbs = 0;
  let targetProtein = 0;
  let targetFat = 0;

  // Extract target nutrients from meal plan if available
  if (todayMeal?.planId && (todayMeal.planId as any).meals) {
    const totalCaloriesStr = (todayMeal.planId as any).total_calories || "0";
    const totalCalories = parseInt(totalCaloriesStr.replace(/\D/g, "")) || 0;

    if (totalCalories > 0) {
      targetCarbs = Math.round((totalCalories * 0.5) / 4); // 50% of calories from carbs
      targetProtein = Math.round((totalCalories * 0.3) / 4); // 30% of calories from protein
      targetFat = Math.round((totalCalories * 0.2) / 9); // 20% of calories from fat
    }
  }

  // Calculate percentages
  const calculatePercentage = (consumed: number, target: number) => {
    return target > 0 ? Math.round((consumed / target) * 100) : 0;
  };

  const carbsPercentage = calculatePercentage(consumedCarbs, targetCarbs);
  const proteinPercentage = calculatePercentage(consumedProtein, targetProtein);
  const fatPercentage = calculatePercentage(consumedFat, targetFat);
  const overallPercentage = Math.round(
    (carbsPercentage + proteinPercentage + fatPercentage) / 3
  );

  // Add stats to response
  (todayMeal as any).stats = {
    carbs: {
      target: targetCarbs,
      consumed: consumedCarbs,
      percentage: carbsPercentage,
    },
    protein: {
      target: targetProtein,
      consumed: consumedProtein,
      percentage: proteinPercentage,
    },
    fat: {
      target: targetFat,
      consumed: consumedFat,
      percentage: fatPercentage,
    },
    overall: {
      percentage: overallPercentage,
    },
  };

  return {
    success: true,
    message: "Nutrition data retrieved successfully",
    data: {
      todayMeal,
    },
  };
};
export const updateMealTrackerService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { mealId, finishedMeal, data } = req.body;

  if (!data.carbs || !data.protein || !data.fat || !data.status) {
    return errorResponseHandler(
      "Invalid payload",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Validate payload
  if (!finishedMeal) {
    return errorResponseHandler(
      "finishedMeal is required", // Fixed typo from "fnishedMeal"
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Validate finishedMeal value
  const validMealTypes = ["first", "second", "third", "other"];
  if (!validMealTypes.includes(finishedMeal)) {
    return errorResponseHandler(
      "finishedMeal must be one of: first, second, third, other", // Added "other" to error message
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Get today's date at midnight for accurate comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create the update object dynamically
  const updateField = `${finishedMeal}MealStatus`;

  if (mealId) {
    // Code for users with meal ID remains the same
    const updatedMeal = await trackUserMealModel
      .findOneAndUpdate(
        {
          userId: userData.id,
          _id: mealId,
          planDay: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        {
          $set: { [updateField]: data },
        },
        { new: true }
      )
      .populate("planId");

    if (!updatedMeal) {
      return errorResponseHandler(
        "No meal tracking record found for today",
        httpStatusCode.NOT_FOUND,
        res
      );
    }

    return {
      success: true,
      message: "Meal status updated successfully",
      data: updatedMeal,
    };
  } else {
    // For users without a meal ID (no active plan)
    const checkExist = await trackUserMealModel
      .findOne({
        userId: userData.id,
        planDay: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      })
      .lean();

    let response;

    if (checkExist) {
      // Update existing record
      response = await trackUserMealModel.findOneAndUpdate(
        { _id: checkExist._id, userId: userData.id },
        {
          $set: {
            [updateField]: data,
          },
        },
        { new: true }
      );
    } else {
      // Create new record with initial meal data
      const initialData = {
        userId: userData.id,
        planId: null,
        planDay: today,
        [updateField]: data, // Set the specific meal data immediately
      };

      response = await trackUserMealModel.create(initialData);
    }

    return {
      success: true,
      message: "Meal status updated successfully",
      data: response,
    };
  }
};

//**************User Settings

export const getUserSettingsService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const user = await usersModel
    .findById(userData.id)
    .select("fullName email phoneNumber _id profilePic countryCode")
    .lean();

  const otherDetails = await healthDataModel
    .findOne({ userId: userData.id })
    .lean();

  if (!user) {
    return errorResponseHandler(
      "User not found",
      httpStatusCode.NOT_FOUND,
      res
    );
  }

  const membership = await userPlanModel
    .findOne({
      userId: userData.id,
      endDate: { $gte: new Date() },
    })
    .populate("planId")
    .select("autoPayment startDate endDate")
    .lean();

  console.log(membership);

  return {
    success: true,
    message: "User details retrieved successfully",
    data: {
      editProfile: { ...user, ...otherDetails?.otherDetails },
      mealReminder: otherDetails?.mealReminder,
      notification: otherDetails?.notification,
      membership: membership ? membership : {},
      language: otherDetails?.Language,
    },
  };
};

export const updateUserDetailsService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { gender, dob, age, height, weight, bmi } = req.body;

  await healthDataModel.findOneAndUpdate(
    { userId: userData.id },
    { otherDetails: { gender, dob, age, height, weight, bmi } },
    { upsert: true, new: true }
  );

  return {
    success: true,
    message: "Data updated successfully",
  };
};
export const updateSettingsService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { mealReminder } = req.body;

  await healthDataModel.findOneAndUpdate(
    { userId: userData.id },
    { mealReminder },
    { upsert: true, new: true }
  );

  return {
    success: true,
    message: "Data updated successfully",
  };
};

export const updateUserProfilePhotoService = async (
  req: Request,
  res: Response
) => {
  const userData = req.user as any;
  const userEmail = userData.email || (req.query.email as string);

  if (!userEmail) {
    return errorResponseHandler(
      "User email is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Check content type
  if (!req.headers["content-type"]?.includes("multipart/form-data")) {
    return errorResponseHandler(
      "Content-Type must be multipart/form-data",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Get existing user to check for previous profile image
  const existingUser = await usersModel.findById(userData.id);
  const previousImageKey = existingUser?.profilePic;

  const busboy = Busboy({ headers: req.headers });
  let uploadPromise: Promise<string> | null = null;

  busboy.on(
    "file",
    async (fieldname: string, fileStream: any, fileInfo: any) => {
      if (fieldname !== "image") {
        fileStream.resume(); // Skip this file
        return;
      }

      const { filename, mimeType } = fileInfo;

      const readableStream = new Readable();
      readableStream._read = () => {}; // Required implementation

      fileStream.on("data", (chunk: any) => {
        readableStream.push(chunk);
      });

      fileStream.on("end", () => {
        readableStream.push(null); // End of stream
      });

      uploadPromise = uploadStreamToS3Service(
        readableStream,
        filename,
        mimeType,
        userEmail
      );
    }
  );

  return new Promise((resolve) => {
    busboy.on("finish", async () => {
      if (!uploadPromise) {
        resolve({
          success: false,
          message: "No image file found in the request",
        });
        return;
      }

      const imageKey = await uploadPromise;

      // Update user profile with new image URL
      await usersModel.findByIdAndUpdate(
        userData.id,
        { profilePic: imageKey },
        { new: true }
      );

      // Delete previous image from S3 if it exists
      if (previousImageKey) {
        const s3Client = createS3Client();
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: previousImageKey,
        };
        try {
          await s3Client.send(new DeleteObjectCommand(deleteParams));
        } catch (deleteError) {
          console.error("Error deleting previous image:", deleteError);
          // Continue execution even if delete fails
        }
      }

      resolve({
        success: true,
        message: "Profile picture updated successfully",
        data: { imageKey },
      });
    });

    req.pipe(busboy);
  });
};

export const myProfileServices = async (req: Request, res: Response) => {
  const userData = req.user as any;

  const healthData = await healthDataModel
    .findOne({ userId: userData.id })
    .lean();

  const fastingMethod = healthData?.fastingMethod || "16:8";

  const fastingRecords = await fastingRecordModel
    .find({ userId: userData.id, isFasting: true })
    .sort({ date: -1 })
    .lean();

  const caloryIntake = await trackUserMealModel
    .find({ userId: userData.id })
    .lean();

  fastingRecords.forEach((record) => {
    const mealRecord = caloryIntake.find(
      (meal) => meal.planDay.toISOString().split("T")[0] === record.date
    );
    if (mealRecord) {
      (record as any).calories =
        mealRecord.firstMealStatus.carbs * 4 +
        mealRecord.firstMealStatus.protein * 4 +
        mealRecord.firstMealStatus.fat * 9 +
        mealRecord.secondMealStatus.carbs * 4 +
        mealRecord.secondMealStatus.protein * 4 +
        mealRecord.secondMealStatus.fat * 9 +
        mealRecord.thirdMealStatus.carbs * 4 +
        mealRecord.thirdMealStatus.protein * 4 +
        mealRecord.thirdMealStatus.fat * 9;
    }
  });

  const totalFasts = fastingRecords.length;

  const last7Fasts = fastingRecords.slice(0, 7);
  const averageLast7Fasts =
    last7Fasts.length > 0
      ? Math.round(
          last7Fasts.reduce(
            (sum, fast) =>
              sum + parseInt(fast.fastingHours?.toString() || "16"),
            0
          ) / 7
        )
      : 0;

  const longestFast =
    fastingRecords.length > 0
      ? Math.max(
          ...fastingRecords.map((fast) =>
            parseInt(fast.fastingHours?.toString() || "16")
          )
        )
      : 0;

  let currentStreak = 0;
  let longestStreak = 0;

  const today = new Date().toISOString().split("T")[0];

  if (fastingMethod === "5:2") {
    // --- 5:2 streak logic ---
    let weekOffset = 0;
    while (true) {
      const refDate = new Date();
      refDate.setUTCDate(refDate.getUTCDate() - weekOffset * 7);

      const weekStart = new Date(refDate);
      const day = weekStart.getUTCDay();
      weekStart.setUTCDate(weekStart.getUTCDate() - (day === 0 ? 6 : day - 1));
      weekStart.setUTCHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const weekStartISO = weekStart.toISOString().split("T")[0];
      const weekEndISO = weekEnd.toISOString().split("T")[0];

      const count = fastingRecords.filter(
        (record) => record.date >= weekStartISO && record.date <= weekEndISO
      ).length;

      if (count >= 2) {
        currentStreak++;
        weekOffset++;
      } else {
        break;
      }
    }

    longestStreak = currentStreak; // For 5:2, we use week-based streak only
  } else {
    // --- Daily streak logic (16:8 etc) ---
    let tempStreak = 0;
    for (let i = 0; i < fastingRecords.length; i++) {
      const currentDate = new Date(fastingRecords[i].date);
      const previousDate = i > 0 ? new Date(fastingRecords[i - 1].date) : null;

      if (i === 0 && currentDate.toISOString().split("T")[0] === today) {
        tempStreak = 1;
        currentStreak = 1;
      } else if (previousDate) {
        const diffDays = Math.floor(
          (previousDate.getTime() - currentDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          tempStreak++;
          if (i === 0) currentStreak = tempStreak;
        } else {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 1;
        }
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
  }

  const recentFasts = fastingRecords.slice(0, 10).map((fast) => ({
    date: fast.date,
    completed: true,
    calories: (fast as any)?.calories || 0,
    duration: parseInt(fast.fastingHours?.toString() || "16"),
  }));

  return {
    success: true,
    message: "User details retrieved successfully",
    data: {
      totalFasts,
      fastingMethod,
      averageLast7Fasts,
      longestFast,
      longestStreak,
      currentStreak,
      weight: healthData?.otherDetails?.weight || 0,
      bmi: healthData?.otherDetails?.bmi || 0,
      recentFasts,
    },
  };
};

export const getMealDateWiseServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { date } = req.query;

  if (!date) {
    return errorResponseHandler(
      "Date is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Convert date string to Date object
  const queryDateUTC = getDateMidnightUTC(new Date(date as string));
  const endDateUTC = new Date(queryDateUTC);
  endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);

  // Get meal information for the specified date
  const meal = await trackUserMealModel
    .findOne({
      userId: userData.id,
      planDay: {
        $gte: queryDateUTC,
        $lt: endDateUTC,
      },
    })
    .populate("planId")
    .lean();

  // Get water intake data for the specified date
  const waterRecords = await waterTrackerModel
    .find({
      userId: userData.id,
      date: {
        $gte: queryDateUTC,
        $lt: endDateUTC,
      },
    })
    .lean();

  // Calculate total water intake for the day
  const totalWaterIntake = waterRecords.reduce(
    (sum, record) => sum + (record.waterIntake || 0),
    0
  );

  // Get user's daily water intake goal
  const healthData = await healthDataModel
    .findOne({
      userId: userData.id,
    })
    .lean();

  const waterIntake = {
    consumed: totalWaterIntake,
    goal: healthData?.waterIntakeGoal?.dailyGoal || 0,
    progress: healthData?.waterIntakeGoal?.dailyGoal
      ? Math.round(
          (totalWaterIntake / healthData.waterIntakeGoal.dailyGoal) * 100
        )
      : 0,
    unit: healthData?.waterIntakeGoal?.unit || "ml",
    containerType: healthData?.waterIntakeGoal?.containerType || "glass",
    containerSize: healthData?.waterIntakeGoal?.containerSize || 0,
  };

  // If meal exists and has planId with meals, add status information to each meal
  if (meal && meal.planId && Array.isArray((meal.planId as any).meals)) {
    // Define interface for meal item
    interface MealItem {
      meal_time: string;
      items: string[];
      calories: string;
      _id: string;
      [key: string]: any; // Allow for additional properties
    }

    // Define interface for meal status
    interface MealStatus {
      carbs: number;
      protein: number;
      fat: number;
      status: boolean;
    }

    // Map meal times to status fields with proper typing
    const mealTimeToStatus: Record<string, MealStatus> = {
      "Meal 1 (12:00 PM - Main)": meal.firstMealStatus,
      "Meal 2 (3:00 PM - Snack)": meal.secondMealStatus,
      "Meal 3 (7:00 PM - Main)": meal.thirdMealStatus,
    };

    // Add status to each meal with proper typing
    (meal.planId as any).meals = (meal.planId as any).meals?.map(
      (mealItem: MealItem) => {
        // Find the corresponding status based on meal_time
        // Use type assertion to ensure TypeScript knows meal_time is a valid key
        const status =
          mealTimeToStatus[
            mealItem.meal_time as keyof typeof mealTimeToStatus
          ] || meal.otherMealStatus;

        // Return the meal with added status
        return {
          ...mealItem,
          mealStatus: status,
        };
      }
    );
  }

  return {
    success: true,
    message: "User details retrieved successfully",
    data: {
      meal,
      waterIntake,
    },
  };
};

export const changePasswordServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return errorResponseHandler(
      "Old password and new password are required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Find user with password
  const user = await usersModel.findById(userData.id).select("+password");

  if (!user) {
    return errorResponseHandler(
      "User not found",
      httpStatusCode.NOT_FOUND,
      res
    );
  }

  // Check if user is using email authentication
  if (user.authType !== "Email") {
    return errorResponseHandler(
      `Password cannot be changed. Please login with ${user.authType}`,
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Verify old password
  const isPasswordValid = await bcrypt.compare(
    oldPassword,
    user.password || ""
  );
  if (!isPasswordValid) {
    // Create notification for failed password change attempt
    await createSecurityNotification({
      userId: userData.id,
      title: "Failed Password Change Attempt",
      message:
        "There was an unsuccessful attempt to change your password. If this wasn't you, please secure your account.",
      deviceId: user?.deviceId || "", // Assuming you store device ID in user model
    });

    return errorResponseHandler(
      "Current password is incorrect",
      httpStatusCode.UNAUTHORIZED,
      res
    );
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await usersModel.findByIdAndUpdate(
    userData.id,
    { password: hashedPassword },
    { new: true }
  );

  // Create success notification
  await createSecurityNotification({
    userId: userData.id,
    title: "Password Changed Successfully",
    message:
      "Your password was successfully changed. If you didn't make this change, please contact support immediately.",
    deviceId: user?.deviceId || "",
  });

  return {
    success: true,
    message: "Password updated successfully",
  };
};

export const logoutUserServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return errorResponseHandler(
      "FCM token is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Remove the FCM token from the user's fcmToken array
  await usersModel.findByIdAndUpdate(
    userData.id,
    { $pull: { fcmToken } },
    { new: true }
  );

  return {
    success: true,
    message: "User logged out successfully",
  };
};

export const chatWithGPTServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { content } = req.body;

  if (!content) {
    return errorResponseHandler(
      "Message is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  try {
    // Save user's message first
    await chatModel.create([
      {
        userId: userData.id,
        role: "user",
        content,
      },
    ]);

    // Get the last 10 messages (5 exchanges) from the conversation history
    const chatHistory = await chatModel
      .find({ userId: userData.id, modelUsed: "gpt-4" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Reverse to get chronological order
    const conversationHistory = chatHistory.reverse();

    // Prepare messages array for OpenAI API with proper typing
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a supportive and confident AI coach for an intermittent fasting app. Your job is to guide users through their 16:8 fasting routine, improve their eating habits, suggest light workouts, boost their emotional resilience, and help them build a healthier lifestyle. Always reply in an encouraging and expert tone. You can respond to users to not ask questions from other topics.",
      },
      // Add conversation history with proper typing
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.content !== content
    ) {
      messages.push({
        role: "user",
        content,
      });
    }

    // Set up streaming response to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      temperature: 0.8,
      stream: true,
      max_tokens: 800,
    });

    let fullResponse = "";

    // Process each chunk from the stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
        fullResponse += content;
      }
    }

    // End the stream
    res.write("data: [DONE]\n\n");
    res.end();

    await chatModel.create([
      {
        userId: userData.id,
        role: "assistant",
        content: fullResponse,
      },
    ]);

    return true;
  } catch (err) {
    console.error("Error in chat stream:", err);
    if (!res.headersSent) {
      return errorResponseHandler(
        "Failed to send message",
        httpStatusCode.INTERNAL_SERVER_ERROR,
        res
      );
    } else {
      res.write(
        `data: ${JSON.stringify({ error: "Stream error occurred" })}\n\n`
      );
      res.end();
      return true;
    }
  }
};

export const chatHistoryServices = async (req: Request, res: Response) => {
  const userData = req.user as any;

  // Get pagination parameters from query
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Get total count for pagination metadata
  const totalCount = await chatModel.countDocuments({
    userId: userData.id,
    modelUsed: "gpt-4",
  });

  // Get paginated chat history
  const chatHistory = await chatModel
    .find({ userId: userData.id, modelUsed: "gpt-4" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    success: true,
    message: "Chat history retrieved successfully",
    data: chatHistory,
    pagination: {
      totalCount,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

export const getNutritionByImageServices = async (
  req: Request,
  res: Response
) => {
  const userData = req.user as any;
  const file = req.file;
  if (!file) {
    return errorResponseHandler(
      "Image file is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }
  const { imageUrl } = req.body;

  // if (!imageUrl) {
  //   return errorResponseHandler(
  //     "Image URL is required",
  //     httpStatusCode.BAD_REQUEST,
  //     res
  //   );
  // }

  try {
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString(
      "base64"
    )}`;
    // Call OpenAI API with the image
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Using vision model to analyze images
      messages: [
        {
          role: "system",
          content:
            "You are a nutritionist AI. Extract food items and estimate their calorie and protein content. Return structured JSON only with no text included. Example {carbs: in gms, protein: in gms, fat: in gms, microNutrients: {fiber: in mg, sugar: in mg, sodium: in mg, potassium: in mg, calcium: in mg, iron: in mg, vitaminA: in mg, vitaminC: in mg, vitaminD: in mg, vitaminE: in mg, vitaminK: in mg, vitaminB1: in mg, vitaminB2: in mg, vitaminB3: in mg}}",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Return a JSON by extracting nutritional information from the image in this format {carbs: in gms, protein: in gms, fat: in gms, status: true, microNutrients: {fiber: in mg, sugar: in mg, sodium: in mg, potassium: in mg, calcium: in mg, iron: in mg, vitaminA: in mg, vitaminC: in mg, vitaminD: in mg, vitaminE: in mg, vitaminK: in mg, vitaminB1: in mg, vitaminB2: in mg, vitaminB3: in mg}}",
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    // Extract the response content
    const content = response.choices[0].message.content;

    // Parse the JSON response
    let nutritionData;
    try {
      const jsonContent = content?.replace(/```json|```/g, "").trim();
      nutritionData = JSON.parse(jsonContent || "{}");
    } catch (parseError) {
      console.error("Error parsing nutrition data:", parseError);
      nutritionData = {
        carbs: 0,
        protein: 0,
        fat: 0,
        status: false,
        error: "Could not parse nutrition data",
      };
    }

    await chatModel.create({
      userId: userData.id,
      role: "user",
      modelUsed: "gpt-4-turbo",
      imageUrl: null,
      content: JSON.stringify(nutritionData),
    });

    return {
      success: true,
      message: "Nutrition data retrieved successfully",
      data: nutritionData,
    };
  } catch (error) {
    console.error("Error analyzing image:", error);
    return errorResponseHandler(
      "Failed to analyze food image",
      httpStatusCode.INTERNAL_SERVER_ERROR,
      res
    );
  }
};

export const getPrivacyAndContactSupportServices = async (
  req: Request,
  res: Response
) => {
  const type = req.query.type as string;

  if (!type) {
    return errorResponseHandler(
      "Type is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  if (type === "privacy") {
    const privacyPolicy = await privacyPolicyModel.findOne({ isActive: true });
    return {
      success: true,
      message: "Data retrieved successfully",
      data: privacyPolicy,
    };
  }

  if (type === "contact") {
    const contactSupport = await contactSupportModel.findOne({
      isActive: true,
    });
    return {
      success: true,
      message: "Data retrieved successfully",
      data: contactSupport,
    };
  }

  if (type === "termsCondition") {
    const termsCondition = await termConditionModel.findOne({ isActive: true });
    return {
      success: true,
      message: "Data retrieved successfully",
      data: termsCondition,
    };
  }
};

export const rateAppServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return errorResponseHandler(
      "Rating must be between 1 and 5",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const checkExistingRating = await ratingModel.findOne({
    userId: userData.id,
  });
  if (checkExistingRating) {
    return errorResponseHandler(
      "You have already rated the app",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  const data = await ratingModel.create({
    userId: userData.id,
    rating,
  });

  return {
    success: true,
    message: "Thank you for your feedback!",
    data,
  };
};
export const getRatingServices = async (req: Request, res: Response) => {
  const userData = req.user as any;

  const checkExistingRating = await ratingModel
    .findOne({
      userId: userData.id,
    })
    .select("rating");

  return {
    success: true,
    message: "Thank you for your feedback!",
    data: checkExistingRating,
  };
};

//*****************************FOR EQUIN APP *********************************/

/**
 * Helper function to check if a user has an active plan
 * @param userId User ID to check
 * @returns Active plan or null
 */
export const checkActivePlan = async (userId: string) => {
  const currentDate = getTodayUTC();

  // Find all plans for the user to debug
  const allPlans = await userPlanModel
    .find({
      userId,
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  console.log(`User ${userId} has ${allPlans.length} recent plans`);

  // Log details of each plan for debugging
  allPlans.forEach((plan) => {
    debugDateComparison(
      userId,
      plan._id.toString(),
      plan.startDate,
      plan.endDate,
      currentDate
    );
  });

  // Find active plan with proper date comparison
  const activePlan = await userPlanModel
    .findOne({
      userId,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
      paymentStatus: "success",
    })
    .populate("planId")
    .lean();

  return activePlan;
};
