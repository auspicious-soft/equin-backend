import { CronJob } from "cron";
import { trackUserMealModel } from "src/models/user/track-user-meal";
import { healthDataModel } from "../../models/user/health-data-schema";
import { waterTrackerModel } from "../../models/user/water-tracker-schema";
import { createNotification } from "./notification-service";

const getTodayUTC = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

const getTomorrowUTC = () => {
  const today = getTodayUTC();
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
};

export const checkAndSendWaterReminders = async () => {
  try {
    const startOfToday = getTodayUTC();
    const endOfToday = getTomorrowUTC();
    endOfToday.setUTCMilliseconds(endOfToday.getUTCMilliseconds() - 1);

    const usersWithReminders = await healthDataModel.find({
      waterReminder: true,
      "waterIntakeGoal.dailyGoal": { $gt: 0 },
    });

    const test = await healthDataModel
      .find({
        waterReminder: true,
        "waterIntakeGoal.dailyGoal": { $gt: 0 },
      })
      .lean();

    console.log("Users with water reminders:", test);

    for (const user of usersWithReminders) {
      // Get today's water intake
      const waterRecords = await waterTrackerModel.find({
        userId: user.userId,
        date: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      });

      if (!waterRecords || waterRecords.length === 0) {
        await createNotification({
          userId: user.userId,
          title: "Water Intake Reminder",
          message: `You have not started drinking water for today!`,
          type: "WATER_REMINDER",
          subType: "WATER_GOAL_REMINDER",
          priority: "MEDIUM",
        });
      } else {
        const totalWaterIntake = waterRecords.reduce(
          (sum, record) => sum + (record.waterIntake || 0),
          0
        );

        // If water intake is less than daily goal
        if (totalWaterIntake < user.waterIntakeGoal.dailyGoal) {
          const remainingWater =
            user.waterIntakeGoal.dailyGoal - totalWaterIntake;

          await createNotification({
            userId: user.userId,
            title: "Water Intake Reminder",
            message: `You still need to drink ${remainingWater}${user.waterIntakeGoal.unit} of water to reach your daily goal!`,
            type: "WATER_REMINDER",
            subType: "WATER_GOAL_REMINDER",
            priority: "MEDIUM",
          });
        }
      }
    }
  } catch (error) {
    console.error("Error sending water reminders:", error);
  }
};

export const checkAndSendMealReminders = async (currentMeal: any) => {
  try {
    if (!currentMeal) return; // Not a meal time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usersToRemind = await healthDataModel.find({
      mealReminder: true,
    });

    for (const user of usersToRemind) {
      // Check if meal is already logged
      const mealStatusField = `${currentMeal.meal}Status`; // firstMealStatus, secondMealStatus, thirdMealStatus

      const mealLogged = await trackUserMealModel.findOne({
        userId: user.userId,
        planDay: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        [`${mealStatusField}.status`]: true, // Check if meal status is marked as completed
      });

      if (!mealLogged) {
        console.log(
          "✅ Meal reminder for user:",
          user.userId,
          currentMeal.displayName
        );
        await createNotification({
          userId: user.userId,
          title: `Time for your ${currentMeal.displayName}`,
          message: `It's almost ${currentMeal.scheduledTime}! Don't forget to have and log your ${currentMeal.displayName}.`,
          type: "MEAL_REMINDER",
          subType: currentMeal.type,
          priority: "MEDIUM",
        });
      }
    }
  } catch (error) {
    console.error("Error sending meal reminders:", error);
  }
};

// Initialize cron jobs
export const initializeReminderCrons = () => {
  // Water reminders every 2 hours between 8 AM and 10 PM UTC

  new CronJob("0 8-22/2 * * *", checkAndSendWaterReminders, null, true, "UTC");
  const first = {
    start: 11, // These should be UTC hours
    end: 13,
    type: "FIRST_MEAL_REMINDER",
    displayName: "breakfast",
    scheduledTime: "12:00 PM",
  };
  const secondMeal = {
    start: 14,
    end: 16,
    type: "SNACK_REMINDER",
    displayName: "snack",
    scheduledTime: "3:00 PM",
  };
  const thirdMeal = {
    start: 18,
    end: 20,
    type: "SECOND_MEAL_REMINDER",
    displayName: "dinner",
    scheduledTime: "7:00 PM",
  };
  
  // new CronJob(
  //   "*/30 * * * * *",
  //   () => checkAndSendMealReminders(first),
  //   null,
  //   true,
  //   "UTC"
  // );

  // First meal reminder at 11:30 AM UTC
  new CronJob(
    "0 30 11 * * *",
    () => checkAndSendMealReminders(first),
    null,
    true,
    "UTC"
  );

  // Second meal (snack) reminder at 2:30 PM UTC
  new CronJob(
    "0 30 14 * * *",
    () => checkAndSendMealReminders(secondMeal),
    null,
    true,
    "UTC"
  );

  // Third meal reminder at 6:30 PM UTC
  new CronJob(
    "0 30 18 * * *",
    () => checkAndSendMealReminders(thirdMeal),
    null,
    true,
    "UTC"
  );
};
