import express from 'express';
import {
  getAllChallengeExercises,
  getExercisesByChallenge,
  getChallengesByExercise,
  addExerciseToChallenge,
  removeExerciseFromChallenge,
  addMultipleExercisesToChallenge,
} from '../controllers/challengeExerciseController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';


const challengeExerciseRouter = express.Router();

// @route   GET /api/challenge-exercises
// @desc    Get all challenge exercises relationships
// @access  Public
challengeExerciseRouter.get('/', getAllChallengeExercises);

// @route   GET /api/challenge-exercises/challenge/:challengeId
// @desc    Get all exercises for a specific challenge
// @access  Public
challengeExerciseRouter.get('/challenge/:challengeId', getExercisesByChallenge);

// @route   GET /api/challenge-exercises/exercise/:exerciseId
// @desc    Get all challenges for a specific exercise
// @access  Public
challengeExerciseRouter.get('/exercise/:exerciseId', getChallengesByExercise);

// @route   POST /api/challenge-exercises
// @desc    Add exercise to challenge
// @access  Private (add authentication middleware as needed)
challengeExerciseRouter.post('/', authenticate, authorize(['admin']), addExerciseToChallenge);

// @route   POST /api/challenge-exercises/multiple
// @desc    Add multiple exercises to a challenge
// @access  Private (add authentication middleware as needed)
challengeExerciseRouter.post('/multiple', authenticate, authorize(['admin']), addMultipleExercisesToChallenge);

// @route   DELETE /api/challenge-exercises/:challengeId/:exerciseId
// @desc    Remove exercise from challenge
// @access  Private (add authentication middleware as needed)
challengeExerciseRouter.delete('/:challengeId/:exerciseId', authenticate, authorize(['admin']), removeExerciseFromChallenge);

export default challengeExerciseRouter;
