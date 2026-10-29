import { Request, Response } from 'express';
import { medicationAdherence } from '../services/medicationAdherence.js';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { DEFAULT_WATER_GOAL_UNIT, getDefaultWaterGoalAmount } from '../utils/waterGoal.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();
const DEFAULT_WATER_GOAL_ML = 2500;

const getDefaultWaterGoal = async () => {
  const setting = await prisma.appSetting.findFirst({
    where: {
      key: 'daily_water_goal_ml',
      scope: 'user',
    },
  });

  const parsedValue = setting?.value ? Number(setting.value) : NaN;

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_WATER_GOAL_ML;
};

// Helper function to get userId from token
const getUserIdFromToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
};

// ============================================================
// 1. CALORIES INTAKE AGGREGATION
// GET /api/progress/calories-intake?date=YYYY-MM-DD
// GET /api/progress/calories-intake?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns total calories consumed for date/range from active diet plan meals
// ============================================================
export const getCaloriesIntake = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { date, startDate, endDate } = req.query;

    // The app sends the user's local day; meal and food logs are stored against it.
    const dayKey = /^\d{4}-\d{2}-\d{2}$/;
    const dayStr = typeof date === 'string' && date ? date : new Date().toISOString().split('T')[0];
    const day = new Date(dayStr);
    // A range (Weekly/Monthly on Progress) totals what was eaten across those local days.
    const isRange = typeof startDate === 'string' && dayKey.test(startDate) && typeof endDate === 'string' && dayKey.test(endDate);
    const firstDay = isRange ? new Date(startDate as string) : day;
    const lastDay = isRange ? new Date(endDate as string) : day;

    // Cheat meals store a timestamp, not a day. The app sends its UTC offset
    // (Date#getTimezoneOffset, minutes) so they're counted on the user's local day.
    const offsetParam = Number(req.query.tzOffset);
    const tzOffsetMinutes = Number.isFinite(offsetParam) && Math.abs(offsetParam) <= 14 * 60 ? offsetParam : 0;
    const localDayStart = new Date(firstDay.getTime() + tzOffsetMinutes * 60000);
    const localDayEnd = new Date(lastDay.getTime() + tzOffsetMinutes * 60000 + 86400000);

    // Consumed: plan meals the user checked off, food logged outside the plan,
    // and cheat-day meals.
    const days = { gte: firstDay, lte: lastDay };
    const [mealLogs, foodLogs, cheatMeals] = await Promise.all([
      prisma.dietMealLog.findMany({ where: { userId, date: days }, select: { calories: true, mealId: true, date: true } }),
      prisma.foodLog.findMany({
        where: { userId, date: days },
        select: { calories: true, protein: true, carbs: true, fat: true, date: true },
      }),
      prisma.cheatDay.findMany({
        where: { userId, loggedAt: { gte: localDayStart, lt: localDayEnd } },
        select: { calories: true, protein: true, carbs: true, fat: true, loggedAt: true },
      }),
    ]);
    const sum = (values: Array<number | null>) => values.reduce<number>((total, value) => total + (value || 0), 0);
    const round1 = (value: number) => Math.round(value * 10) / 10;
    const foodLogCalories = sum(foodLogs.map((log) => log.calories));
    const cheatMealCalories = sum(cheatMeals.map((meal) => meal.calories));
    // Eaten on the day, or across the whole range.
    const consumedCalories = sum(mealLogs.map((log) => log.calories)) + foodLogCalories + cheatMealCalories;
    // Calories eaten on one local day of the range (YYYY-MM-DD).
    const localKey = (moment: Date) => new Date(moment.getTime() - tzOffsetMinutes * 60000).toISOString().slice(0, 10);
    const consumedOn = (key: string) =>
      sum(mealLogs.filter((log) => log.date.toISOString().slice(0, 10) === key).map((log) => log.calories))
      + sum(foodLogs.filter((log) => log.date.toISOString().slice(0, 10) === key).map((log) => log.calories))
      + sum(cheatMeals.filter((meal) => meal.loggedAt && localKey(meal.loggedAt) === key).map((meal) => meal.calories));
    const loggedMealIds = mealLogs.map((log) => log.mealId);
    const withMacros = [...foodLogs, ...cheatMeals];
    const macros = {
      protein: round1(sum(withMacros.map((log) => log.protein))),
      carbs: round1(sum(withMacros.map((log) => log.carbs))),
      fat: round1(sum(withMacros.map((log) => log.fat))),
    };

    // Get user's active diet plan
    const activeDietPlan = await prisma.userActiveDietPlan.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        diet: {
          include: {
            dietPlanDays: {
              include: {
                dietPlanMeals: {
                  include: {
                    mealType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!activeDietPlan) {
      return res.status(200).json({
        success: true,
        data: {
          totalCalories: consumedCalories,
          foodLogCalories,
          cheatMealCalories,
          macros,
          planCalorieTarget: 0,
          loggedMealIds,
          dailyBreakdown: [],
          activePlan: null,
          message: 'No active diet plan found',
        },
      });
    }

    // Calculate current day in the diet plan
    const planStartDate = new Date(activeDietPlan.startedAt);
    const today = date ? new Date(date as string) : new Date();
    const diffTime = Math.abs(today.getTime() - planStartDate.getTime());
    const currentDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Get the diet plan day for the current day (used for planned meal display)
    const currentDayPlan = activeDietPlan.diet.dietPlanDays.find(
      (day) => day.dayNumber === (activeDietPlan.currentDay || currentDay)
    );

    // Planned meals for today (shown in "Today's Plan" section)
    const mealBreakdown: Array<{
      mealType: string;
      mealName: string;
      calories: number;
      portionSize: string | null;
      image: string | null;
    }> = [];

    if (currentDayPlan) {
      for (const meal of currentDayPlan.dietPlanMeals) {
        mealBreakdown.push({
          mealType: meal.mealType.name,
          mealName: meal.name,
          calories: meal.calories || 0,
          portionSize: meal.portionSize,
          image: meal.image,
        });
      }
    }

    // Per day of the range: calories actually eaten, next to that plan day's meals.
    // (This used to add up the plan's prescribed calories instead of what was eaten.)
    const dailyBreakdown: Array<{
      day: number;
      calories: number;
      meals: typeof mealBreakdown;
    }> = [];

    if (isRange) {
      const rangeDays = Math.round((lastDay.getTime() - firstDay.getTime()) / 86400000) + 1;

      for (let i = 0; i < rangeDays; i++) {
        const dayStart = new Date(firstDay.getTime() + i * 86400000);
        const dayNum = Math.ceil((dayStart.getTime() - planStartDate.getTime()) / 86400000) + 1;
        const dayPlan = activeDietPlan.diet.dietPlanDays.find((d) => d.dayNumber === dayNum);
        const dayMeals: typeof mealBreakdown = (dayPlan?.dietPlanMeals ?? []).map((meal) => ({
          mealType: meal.mealType.name,
          mealName: meal.name,
          calories: meal.calories || 0,
          portionSize: meal.portionSize,
          image: meal.image,
        }));

        dailyBreakdown.push({ day: dayNum, calories: consumedOn(dayStart.toISOString().slice(0, 10)), meals: dayMeals });
      }
    } else {
      dailyBreakdown.push({
        day: activeDietPlan.currentDay || currentDay,
        calories: consumedCalories,
        meals: mealBreakdown,
      });
    }

    // Get the overall plan calorie target
    const planCalorieTarget = activeDietPlan.diet.calories || 0;

    res.status(200).json({
      success: true,
      data: {
        // For a range this is everything eaten across it (the queries above cover the whole range).
        totalCalories: consumedCalories,
        foodLogCalories,
        cheatMealCalories,
        macros,
        planCalorieTarget,
        currentDay: activeDietPlan.currentDay,
        mealBreakdown,
        loggedMealIds,
        dailyBreakdown,
        activePlan: {
          id: activeDietPlan.id,
          name: activeDietPlan.diet.name,
          dietId: activeDietPlan.dietId,
          startedAt: activeDietPlan.startedAt,
        },
      },
      message: 'Calories intake retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching calories intake:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calories intake',
    });
  }
};

// ============================================================
// 2. EXERCISE ACTIVE DAYS - WEEKLY SUMMARY
// GET /api/progress/exercise-active-days?weekOffset=0
// Returns which days the user was active in a given week
// ============================================================
export const getExerciseActiveDays = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const weekOffset = parseInt((req.query.weekOffset as string) || '0', 10);

    // The week (Sunday to Saturday) and its days are the user's local ones. The app sends
    // its UTC offset (Date#getTimezoneOffset, minutes); without it the server's own is used.
    const offsetParam = Number(req.query.tzOffset);
    const tzOffsetMinutes = Number.isFinite(offsetParam) && Math.abs(offsetParam) <= 14 * 60
      ? offsetParam
      : new Date().getTimezoneOffset();
    const shift = tzOffsetMinutes * 60000;
    const localNow = new Date(Date.now() - shift); // UTC fields read as the user's local clock
    const weekStartLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - localNow.getUTCDay() - weekOffset * 7);
    const startOfWeek = new Date(weekStartLocal + shift);
    const endOfWeek = new Date(weekStartLocal + 7 * 86400000 + shift - 1);

    // Get user's exercise progress for this week
    const exerciseProgress = await prisma.userExerciseProgress.findMany({
      where: {
        userId,
        completed: true,
        completedAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: {
        completedAt: true,
        exerciseSchedule: {
          select: {
            dayOfWeek: true,
            exercise: {
              select: {
                name: true,
                caloriesBurnEstimate: true,
              },
            },
          },
        },
      },
    });

    // Also check user daily routines for exercise activity
    const dailyRoutines = await prisma.userDailyRoutine.findMany({
      where: {
        userId,
        // Calendar dates, so compare by day rather than the week's timestamps.
        routinesDate: {
          gte: new Date(weekStartLocal),
          lte: new Date(weekStartLocal + 6 * 86400000),
        },
      },
      select: {
        routinesDate: true,
      },
    });

    // Build a day-by-day summary
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekDays = dayNames.map((dayName, index) => {
      const dayStart = startOfWeek.getTime() + index * 86400000;
      const dayKey = new Date(weekStartLocal + index * 86400000).toISOString().slice(0, 10);

      // Exercises completed during this local day
      const completedOnDay = exerciseProgress.filter((p) => {
        if (!p.completedAt) return false;
        const at = new Date(p.completedAt).getTime();
        return at >= dayStart && at < dayStart + 86400000;
      });

      // Routines are stored against the local calendar day
      const hadRoutine = dailyRoutines.some((r) => r.routinesDate?.toISOString().slice(0, 10) === dayKey);

      return {
        day: dayName,
        date: dayKey,
        isActive: completedOnDay.length > 0 || hadRoutine,
        exercisesCompleted: completedOnDay.length,
        exercises: completedOnDay.map((p) => ({
          name: p.exerciseSchedule.exercise.name,
          caloriesBurned: p.exerciseSchedule.exercise.caloriesBurnEstimate,
        })),
      };
    });

    const activeDaysCount = weekDays.filter((d) => d.isActive).length;
    const totalExercisesCompleted = weekDays.reduce((sum, d) => sum + d.exercisesCompleted, 0);

    res.status(200).json({
      success: true,
      data: {
        weekStart: weekDays[0].date,
        weekEnd: weekDays[6].date,
        activeDaysCount,
        totalDays: 7,
        totalExercisesCompleted,
        weekDays,
        activePercentage: Math.round((activeDaysCount / 7) * 100),
      },
      message: 'Exercise active days retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching exercise active days:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exercise active days',
    });
  }
};

// ============================================================
// 3. MEDICATION STATS
// GET /api/progress/medication-stats
// Returns medication adherence/completion statistics
// ============================================================
export const getMedicationStats = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { period = '30' } = req.query; // days to look back
    const daysBack = Math.min(365, Math.max(1, parseInt(period as string, 10) || 30));
    // The user's local day (?date=YYYY-MM-DD); intakes are recorded against it.
    const statsToday = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().split('T')[0];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    // Get all user medications
    const medications = await prisma.medication.findMany({
      where: { userId },
      include: {
        medicationReminders: {
          where: { userId },
        },
      },
    });

    const doses = await medicationAdherence(userId, daysBack, statsToday);

    if (medications.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalMedications: 0,
          overallAdherencePercent: 0,
          medicationBreakdown: [],
          doses,
          summary: {
            taken: 0,
            skipped: 0,
            missed: 0,
            upcoming: 0,
          },
        },
        message: 'No medications found',
      });
    }

    // Calculate stats for each medication
    const medicationBreakdown = medications.map((med) => {
      const reminders = med.medicationReminders;
      const totalReminders = reminders.length;
      const enabledReminders = reminders.filter((r) => r.enabled).length;
      const disabledReminders = totalReminders - enabledReminders;

      // Calculate expected doses based on frequency
      let expectedDoses = 0;
      switch (med.frequency?.toLowerCase()) {
        case 'daily':
        case 'once daily':
          expectedDoses = daysBack;
          break;
        case 'twice daily':
          expectedDoses = daysBack * 2;
          break;
        case 'three times daily':
          expectedDoses = daysBack * 3;
          break;
        case 'weekly':
          expectedDoses = Math.ceil(daysBack / 7);
          break;
        case 'as needed':
          expectedDoses = 0;
          break;
        default:
          expectedDoses = daysBack;
      }

      // Adherence estimation based on active reminders
      const adherencePercent =
        totalReminders > 0 ? Math.round((enabledReminders / totalReminders) * 100) : 0;

      return {
        id: med.id,
        name: med.name,
        dose: med.dose,
        frequency: med.frequency,
        quantity: med.quantity,
        adherencePercent,
        totalReminders,
        enabledReminders,
        disabledReminders,
        expectedDoses,
        icon: med.icon,
        appearanceColor: med.appearanceColor,
        appearanceIcon: med.appearanceIcon,
      };
    });

    // Overall stats
    const totalMedications = medications.length;
    // Adherence = doses taken out of doses due (taken + skipped + missed).
    const overallAdherence = doses.takenPercent;

    // Summary counts
    const activeMeds = medications.filter((m) =>
      m.medicationReminders.some((r) => r.enabled)
    ).length;
    const inactiveMeds = totalMedications - activeMeds;

    res.status(200).json({
      success: true,
      data: {
        totalMedications,
        overallAdherencePercent: overallAdherence,
        periodDays: daysBack,
        medicationBreakdown,
        doses,
        summary: {
          taken: doses.taken,
          skipped: doses.skipped,
          missed: doses.missed,
          active: activeMeds,
          inactive: inactiveMeds,
          total: totalMedications,
          activePercent: Math.round((activeMeds / totalMedications) * 100),
          inactivePercent: Math.round((inactiveMeds / totalMedications) * 100),
        },
      },
      message: 'Medication stats retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching medication stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medication stats',
    });
  }
};

