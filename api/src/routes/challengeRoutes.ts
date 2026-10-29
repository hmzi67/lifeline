import express from 'express';
import {
    createChallenge,
    deleteChallenge,
    getAllChallenges,
    completeChallenge,
    confirmChallengeCheckout,
    getChallengeById,
    getChallengeReports,
    getPendingChallenges,
    joinChallenge,
    recordChallengeApplePurchase,
    reportChallenge,
    resolveChallengeReports,
    reviewChallenge,
    startChallengeCheckout,
    submitChallenge,
    updateChallenge,
} from '../controllers/challengeController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';


const challengeRoute = express.Router();

// @route   GET /api/challenges
// @desc    Get all challenges
// @access  Public
challengeRoute.get('/', getAllChallenges);

// @route   GET /api/challenges/approvals/pending
// @desc    Challenges submitted from the app that are waiting for review
// @access  Admin
challengeRoute.get('/approvals/pending', authenticate, authorize(['admin']), getPendingChallenges);

// @route   GET /api/challenges/reports
// @desc    Challenges with open user reports, for moderation
// @access  Admin
challengeRoute.get('/reports', authenticate, authorize(['admin']), getChallengeReports);

// @route   POST /api/challenges/submit
// @desc    Submit a challenge for admin review
// @access  Private (requires authentication)
challengeRoute.post('/submit', authenticate, submitChallenge);

// @route   POST /api/challenges/apple-purchases
// @desc    Record an App Store purchase of a paid challenge and join it
// @access  Private (requires authentication)
challengeRoute.post('/apple-purchases', authenticate, recordChallengeApplePurchase);

// @route   GET /api/challenges/:id
// @desc    Get challenge by ID
// @access  Public
challengeRoute.get('/:id', getChallengeById);

// @route   POST /api/challenges
// @desc    Create new challenge
// @access  Private (add authentication middleware as needed)
challengeRoute.post('/', authenticate, authorize(['admin']), createChallenge);

// @route   PUT /api/challenges/:id
// @desc    Update challenge
// @access  Private (add authentication middleware as needed)
challengeRoute.put('/:id', authenticate, authorize(['admin']), updateChallenge);

// @route   DELETE /api/challenges/:id
// @desc    Delete challenge
// @access  Private (add authentication middleware as needed)
challengeRoute.delete('/:id', authenticate, authorize(['admin']), deleteChallenge);

// @route   POST /api/challenges/:id/join
// @desc    Join a challenge
// @access  Private (requires authentication)
challengeRoute.post('/:id/join', authenticate, joinChallenge);

// @route   POST /api/challenges/:id/complete
// @desc    Mark the caller's joined challenge as completed
// @access  Private (requires authentication)
challengeRoute.post('/:id/complete', authenticate, completeChallenge);

// @route   POST /api/challenges/:id/checkout
// @desc    Start paying to join a paid challenge (Stripe or App Store)
// @access  Private (requires authentication)
challengeRoute.post('/:id/checkout', authenticate, startChallengeCheckout);

// @route   POST /api/challenges/:id/checkout/confirm
// @desc    Confirm a Stripe payment for a paid challenge and join it
// @access  Private (requires authentication)
challengeRoute.post('/:id/checkout/confirm', authenticate, confirmChallengeCheckout);

// @route   PATCH /api/challenges/:id/approval
// @desc    Approve or reject a submitted challenge
// @access  Admin
challengeRoute.patch('/:id/approval', authenticate, authorize(['admin']), reviewChallenge);

// @route   POST /api/challenges/:id/report
// @desc    Report a challenge as objectionable
// @access  Private (requires authentication)
challengeRoute.post('/:id/report', authenticate, reportChallenge);

// @route   PATCH /api/challenges/:id/reports
// @desc    Remove a reported challenge or dismiss its reports
// @access  Admin
challengeRoute.patch('/:id/reports', authenticate, authorize(['admin']), resolveChallengeReports);

export default challengeRoute;
