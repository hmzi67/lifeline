import { Router } from 'express';
import {
  getUserQuestionnaire,
  createOrUpdateQuestionnaire,
  deleteQuestionnaire,
  // NEW: Merged field endpoints
  getHeightData,
  getWeightData,
  updateHeightData,
  updateWeightData,
  // Individual field GET endpoints
  getGender,
  getGoal,
  getDietType,
  getIsDiabetic,
  getAllergenFood,
  getFitnessLevel,
  getTypicalDayType,
  getPhysicalLimitations,
  getBodyFocusArea,
  getDateOfBirth,
  getHeight,
  getHeightUnit,
  getWeight,
  getWeightUnit,
  getGoalWeight,
  getMotivationFor,
  // Individual field UPDATE endpoints
  updateGender,
  updateGoal,
  updateDietType,
  updateIsDiabetic,
  updateAllergenFood,
  updateFitnessLevel,
  updateTypicalDayType,
  updatePhysicalLimitations,
  updateBodyFocusArea,
  updateDateOfBirth,
  updateHeight,
  updateHeightUnit,
  updateWeight,
  updateWeightUnit,
  updateGoalWeight,
  updateMotivationFor,
} from '../controllers/questionnaireController.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();

// Every questionnaire route acts on the signed-in user's own answers.
router.use(authenticate);

// General questionnaire routes
router.get('/', getUserQuestionnaire);
router.post('/', createOrUpdateQuestionnaire);
router.put('/', createOrUpdateQuestionnaire);
router.delete('/', deleteQuestionnaire);

// NEW: Merged field endpoints (recommended to use these)
router.get('/height-data', getHeightData);
router.get('/weight-data', getWeightData);
router.put('/height-data', updateHeightData);
router.patch('/height-data', updateHeightData);
router.put('/weight-data', updateWeightData);
router.patch('/weight-data', updateWeightData);

// Individual field GET endpoints (kept for backward compatibility)
router.get('/gender', getGender);
router.get('/goal', getGoal);
router.get('/diet-type', getDietType);
router.get('/is-diabetic', getIsDiabetic);
router.get('/allergen-food', getAllergenFood);
router.get('/fitness-level', getFitnessLevel);
router.get('/typical-day-type', getTypicalDayType);
router.get('/physical-limitations', getPhysicalLimitations);
router.get('/body-focus-area', getBodyFocusArea);
router.get('/date-of-birth', getDateOfBirth);
router.get('/height', getHeight);
router.get('/height-unit', getHeightUnit);
router.get('/weight', getWeight);
router.get('/weight-unit', getWeightUnit);
router.get('/goal-weight', getGoalWeight);
router.get('/motivation-for', getMotivationFor);

// Individual field UPDATE endpoints (kept for backward compatibility)
router.put('/gender', updateGender);
router.patch('/gender', updateGender);
router.put('/goal', updateGoal);
router.patch('/goal', updateGoal);
router.put('/diet-type', updateDietType);
router.patch('/diet-type', updateDietType);
router.put('/is-diabetic', updateIsDiabetic);
router.patch('/is-diabetic', updateIsDiabetic);
router.put('/allergen-food', updateAllergenFood);
router.patch('/allergen-food', updateAllergenFood);
router.put('/fitness-level', updateFitnessLevel);
router.patch('/fitness-level', updateFitnessLevel);
router.put('/typical-day-type', updateTypicalDayType);
router.patch('/typical-day-type', updateTypicalDayType);
router.put('/physical-limitations', updatePhysicalLimitations);
router.patch('/physical-limitations', updatePhysicalLimitations);
router.put('/body-focus-area', updateBodyFocusArea);
router.patch('/body-focus-area', updateBodyFocusArea);
router.put('/date-of-birth', updateDateOfBirth);
router.patch('/date-of-birth', updateDateOfBirth);
router.put('/height', updateHeight);
router.patch('/height', updateHeight);
router.put('/height-unit', updateHeightUnit);
router.patch('/height-unit', updateHeightUnit);
router.put('/weight', updateWeight);
router.patch('/weight', updateWeight);
router.put('/weight-unit', updateWeightUnit);
router.patch('/weight-unit', updateWeightUnit);
router.put('/goal-weight', updateGoalWeight);
router.patch('/goal-weight', updateGoalWeight);
router.put('/motivation-for', updateMotivationFor);
router.patch('/motivation-for', updateMotivationFor);

export default router;
