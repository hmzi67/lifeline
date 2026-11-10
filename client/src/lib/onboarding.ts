import api from '@/lib/axios';

export interface QuestionnaireData {
  gender?: string | null;
  goal?: string | null;
  dietType?: string[] | null;
  allergenFood?: string[] | null;
  fitnessLevel?: string | null;
  typicalDayType?: string | null;
  bodyFocusArea?: string[] | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  motivationFor?: string | null;
  [key: string]: unknown;
}

// Keep in sync with the `steps` array in pages/marketing/Questions.tsx.
export const TOTAL_QUESTION_STEPS = 15;

// Returns the index of the first unanswered step, or TOTAL_QUESTION_STEPS
// once everything has been filled in.
export const findMissingQuestionnaireStep = (q: QuestionnaireData): number => {
  if (!q.gender) return 0; // GenderSelector
  if (!q.goal) return 2; // FitnessGoalSelector
  if (!q.dietType) return 3; // DietTypeSelector
  if (!q.allergenFood) return 4; // AllergenSelector
  if (!q.fitnessLevel) return 6; // FitnessLevelSelector
  if (!q.typicalDayType) return 7; // TypicalDaySelector
  if (!q.bodyFocusArea) return 8; // FocusAreaSelector
  if (!q.dateOfBirth) return 10; // AgeSelector
  if (!q.height) return 11; // HeightSelector
  // The "GoalWeightSelector" step actually collects & persists the user's
  // current weight (via /questionnaire/weight-data -> the `weight` field),
  // not `goalWeight` (which nothing in the UI ever sets) — check `weight`
  // here, otherwise this step is reported as perpetually incomplete.
  if (!q.weight) return 12; // GoalWeightSelector (current weight)
  if (!q.motivationFor) return 13; // FitnessMotivationSelector
  return TOTAL_QUESTION_STEPS; // Done
};

export const isQuestionnaireComplete = (q: QuestionnaireData | null | undefined): boolean => {
  if (!q) return false;
  return findMissingQuestionnaireStep(q) >= TOTAL_QUESTION_STEPS;
};

export const fetchQuestionnaire = async (): Promise<QuestionnaireData | null> => {
  try {
    const res = await api.get('/questionnaire');
    return res.data?.data?.questionnaire ?? null;
  } catch {
    return null;
  }
};

const hasActiveSubscription = async (): Promise<boolean> => {
  try {
    const res = await api.get('/subscription/status');
    return res.data?.data?.active === true;
  } catch {
    return false;
  }
};

// Paid means VIP is active now (including App Store purchases and free trials)
// or the user has a completed payment on record.
export const hasCompletedPayment = async (userId: string): Promise<boolean> => {
  if (await hasActiveSubscription()) return true;

  try {
    const res = await api.get(`/subscription-payments/user/${userId}`, {
      params: { limit: 100 },
    });
    const payments = res.data?.payments ?? [];
    return payments.some((p: { status?: string }) => p.status === 'COMPLETED');
  } catch {
    return false;
  }
};

// Where to send a user right after they authenticate: the landing page if
// they've already finished onboarding and paid, otherwise the questionnaire.
export const getPostLoginRedirectPath = async (userId: string | undefined): Promise<string> => {
  if (!userId) return '/questions';

  const [questionnaire, paid] = await Promise.all([
    fetchQuestionnaire(),
    hasCompletedPayment(userId),
  ]);

  if (isQuestionnaireComplete(questionnaire) && paid) {
    return '/';
  }

  return '/questions';
};
