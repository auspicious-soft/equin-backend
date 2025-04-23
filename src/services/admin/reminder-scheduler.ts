import { CronJob } from "cron";
import { trackUserMealModel } from "src/models/user/track-user-meal";
import { healthDataModel } from "../../models/user/health-data-schema";
import { waterTrackerModel } from "../../models/user/water-tracker-schema";
import { createNotification } from "./notification-service";

export const checkAndSendWaterReminders = async () => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const usersWithReminders = await healthDataModel.find({
      waterReminder: true,
      "waterIntakeGoal.dailyGoal": { $gt: 0 },
      deviceId: { $exists: true, $ne: null },
    });

    for (const user of usersWithReminders) {
      // Get today's water intake
      const waterRecords = await waterTrackerModel.find({
        userId: user.userId,
        date: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      });

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
          deviceId: user.deviceId,
        });
      }
    }
  } catch (error) {
    console.error("Error sending water reminders:", error);
  }
};

export const checkAndSendMealReminders = async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours();

    // Define meal times
    const mealTimes = {
      firstMeal: {
        start: 11,
        end: 13,
        type: "FIRST_MEAL_REMINDER",
        displayName: "breakfast",
        scheduledTime: "12:00 PM",
      },
      secondMeal: {
        start: 14,
        end: 16,
        type: "SNACK_REMINDER",
        displayName: "snack",
        scheduledTime: "3:00 PM",
      },
      thirdMeal: {
        start: 18,
        end: 20,
        type: "SECOND_MEAL_REMINDER",
        displayName: "dinner",
        scheduledTime: "7:00 PM",
      },
    };

    // Determine which meal to check based on current time
    let currentMeal = null;
    for (const [meal, time] of Object.entries(mealTimes)) {
      if (currentHour >= time.start && currentHour <= time.end) {
        currentMeal = { meal, ...time };
        break;
      }
    }

    if (!currentMeal) return; // Not a meal time

    // Get users who haven't logged their meal
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Modified query to include subscription check
    const usersToRemind = await healthDataModel.aggregate([
      {
        $match: {
          mealReminder: true,
          deviceId: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: "userplans", // Collection name is typically lowercase
          localField: "userId",
          foreignField: "userId",
          as: "subscription"
        }
      },
      {
        $match: {
          "subscription": { 
            $elemMatch: { 
              endDate: { $gt: new Date() },
              paymentStatus: { $nin: ["pending", "expired", "failed"] }
            }
          }
        }
      }
    ]);

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
        await createNotification({
          userId: user.userId,
          title: `Time for your ${currentMeal.displayName}`,
          message: `It's almost ${currentMeal.scheduledTime}! Don't forget to have and log your ${currentMeal.displayName}.`,
          type: "MEAL_REMINDER",
          subType: currentMeal.type,
          priority: "MEDIUM",
          deviceId: user.deviceId,
        });
      }
    }
  } catch (error) {
    console.error("Error sending meal reminders:", error);
  }
};

// Initialize cron jobs
export const initializeReminderCrons = () => {
  // Water reminders every 2 hours between 8 AM and 10 PM
  new CronJob("0 8-22/2 * * *", checkAndSendWaterReminders, null, true);

  // First meal reminder at 11:30 AM (30 minutes before scheduled time)
  new CronJob("0 30 11 * * *", checkAndSendMealReminders, null, true);

  // Second meal (snack) reminder at 2:30 PM
  new CronJob("0 30 14 * * *", checkAndSendMealReminders, null, true);

  // Third meal reminder at 6:30 PM
  new CronJob("0 30 18 * * *", checkAndSendMealReminders, null, true);
};


