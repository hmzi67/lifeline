import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

interface DietPlanQuery {
  query?: string;
  calories?: string;
  duration?: string;
}

interface CreateDietPlanBody {
  name: string;
  calories?: number;
  duration?: string;
  description?: string;
  image?: string;
  cuisineName?: string;
  gender?: string;
}

interface UpdateDietPlanBody {
  name?: string;
  calories?: number;
  duration?: string;
  description?: string;
  image?: string;
  cuisineName?: string;
  gender?: string;
}

const GOAL_KEYWORDS: Record<string, string[]> = {
  weight_loss: ['weight loss', 'weight_loss', 'lose weight', 'fat loss', 'fat-loss', 'slimming', 'caloric deficit', 'calorie deficit'],
  weight_gain: ['weight gain', 'weight_gain', 'gain weight', 'bulking'],
  build_muscle: ['build muscle', 'muscle gain', 'muscle_gain', 'high protein', 'hypertrophy'],
  muscle_gain: ['muscle gain', 'muscle_gain', 'build muscle', 'high protein', 'hypertrophy'],
  maintenance: ['maintenance', 'maintain', 'balanced'],
  modify_diet: ['modify diet', 'healthy diet', 'balanced'],
  intermittent_fasting: ['intermittent fasting', 'fasting'],
};

const BMI_CATEGORY_KEYWORDS: Record<string, string[]> = {
  underweight: ['underweight', 'bmi underweight', 'low bmi'],
  normal_weight: ['normal weight', 'normal bmi', 'healthy bmi'],
  overweight: ['overweight', 'bmi overweight'],
  obese: ['obese', 'obesity', 'bmi obese'],
};

const normalizeText = (value: string | null | undefined): string => {
  return (value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
};

const buildPlanSearchText = (plan: {
  name: string | null;
  description: string | null;
  cuisineName: string | null;
  category?: string | null;
}): string => {
  return normalizeText([plan.name, plan.description, plan.cuisineName, plan.category].filter(Boolean).join(' '));
};

const includesAnyKeyword = (text: string, keywords: string[]): boolean => {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
};

const getGoalKeywords = (rawGoal: string | null | undefined): string[] | null => {
  const goal = normalizeText(rawGoal);
  if (!goal) return null;

  if (goal.includes('loss') || goal.includes('lose') || goal.includes('slim') || goal.includes('fat')) {
    return GOAL_KEYWORDS.weight_loss;
  }
  if (goal.includes('gain') && !goal.includes('muscle')) {
    return GOAL_KEYWORDS.weight_gain;
  }
  if (goal.includes('muscle') || goal.includes('strength') || goal.includes('hypertrophy')) {
    return GOAL_KEYWORDS.build_muscle;
  }
  if (goal.includes('maintain') || goal.includes('maintenance')) {
    return GOAL_KEYWORDS.maintenance;
  }
  if (goal.includes('fast')) {
    return GOAL_KEYWORDS.intermittent_fasting;
  }

  return GOAL_KEYWORDS[goal] || [goal];
};

const parseUserIdFromToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorizationHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as { userId?: string };
    return decoded.userId || null;
  } catch {
    return null;
  }
};

const toKg = (weight: number | null | undefined, unit: string | null | undefined): number | null => {
  if (!weight || weight <= 0) return null;

  const normalizedUnit = normalizeText(unit);
  if (normalizedUnit === 'kg' || normalizedUnit === 'kgs' || normalizedUnit === '') return weight;
  if (normalizedUnit === 'lb' || normalizedUnit === 'lbs' || normalizedUnit === 'pound' || normalizedUnit === 'pounds') {
    return weight * 0.45359237;
  }

  return null;
};

const toMeters = (height: number | null | undefined, unit: string | null | undefined): number | null => {
  if (!height || height <= 0) return null;

  const normalizedUnit = normalizeText(unit);
  if (normalizedUnit === 'cm' || normalizedUnit === '') return height / 100;
  if (normalizedUnit === 'm' || normalizedUnit === 'meter' || normalizedUnit === 'meters') return height;
  if (normalizedUnit === 'in' || normalizedUnit === 'inch' || normalizedUnit === 'inches') return height * 0.0254;
  if (normalizedUnit === 'ft' || normalizedUnit === 'foot' || normalizedUnit === 'feet') return height * 0.3048;

  return null;
};

const getBmiCategory = (bmi: number): string => {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal_weight';
  if (bmi < 35) return 'overweight';
  return 'obese';
};

