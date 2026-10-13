import { Request, Response } from 'express';
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
          totalCalories: 0,
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
    }> = [];

    if (currentDayPlan) {
      for (const meal of currentDayPlan.dietPlanMeals) {
        mealBreakdown.push({
          mealType: meal.mealType.name,
          mealName: meal.name,
          calories: meal.calories || 0,
          portionSize: meal.portionSize,
        });
      }
    }

    // Consumed calories: sum only meals the user has explicitly logged (checked off)
    const todayStr = (date as string) || new Date().toISOString().split('T')[0];
    const todayStart = new Date(todayStr);
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const mealLogs: Array<{ calories: number | null; mealId: string }> = [];

    const todayCalories = mealLogs.reduce((sum: number, log) => sum + (log.calories || 0), 0);
    const loggedMealIds = mealLogs.map((log) => log.mealId);

    // If date range is provided, calculate total for the range
    let rangeCalories = todayCalories;
    const dailyBreakdown: Array<{
      day: number;
      calories: number;
      meals: typeof mealBreakdown;
    }> = [];

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      rangeCalories = 0;

      for (let i = 0; i < rangeDays; i++) {
        const dayNum = Math.ceil(
          (start.getTime() + i * 86400000 - planStartDate.getTime()) / 86400000
        ) + 1;

        const dayPlan = activeDietPlan.diet.dietPlanDays.find((d) => d.dayNumber === dayNum);
        let dayCalories = 0;
        const dayMeals: typeof mealBreakdown = [];

        if (dayPlan) {
          for (const meal of dayPlan.dietPlanMeals) {
            const cal = meal.calories || 0;
            dayCalories += cal;
            dayMeals.push({
              mealType: meal.mealType.name,
              mealName: meal.name,
              calories: cal,
              portionSize: meal.portionSize,
            });
          }
        }

        rangeCalories += dayCalories;
        dailyBreakdown.push({ day: dayNum, calories: dayCalories, meals: dayMeals });
      }
    } else {
      dailyBreakdown.push({
        day: activeDietPlan.currentDay || currentDay,
        calories: todayCalories,
        meals: mealBreakdown,
      });
    }

    // Get the overall plan calorie target
    const planCalorieTarget = activeDietPlan.diet.calories || 0;

    res.status(200).json({
      success: true,
      data: {
        totalCalories: startDate && endDate ? rangeCalories : todayCalories,
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

    // Calculate the start and end of the requested week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - weekOffset * 7); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
    endOfWeek.setHours(23, 59, 59, 999);

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
        routinesDate: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: {
        routinesDate: true,
      },
    });

    // Build a day-by-day summary
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekDays = dayNames.map((dayName, index) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + index);

      // Check if user completed any exercises on this day
      const completedOnDay = exerciseProgress.filter((p) => {
        if (!p.completedAt) return false;
        const completedDate = new Date(p.completedAt);
        return completedDate.toDateString() === dayDate.toDateString();
      });

      // Check if user had a daily routine on this day
      const hadRoutine = dailyRoutines.some((r) => {
        if (!r.routinesDate) return false;
        return new Date(r.routinesDate).toDateString() === dayDate.toDateString();
      });

      return {
        day: dayName,
        date: dayDate.toISOString().split('T')[0],
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
        weekStart: startOfWeek.toISOString().split('T')[0],
        weekEnd: endOfWeek.toISOString().split('T')[0],
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
    const daysBack = parseInt(period as string, 10);

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

    if (medications.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalMedications: 0,
          overallAdherencePercent: 0,
          medicationBreakdown: [],
          summary: {
            taken: 0,
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
    const overallAdherence =
      medicationBreakdown.length > 0
        ? Math.round(
            medicationBreakdown.reduce((sum, m) => sum + m.adherencePercent, 0) /
              medicationBreakdown.length
          )
        : 0;

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
        summary: {
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

    // Count completed challenges (status = COMPLETED)
    const completedChallenges = userChallenges.filter(
      (uc) => uc.challenge?.status === 'COMPLETED'
    ).length;

    // Count in-progress challenges
    const inProgressChallenges = userChallenges.filter(
      (uc) => uc.challenge?.status === 'ACTIVE'
    ).length;

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
    const todaySummaryStr = new Date().toISOString().split('T')[0];
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
    ]);

    // --- Calories ---
    // Consumed = only meals the user has explicitly checked off (meal logs)
    // Target = the diet plan's daily calorie goal
    const todayCalories = todayMealLogs.reduce((sum: number, log) => sum + (log.calories || 0), 0);
    const calorieTarget = activeDietPlan?.diet.calories || 0;

    // --- Exercise active days (last 7 days) ---
    const activeDays = new Set(
      exerciseProgress
        .filter((p: { completedAt: Date | null }) => p.completedAt)
        .map((p: { completedAt: Date | null }) => new Date(p.completedAt!).toDateString())
    ).size;

    // --- Medication adherence ---
    const totalMeds = medications.length;
    const activeMeds = medications.filter((m: { medicationReminders: Array<{ enabled: boolean }> }) =>
      m.medicationReminders.some((r: { enabled: boolean }) => r.enabled)
    ).length;
    const medAdherence = totalMeds > 0 ? Math.round((activeMeds / totalMeds) * 100) : 0;

    // --- Challenge completion ---
    const completedChallenges = userChallenges.filter(
      (uc: { challenge: { status: string | null } | null }) => uc.challenge?.status === 'COMPLETED'
    ).length;

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
        },
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
