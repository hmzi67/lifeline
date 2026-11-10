import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roleId?: string;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  roleId?: string;
}

const prisma = new PrismaClient();

// Validation schemas with arrays for multi-value fields
// Same rule as the app's onboarding: users must be 18 to 75 years old.
export const MIN_AGE = 18;
export const MAX_AGE = 75;
export const ageOn = (dateOfBirth: Date, today = new Date()) => {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() >= dateOfBirth.getUTCDate());
  return birthdayPassed ? age : age - 1;
};
const dateOfBirthSchema = z
  .string()
  .datetime()
  .optional()
  .or(z.date().optional())
  .refine((value) => {
    if (value === undefined) return true;
    const age = ageOn(new Date(value));
    return age >= MIN_AGE && age <= MAX_AGE;
  }, { message: `Age must be between ${MIN_AGE} and ${MAX_AGE} years` });

const questionnaireSchema = z.object({
  gender: z.string().max(10).optional(), // Changed from enum to string to match VarChar(10)
  goal: z.string().optional(), // Removed max length as it's Text in DB
  dietType: z.array(z.string().max(50)).optional(),
  isDiabetic: z.boolean().optional(),
  allergenFood: z.array(z.string()).optional(), // Removed max length as it's Text[] in DB
  fitnessLevel: z.string().max(20).optional(), // Changed from enum to string to match VarChar(20)
  typicalDayType: z.string().optional(), // Removed max length as it's Text in DB
  physicalLimitations: z.string().optional(), // Removed max length as it's Text in DB
  bodyFocusArea: z.array(z.string()).optional(), // Removed max length as it's Text[] in DB
  dateOfBirth: dateOfBirthSchema,
  height: z.number().positive().optional(), // Float in DB
  heightUnit: z.string().max(10).optional(), // Changed from enum to string to match VarChar(10)
  weight: z.number().positive().optional(), // Float in DB
  weightUnit: z.string().max(10).optional(), // Changed from enum to string to match VarChar(10)
  goalWeight: z.number().positive().optional(), // Float in DB
  motivationFor: z.string().optional(), // Removed max length as it's Text in DB
});

// Individual field schemas for validation
const fieldSchemas = {
  gender: z.object({ gender: z.string().max(10).optional() }),
  goal: z.object({ goal: z.string().optional() }),
  dietType: z.object({ dietType: z.array(z.string().max(50)).optional() }),
  isDiabetic: z.object({ isDiabetic: z.boolean().optional() }),
  allergenFood: z.object({ allergenFood: z.array(z.string()).optional() }),
  fitnessLevel: z.object({ fitnessLevel: z.string().max(20).optional() }),
  typicalDayType: z.object({ typicalDayType: z.string().optional() }),
  physicalLimitations: z.object({ physicalLimitations: z.string().optional() }),
  bodyFocusArea: z.object({ bodyFocusArea: z.array(z.string()).optional() }),
  dateOfBirth: z.object({ dateOfBirth: dateOfBirthSchema }),
  // Merged schemas for height and weight with their units
  heightData: z.object({
    height: z.number().positive().optional(),
    heightUnit: z.string().max(10).optional(),
  }),
  weightData: z.object({
    weight: z.number().positive().optional(),
    weightUnit: z.string().max(10).optional(),
  }),
  // Keep individual schemas for backward compatibility if needed
  height: z.object({ height: z.number().positive().optional() }),
  heightUnit: z.object({ heightUnit: z.string().max(10).optional() }),
  weight: z.object({ weight: z.number().positive().optional() }),
  weightUnit: z.object({ weightUnit: z.string().max(10).optional() }),
  goalWeight: z.object({ goalWeight: z.number().positive().optional() }),
  motivationFor: z.object({ motivationFor: z.string().optional() }),
};

// Split keys into DB fields and virtual (merged) fields
type FieldSchemaKey = keyof typeof fieldSchemas;
type VirtualField = 'heightData' | 'weightData';
type DBField = Exclude<FieldSchemaKey, VirtualField>;

// Use DBField for Prisma queries (only real DB columns)
type QuestionnaireField = DBField;

const getUserFromToken = (
  req: Request
): { userId: string; email: string; roleId?: string } | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    return { userId: decoded.userId, email: decoded.email, roleId: decoded.roleId };
  } catch {
    return null;
  }
};