// Get all diet plans
export const getAllDietPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const dietPlans = await prisma.dietPlan.findMany({
      include: {
        userDietPlans: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        },
        challengeDiets: {
          include: {
            challenge: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    let personalizedDietPlans = dietPlans;

    const userId = parseUserIdFromToken(req.headers.authorization);
    if (userId) {
      const questionnaire = await prisma.questionnaire.findFirst({
        where: { userId },
        select: {
          goal: true,
          dietType: true,
          height: true,
          heightUnit: true,
          weight: true,
          weightUnit: true,
        },
      });

      if (questionnaire) {
        const goalKeywords = getGoalKeywords(questionnaire.goal);
        const selectedCuisine = normalizeText(questionnaire.dietType?.[0]);

        const weightKg = toKg(questionnaire.weight, questionnaire.weightUnit);
        const heightMeters = toMeters(questionnaire.height, questionnaire.heightUnit);

        let bmiCategory: string | null = null;
        if (weightKg && heightMeters) {
          const bmi = weightKg / (heightMeters * heightMeters);
          if (Number.isFinite(bmi) && bmi > 0) {
            bmiCategory = getBmiCategory(bmi);
          }
        }

        if (goalKeywords) {
          const byGoal = personalizedDietPlans.filter((plan) => {
            const planText = buildPlanSearchText(plan);
            return includesAnyKeyword(planText, goalKeywords);
          });

          personalizedDietPlans = byGoal;
        }

        if (bmiCategory || selectedCuisine) {
          const categoryKeywords = bmiCategory ? BMI_CATEGORY_KEYWORDS[bmiCategory] : [];
          personalizedDietPlans = [...personalizedDietPlans].sort((a, b) => {
            const aText = buildPlanSearchText(a);
            const bText = buildPlanSearchText(b);
            const aScore =
              (selectedCuisine && includesAnyKeyword(aText, [selectedCuisine]) ? 2 : 0) +
              (categoryKeywords.length > 0 && includesAnyKeyword(aText, categoryKeywords) ? 1 : 0);
            const bScore =
              (selectedCuisine && includesAnyKeyword(bText, [selectedCuisine]) ? 2 : 0) +
              (categoryKeywords.length > 0 && includesAnyKeyword(bText, categoryKeywords) ? 1 : 0);
            if (aScore !== bScore) return bScore - aScore;
            return 0;
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: personalizedDietPlans,
      message: 'Diet plans retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching diet plans:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get diet plan by ID
export const getDietPlanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const dietPlan = await prisma.dietPlan.findUnique({
      where: { id },
      include: {
        userDietPlans: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        },
        challengeDiets: {
          include: {
            challenge: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!dietPlan) {
      res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: dietPlan,
      message: 'Diet plan retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create new diet plan
export const createDietPlan = async (req: Request<{}, {}, CreateDietPlanBody>, res: Response): Promise<void> => {
  try {
    const { name, calories, duration, description, image, cuisineName, gender } = req.body;

    // Validation
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Diet plan name is required'
      });
      return;
    }

    const dietPlan = await prisma.dietPlan.create({
      data: {
        name,
        calories: calories || null,
        duration: duration || null,
        description: description || null,
        image: image || null,
        cuisineName: cuisineName || null,
        gender: gender || null,
      }
    });

    res.status(201).json({
      success: true,
      data: dietPlan,
      message: 'Diet plan created successfully'
    });
  } catch (error) {
    console.error('Error creating diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update diet plan
export const updateDietPlan = async (req: Request<{ id: string }, {}, UpdateDietPlanBody>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, calories, duration, description, image, cuisineName, gender } = req.body;

    // Check if diet plan exists
    const existingDietPlan = await prisma.dietPlan.findUnique({
      where: { id }
    });

    if (!existingDietPlan) {
      res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
      return;
    }

    const updateData: Partial<CreateDietPlanBody> = {};
    if (name !== undefined) updateData.name = name;
    if (calories !== undefined) updateData.calories = calories;
    if (duration !== undefined) updateData.duration = duration;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (cuisineName !== undefined) updateData.cuisineName = cuisineName;
    if (gender !== undefined) updateData.gender = gender;

    const updatedDietPlan = await prisma.dietPlan.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({
      success: true,
      data: updatedDietPlan,
      message: 'Diet plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete diet plan
export const deleteDietPlan = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if diet plan exists
    const existingDietPlan = await prisma.dietPlan.findUnique({
      where: { id }
    });

    if (!existingDietPlan) {
      res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
      return;
    }

    await prisma.dietPlan.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Diet plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting diet plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Search diet plans
export const searchDietPlans = async (req: Request<{}, {}, {}, DietPlanQuery>, res: Response): Promise<void> => {
  try {
    const { query, calories, duration } = req.query;

    const whereClause: any = {};

    if (query) {
      whereClause.name = {
        contains: query,
        mode: 'insensitive'
      };
    }

    if (calories) {
      whereClause.calories = parseInt(calories);
    }

    if (duration) {
      whereClause.duration = duration;
    }

    const dietPlans = await prisma.dietPlan.findMany({
      where: whereClause,
      include: {
        userDietPlans: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: dietPlans,
      message: 'Diet plans search completed successfully'
    });
  } catch (error) {
    console.error('Error searching diet plans:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
