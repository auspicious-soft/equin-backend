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
import { createSecurityNotification } from '../admin/notification-service';

import bcrypt from "bcryptjs";


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
        },
        waterReminder: waterReminder
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

  // Get today's date in YYYY-MM-DD format
  const today = new Date();

  const waterData = await healthDataModel.findOne({ userId: userData.id });

  if (!waterData?.waterIntakeGoal?.dailyGoal) {
    return errorResponseHandler(
      "Water intake goal not set",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

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

//*************My Plan Page APIS

export const myPlanService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const currentDate = new Date();

  let mealTracking;
  let mealPlan;

  const [activePlan, essentialTips] = await Promise.all([
    userPlanModel
      .findOne({
        userId: userData.id,
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate },
      })
      .populate("planId")
      .lean(),

    essentialTipModel
      .find({
        isActive: true,
        publishDate: { $lte: currentDate },
      })
      .sort({ publishDate: -1 })
      .limit(5),
  ]);

  if (activePlan) {
    const checkMealTracker = await trackUserMealModel.find({
      userId: userData.id,
    });

    if (checkMealTracker.length === 0) {
      // Get the meal plan based on user's gender
      const mealPlans = await mealPlanModel30.find({
        plan_type: userData.gender === "Male" ? "Men" : "Women",
      });

      // Calculate total days between start and end date
      const startDate = new Date(activePlan.startDate || currentDate);
      const endDate = new Date(activePlan.endDate || currentDate);
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
      );

      // Create bulk entries array
      const bulkEntries = [];

      // Loop through each day from start to end date
      for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        // Get the corresponding meal plan (cycling through 30 days)
        const dayIndex = i % 30; // This will cycle from 0 to 29
        const mealPlan = mealPlans.find((plan) => plan.day === dayIndex + 1);

        if (mealPlan) {
          bulkEntries.push({
            userId: userData.id,
            planId: mealPlan._id,
            planDay: currentDate,
          });
        }
      }

      if (bulkEntries.length > 0) {
        await trackUserMealModel.insertMany(bulkEntries);
      }
    }
    // Get today's date at midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    const twoDaysAhead = new Date(today);
    twoDaysAhead.setDate(today.getDate() + 2);

    // Find records within the 5-day range
    const fiveDayMealTracker = await trackUserMealModel
      .find({
        userId: userData.id,
        planDay: {
          $gte: twoDaysAgo,
          $lte: twoDaysAhead,
        },
      })
      .sort({ planDay: 1 })
      .populate("planId");

    mealTracking = fiveDayMealTracker;
  } else {
    mealTracking = null;
    mealPlan = await pricePlanModel.find();
  }

  return {
    success: true,
    message: activePlan ? "Active plan found" : "No active plan found",
    data: {
      hasActivePlan: mealTracking ? true : false,
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
  const currentDate = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check for active plan
  const activePlan = await userPlanModel.findOne({
    userId: userData.id,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate },
  }).populate("planId").lean();

  let todayMeal;

  if(activePlan){
    todayMeal = await trackUserMealModel.findOne({
      userId: userData.id,
      planDay: {
        $gte: today,
        $lt: tomorrow
      }
    }).lean();

  }else{
    todayMeal = await trackUserMealModel.findOne({
      userId: userData.id,
      planDay: {
        $gte: today,
        $lt: tomorrow
      }
    }).lean();

    if(!todayMeal){
      todayMeal = await trackUserMealModel.create({
        userId: userData.id,
        planDay: today
      })
    }
  }

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
  if (!mealId || !finishedMeal) {
    return errorResponseHandler(
      "mealId and finishedMeal are required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Validate finishedMeal value
  const validMealTypes = ["first", "second", "third", "other"];
  if (!validMealTypes.includes(finishedMeal)) {
    return errorResponseHandler(
      "finishedMeal must be one of: first, second, third",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Get today's date at midnight for accurate comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create the update object dynamically
  const updateField = `${finishedMeal}MealStatus`;

  // Find and update the meal tracking record
  const updatedMeal = await trackUserMealModel
    .findOneAndUpdate(
      {
        userId: userData.id,
        _id: mealId,
        planDay: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Less than tomorrow
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
};

//**************User Settings

export const getUserSettingsService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const user = await usersModel
    .findById(userData.id)
    .select("fullName email phoneNumber _id profilePic")
    .lean();

  const otherDetails = await healthDataModel.findOne({ userId: userData.id });

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
      notification: false,
      membership: membership ? membership : {},
      language: otherDetails?.Language,
    },
  };
};

export const updateUserDetailsService = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { gender, dob, age, height, weight, bmi, profilePic } = req.body;
  await usersModel.findByIdAndUpdate(
    userData.id,
    { profilePic },
    { new: true }
  );

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

export const myProfileServices = async (req: Request, res: Response) => {
  const userData = req.user as any;

  // Get health data for weight and BMI
  const healthData = await healthDataModel
    .findOne({
      userId: userData.id,
    })
    .lean();

  // Get all fasting records for the user
  const fastingRecords = await fastingRecordModel
    .find({
      userId: userData.id,
      isFasting: true,
    })
    .sort({ date: -1 })
    .lean();

  // Calculate total fasts
  const totalFasts = fastingRecords.length;

  // Calculate average of last 7 fasts in hours
  const last7Fasts = fastingRecords.slice(0, 7);
  const averageLast7Fasts = last7Fasts.length > 0
    ? Math.round(
        last7Fasts.reduce((sum, fast) => sum + (parseInt(fast.fastingHours?.toString() || '16')), 0) / 
        last7Fasts.length
      )
    : 0;

  // Find longest fast in hours
  const longestFast = fastingRecords.length > 0
    ? Math.max(...fastingRecords.map(fast => parseInt(fast.fastingHours?.toString() || '16')))
    : 0;

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  if (fastingRecords.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < fastingRecords.length; i++) {
      const currentDate = new Date(fastingRecords[i].date);
      const previousDate = i > 0 ? new Date(fastingRecords[i - 1].date) : null;
      
      if (i === 0 && currentDate.toISOString().split('T')[0] === today) {
        tempStreak = 1;
        currentStreak = 1;
      } else if (previousDate) {
        const diffDays = Math.floor(
          (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (diffDays === 1) {
          tempStreak++;
          if (i === 0) {
            currentStreak = tempStreak;
          }
        } else {
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
    }
    
    // Check one last time for the longest streak
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }

  // Get recent fasts (last 5 records)
  const recentFasts = fastingRecords.slice(0, 5).map(fast => ({
    date: fast.date,
    completed: true,
    duration: parseInt(fast.fastingHours?.toString() || '16')
  }));

  return {
    success: true,
    message: "User details retrieved successfully",
    data: {
      totalFasts,
      averageLast7Fasts,
      longestFast,
      longestStreak,
      currentStreak,
      weight: healthData?.otherDetails?.weight || 0,
      bmi: healthData?.otherDetails?.bmi || 0,
      recentFasts
    },
  };
};

export const getMealDateWiseServices = async (req: Request, res: Response) => {
  const userData = req.user as any;
  const { date } = req.body;

  if (!date) {
    return errorResponseHandler(
      "Date is required",
      httpStatusCode.BAD_REQUEST,
      res
    );
  }

  // Convert date string to Date object
  const queryDate = new Date(date);
  queryDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  // Get meal information for the specified date
  const meal = await trackUserMealModel
    .findOne({
      userId: userData.id,
      planDay: {
        $gte: queryDate,
        $lte: endDate
      }
    })
    .populate('planId')
    .lean();

  // Get water intake data for the specified date
  const waterRecords = await waterTrackerModel.find({
    userId: userData.id,
    date: {
      $gte: queryDate,
      $lte: endDate
    }
  }).lean();

  // Calculate total water intake for the day
  const totalWaterIntake = waterRecords.reduce(
    (sum, record) => sum + (record.waterIntake || 0),
    0
  );

  // Get user's daily water intake goal
  const healthData = await healthDataModel.findOne({
    userId: userData.id
  }).lean();

  const waterIntake = {
    consumed: totalWaterIntake,
    goal: healthData?.waterIntakeGoal?.dailyGoal || 0,
    progress: healthData?.waterIntakeGoal?.dailyGoal 
      ? Math.round((totalWaterIntake / healthData.waterIntakeGoal.dailyGoal) * 100)
      : 0,
    unit: healthData?.waterIntakeGoal?.unit || 'ml',
    containerType: healthData?.waterIntakeGoal?.containerType || 'glass',
    containerSize: healthData?.waterIntakeGoal?.containerSize || 0
  };

  return {
    success: true,
    message: "User details retrieved successfully",
    data: {
      meal,
      waterIntake
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
  const isPasswordValid = await bcrypt.compare(oldPassword, user.password || "");
  if (!isPasswordValid) {
    // Create notification for failed password change attempt
    await createSecurityNotification({
      userId: userData.id,
      title: "Failed Password Change Attempt",
      message: "There was an unsuccessful attempt to change your password. If this wasn't you, please secure your account.",
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
    message: "Your password was successfully changed. If you didn't make this change, please contact support immediately.",
    deviceId: user?.deviceId || "",
  });

  return {
    success: true,
    message: "Password updated successfully",
  };
}

//*****************************FOR EQUIN APP *********************************/