const handleError = (res: Response, error: any, operation: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      // The app shows `message`, so lead with the actual reason.
      message: error.errors[0]?.message || 'Validation error',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
  console.error(`${operation} error:`, error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

const convertDateOfBirth = (dateOfBirth: any) => {
  if (!dateOfBirth) return undefined;
  return typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
};

const normalizeMultiValueField = (field: any): string[] | undefined => {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string')
    return field.trim() === '' ? [] : field.split(',').map(s => s.trim());
  return undefined;
};

const upsertQuestionnaire = async (userId: string, data: any) => {
  const processedData = {
    ...data,
    dateOfBirth: convertDateOfBirth(data.dateOfBirth),
    dietType: normalizeMultiValueField(data.dietType),
    allergenFood: normalizeMultiValueField(data.allergenFood),
    bodyFocusArea: normalizeMultiValueField(data.bodyFocusArea),
  };

  const existing = await prisma.questionnaire.findFirst({ where: { userId } });

  const saved = existing
    ? await prisma.questionnaire.update({ where: { id: existing.id }, data: processedData })
    : await prisma.questionnaire.create({ data: { userId, ...processedData } });

  // Keep a weight history (latest reading per day) for the weight trend charts.
  if (typeof processedData.weight === 'number' && processedData.weight > 0) {
    const date = new Date(new Date().toISOString().split('T')[0]);
    const unit = saved.weightUnit ?? null;
    await prisma.weightLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, weight: processedData.weight, unit },
      update: { weight: processedData.weight, unit, loggedAt: new Date() },
    });
  }

  return saved;
};

const getQuestionnaireField = async (
  req: Request,
  res: Response,
  fieldName: QuestionnaireField
) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { userId: user.userId },
      select: { [fieldName]: true },
    });

    return res.status(200).json({
      success: true,
      data: { [fieldName]: questionnaire?.[fieldName] ?? null },
    });
  } catch (error) {
    return handleError(res, error, `Get ${fieldName}`);
  }
};

// New function to get multiple fields (for merged APIs)
const getQuestionnaireFields = async (
  req: Request,
  res: Response,
  fieldNames: DBField[], // Select from DB fields only
  responseKey: string
) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const selectObject = fieldNames.reduce(
      (acc, fieldName) => {
        acc[fieldName] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { userId: user.userId },
      select: selectObject,
    });

    const data = fieldNames.reduce(
      (acc, fieldName) => {
        acc[fieldName] = questionnaire?.[fieldName] ?? null;
        return acc;
      },
      {} as Record<string, any>
    );

    return res.status(200).json({
      success: true,
      data: { [responseKey]: data },
    });
  } catch (error) {
    return handleError(res, error, `Get ${responseKey}`);
  }
};

const updateQuestionnaireField = async (
  req: Request,
  res: Response,
  fieldName: QuestionnaireField
) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const schema = fieldSchemas[fieldName];
    if (!schema) return res.status(400).json({ success: false, message: 'Invalid field name' });

    const validatedData = schema.parse(req.body);

    // Normalize arrays if multi-value field
    if (['dietType', 'allergenFood', 'bodyFocusArea'].includes(fieldName)) {
      (validatedData as Record<string, any>)[fieldName] = normalizeMultiValueField(
        (validatedData as Record<string, any>)[fieldName]
      );
    }

    const questionnaire = await upsertQuestionnaire(user.userId, validatedData);

    return res.status(200).json({
      success: true,
      message: `${fieldName} updated successfully`,
      data: { [fieldName]: questionnaire[fieldName] },
    });
  } catch (error) {
    return handleError(res, error, `Update ${fieldName}`);
  }
};

// New function for updating multiple fields (for merged APIs)
const updateQuestionnaireFields = async (
  req: Request,
  res: Response,
  schemaKey: VirtualField, // Only virtual keys here
  fieldNames: DBField[], // DB fields underlying the virtual field
  responseKey: string
) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const schema = fieldSchemas[schemaKey];
    if (!schema) return res.status(400).json({ success: false, message: 'Invalid schema' });

    const validatedData = schema.parse(req.body);
    const questionnaire = await upsertQuestionnaire(user.userId, validatedData);

    const responseData = fieldNames.reduce(
      (acc, fieldName) => {
        acc[fieldName] = questionnaire[fieldName];
        return acc;
      },
      {} as Record<string, any>
    );

    return res.status(200).json({
      success: true,
      message: `${responseKey} updated successfully`,
      data: { [responseKey]: responseData },
    });
  } catch (error) {
    return handleError(res, error, `Update ${responseKey}`);
  }
};