// ============================================================
// 4. CHALLENGES COMPLETED / USER PROGRESS
// GET /api/progress/challenges
// Returns user's challenge completion status
// ============================================================
export const getUserChallengeProgress = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Get all challenges the user has joined
    const userChallenges = await prisma.userChallenge.findMany({
      where: { userId },
      include: {
        challenge: {
          include: {
            challengeExercises: {
              include: {
                exercise: {
                  select: {
                    id: true,
                    name: true,
                    duration: true,
                  },
                },
              },
            },
            challengeDiets: {
              include: {
                diet: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        fee: true,
      },
    });

    // Get all available challenges for context
    const totalChallenges = await prisma.challenge.count({
      where: { status: 'ACTIVE' },
    });

    // Completed = the user finished it (a challenge's own status is set by admins for everyone)
    const completedChallenges = userChallenges.filter((uc) => uc.completedAt).length;

    // In progress = joined and not finished yet
    const inProgressChallenges = userChallenges.length - completedChallenges;

    // Detailed breakdown per challenge
    const challengeDetails = userChallenges.map((uc) => ({
      id: uc.id,
      challengeId: uc.challengeId,
      challengeName: uc.challenge?.name || 'Unknown',
      status: uc.challenge?.status || 'Unknown',
      joinedAt: uc.joinedAt,
      exerciseCount: uc.challenge?.challengeExercises.length || 0,
      dietCount: uc.challenge?.challengeDiets.length || 0,
      exercises: uc.challenge?.challengeExercises.map((ce) => ({
        id: ce.exercise.id,
        name: ce.exercise.name,
        duration: ce.exercise.duration,
      })) || [],
      diets: uc.challenge?.challengeDiets.map((cd) => ({
        id: cd.diet.id,
        name: cd.diet.name,
      })) || [],
      feePaid: uc.fee
        ? {
            amount: uc.fee.amount,
            method: uc.fee.method,
            status: uc.fee.status,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalJoined: userChallenges.length,
        completedCount: completedChallenges,
        inProgressCount: inProgressChallenges,
        totalAvailableChallenges: totalChallenges,
        completionPercentage:
          userChallenges.length > 0
            ? Math.round((completedChallenges / userChallenges.length) * 100)
            : 0,
        challenges: challengeDetails,
      },
      message: 'User challenge progress retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching user challenge progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user challenge progress',
    });
  }
};

// ============================================================
// 5. FULL PROGRESS SCREEN / DASHBOARD SUMMARY
// GET /api/progress/summary
// Returns all progress data in one aggregated response
// ============================================================
export const getProgressSummary = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Run all queries in parallel for efficiency
    // Prefer the client's local calendar day (?date=YYYY-MM-DD); the server's UTC
    // day disagrees with the user's for several hours around local midnight.
    const requestedDate = typeof req.query.date === 'string' ? req.query.date : '';
    const todaySummaryStr = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && !Number.isNaN(Date.parse(requestedDate))
      ? requestedDate
      : new Date().toISOString().split('T')[0];
    const todaySummaryStart = new Date(todaySummaryStr);
    const todaySummaryEnd = new Date(todaySummaryStart.getTime() + 86400000);

    const [
      activeDietPlan,
      exerciseProgress,
      medications,
      userChallenges,
      waterGoal,
      todayWaterIntake,
      defaultWaterGoalAmount,
      recentSleepLog,
      recentFastingLog,
      todayMealLogs,
      todayFoodLogs,
      activeExercisePlan,
      medicationDoses,
    ] = await Promise.all([
      // Active diet plan with meals
      prisma.userActiveDietPlan.findFirst({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        include: {
          diet: {
            include: {
              dietPlanDays: {
                include: {
                  dietPlanMeals: true,
                },
              },
            },
          },
        },
      }),

      // Exercise progress (last 7 days)
      prisma.userExerciseProgress.findMany({
        where: {
          userId,
          completed: true,
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Medications
      prisma.medication.findMany({
        where: { userId },
        include: {
          medicationReminders: { where: { userId } },
        },
      }),

      // User challenges
      prisma.userChallenge.findMany({
        where: { userId },
        include: {
          challenge: true,
        },
      }),

      // Water goal
      prisma.userWaterGoal.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),

      // Today's water intake
      prisma.waterIntakeLog.findMany({
        where: {
          userId,
          date: {
            gte: todaySummaryStart,
            lt: todaySummaryEnd,
          },
        },
      }),

      getDefaultWaterGoal(),

      // Most recent sleep log
      prisma.sleepLog.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
      }),

      // Most recent fasting log
      prisma.fastingLog.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
      }),

      (prisma as any).dietMealLog.findMany({
        where: {
          userId,
          date: {
            gte: todaySummaryStart,
            lt: todaySummaryEnd,
          },
        },
        select: {
          calories: true,
        },
      }) as Promise<Array<{ calories: number | null }>>,

      prisma.foodLog.findMany({
        where: { userId, date: { gte: todaySummaryStart, lt: todaySummaryEnd } },
        select: { calories: true },
      }),

      // Active exercise plan's current week, for today's workout on Home
      prisma.userActiveExercisePlan.findFirst({
        where: { userId, pausedAt: null },
        orderBy: { startedAt: 'desc' },
        include: {
          plan: {
            include: {
              exercisePlanWeeks: {
                include: {
                  exercisePlanSchedule: {
                    include: { exercise: { select: { name: true, caloriesBurnEstimate: true } } },
                    orderBy: { orderIndex: 'asc' },
                  },
                },
              },
            },
          },
        },
      }),

      medicationAdherence(userId, 30, todaySummaryStr),
    ]);

    // --- Calories ---
    // Consumed = meals the user checked off plus food logged outside the plan (scans, manual)
    // Target = the diet plan's daily calorie goal
    const todayCalories = [...todayMealLogs, ...todayFoodLogs].reduce((sum: number, log) => sum + (log.calories || 0), 0);
    const calorieTarget = activeDietPlan?.diet.calories || 0;

    // --- Exercise active days (last 7 days) ---
    const activeDays = new Set(
      exerciseProgress
        .filter((p: { completedAt: Date | null }) => p.completedAt)
        .map((p: { completedAt: Date | null }) => new Date(p.completedAt!).toDateString())
    ).size;

    // --- Medication adherence (doses taken out of doses due, last 30 days) ---
    const totalMeds = medications.length;
    const activeMeds = medications.filter((m: { medicationReminders: Array<{ enabled: boolean }> }) =>
      m.medicationReminders.some((r: { enabled: boolean }) => r.enabled)
    ).length;
    const medAdherence = medicationDoses.takenPercent;

    // --- Challenge completion (each user completes a challenge for themselves) ---
    const completedChallenges = userChallenges.filter((uc: { completedAt: Date | null }) => uc.completedAt).length;

    // --- Today's workout: the active plan's current week, today's weekday ---
    const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todaySummaryStart.getUTCDay()];
    const currentWeek = activeExercisePlan?.plan.exercisePlanWeeks.find(
      (week) => week.weekNumber === activeExercisePlan.currentWeek,
    );
    const todaysSchedule = (currentWeek?.exercisePlanSchedule ?? []).filter(
      (item) => item.dayOfWeek.toLowerCase() === weekdayName.toLowerCase(),
    );
    const todayWorkout = activeExercisePlan
      ? {
          planName: activeExercisePlan.plan.name,
          exercises: todaysSchedule.map((item) => item.exercise.name).filter(Boolean),
          calories: todaysSchedule.reduce((sum, item) => sum + (item.exercise.caloriesBurnEstimate || 0), 0),
          isRestDay: todaysSchedule.length === 0,
        }
      : null;

    // --- Water intake ---
    const totalWater = todayWaterIntake.reduce((sum: number, w) => sum + (w.amount || 0), 0);
    const waterGoalAmount = waterGoal?.goalAmount || defaultWaterGoalAmount;

    res.status(200).json({
      success: true,
      data: {
        caloriesIntake: {
          today: todayCalories,
          target: calorieTarget,
          percentage: calorieTarget > 0 ? Math.round((todayCalories / calorieTarget) * 100) : 0,
        },
        exerciseActiveDays: {
          activeDays,
          totalDays: 7,
          percentage: Math.round((activeDays / 7) * 100),
          exercisesCompletedThisWeek: exerciseProgress.length,
        },
        medicationStats: {
          totalMedications: totalMeds,
          activeMedications: activeMeds,
          adherencePercent: medAdherence,
          doses: medicationDoses,
        },
        todayWorkout,
        challengeProgress: {
          totalJoined: userChallenges.length,
          completed: completedChallenges,
          inProgress: userChallenges.length - completedChallenges,
        },
        waterIntake: {
          today: totalWater,
          goal: waterGoalAmount,
          unit: waterGoal?.unit || DEFAULT_WATER_GOAL_UNIT,
          percentage: waterGoalAmount > 0 ? Math.round((totalWater / waterGoalAmount) * 100) : 0,
        },
        sleep: recentSleepLog
          ? {
              lastDate: recentSleepLog.date,
              duration: recentSleepLog.durationMinutes,
              quality: recentSleepLog.sleepQuality,
            }
          : null,
        fasting: recentFastingLog
          ? {
              lastDate: recentFastingLog.date,
              duration: recentFastingLog.durationMinutes,
            }
          : null,
      },
      message: 'Progress summary retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch progress summary',
    });
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