// Main CRUD Controllers
export const getUserQuestionnaire = async (req: Request, res: Response) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const questionnaire = await prisma.questionnaire.findFirst({ where: { userId: user.userId } });

    // A new user has not answered anything yet; that is a normal state, not a 404.
    return res.status(200).json({ success: true, data: { questionnaire: questionnaire ?? null } });
  } catch (error) {
    return handleError(res, error, 'Get questionnaire');
  }
};

export const createOrUpdateQuestionnaire = async (req: Request, res: Response) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const validatedData = questionnaireSchema.parse(req.body);
    const questionnaire = await upsertQuestionnaire(user.userId, validatedData);

    return res.status(200).json({
      success: true,
      message: 'Questionnaire saved successfully',
      data: { questionnaire },
    });
  } catch (error) {
    return handleError(res, error, 'Create/Update questionnaire');
  }
};

export const deleteQuestionnaire = async (req: Request, res: Response) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized access' });

    const deleted = await prisma.questionnaire.deleteMany({ where: { userId: user.userId } });

    if (deleted.count === 0)
      return res.status(404).json({ success: false, message: 'Questionnaire not found' });

    return res.status(200).json({ success: true, message: 'Questionnaire deleted successfully' });
  } catch (error) {
    return handleError(res, error, 'Delete questionnaire');
  }
};

// MERGED APIs - New combined endpoints for heightData and weightData
export const getHeightData = (req: Request, res: Response) =>
  getQuestionnaireFields(req, res, ['height', 'heightUnit'], 'heightData');

export const getWeightData = (req: Request, res: Response) =>
  // goalWeight and height ride along so the Home weight card can show progress
  // to goal and a BMI status from one request.
  getQuestionnaireFields(req, res, ['weight', 'weightUnit', 'goalWeight', 'height', 'heightUnit'], 'weightData');

export const updateHeightData = (req: Request, res: Response) =>
  updateQuestionnaireFields(req, res, 'heightData', ['height', 'heightUnit'], 'heightData');

export const updateWeightData = (req: Request, res: Response) =>
  updateQuestionnaireFields(req, res, 'weightData', ['weight', 'weightUnit'], 'weightData');

// Individual GET Endpoints (kept for backward compatibility)
export const getGender = (req: Request, res: Response) => getQuestionnaireField(req, res, 'gender');
export const getGoal = (req: Request, res: Response) => getQuestionnaireField(req, res, 'goal');
export const getDietType = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'dietType');
export const getIsDiabetic = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'isDiabetic');
export const getAllergenFood = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'allergenFood');
export const getFitnessLevel = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'fitnessLevel');
export const getTypicalDayType = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'typicalDayType');
export const getPhysicalLimitations = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'physicalLimitations');
export const getBodyFocusArea = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'bodyFocusArea');
export const getDateOfBirth = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'dateOfBirth');
export const getHeight = (req: Request, res: Response) => getQuestionnaireField(req, res, 'height');
export const getHeightUnit = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'heightUnit');
export const getWeight = (req: Request, res: Response) => getQuestionnaireField(req, res, 'weight');
export const getWeightUnit = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'weightUnit');
export const getGoalWeight = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'goalWeight');
export const getMotivationFor = (req: Request, res: Response) =>
  getQuestionnaireField(req, res, 'motivationFor');

// Individual UPDATE Endpoints (kept for backward compatibility)
export const updateGender = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'gender');
export const updateGoal = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'goal');
export const updateDietType = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'dietType');
export const updateIsDiabetic = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'isDiabetic');
export const updateAllergenFood = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'allergenFood');
export const updateFitnessLevel = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'fitnessLevel');
export const updateTypicalDayType = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'typicalDayType');
export const updatePhysicalLimitations = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'physicalLimitations');
export const updateBodyFocusArea = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'bodyFocusArea');
export const updateDateOfBirth = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'dateOfBirth');
export const updateHeight = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'height');
export const updateHeightUnit = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'heightUnit');
export const updateWeight = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'weight');
export const updateWeightUnit = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'weightUnit');
export const updateGoalWeight = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'goalWeight');
export const updateMotivationFor = (req: Request, res: Response) =>
  updateQuestionnaireField(req, res, 'motivationFor');
