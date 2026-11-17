import api from '@/lib/axios';

/** Admin API for the AI plan generator (api/src/routes/adminAiGeneratorRoutes.ts). */

export type PlanKind = 'diet' | 'exercise';
export type MediaSource = 'ai_generated' | 'stock' | 'stock_or_ai' | 'admin_upload';
export type BatchStatus = 'queued' | 'running' | 'completed' | 'cancelled';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'needs_attention' | 'failed' | 'cancelled';

export interface GeneratorStatus {
    openai: boolean;
    usda: boolean;
    pixabay: boolean;
    models: { agent: string; critic: string; image: string };
    imageCostUsd: number;
    choices: { dietGoals: string[]; dietTypes: string[]; levels: string[]; focusAreas: string[] };
    limits: { maxPlansPerBatch: number; maxCostCapUsd: number };
}

export interface LogEntry {
    at: string;
    type: 'tool' | 'model' | 'critic' | 'media' | 'note';
    name?: string;
    summary: string;
    costUsd?: number;
}

export interface GenerationJob {
    id: string;
    position: number;
    status: JobStatus;
    spec: Record<string, any>;
    attempts: number;
    resultPlanId: string | null;
    costUsd: number;
    log: LogEntry[];
    errorMessage: string | null;
    /** suggestions: the coach review's optional ideas (older jobs only have them in errorMessage). */
    reviewData?: { suggestions?: string[] } | null;
    startedAt: string | null;
    finishedAt: string | null;
}

export interface BatchPlan {
    id: string;
    name: string | null;
    status: 'draft' | 'published';
    image: string | null;
    description: string | null;
}

export interface GenerationBatch {
    id: string;
    kind: PlanKind;
    status: BatchStatus;
    mediaSource: MediaSource;
    settings: Record<string, any>;
    planCount: number;
    costCapUsd: number | null;
    costUsd: number;
    createdAt: string;
    finishedAt: string | null;
    createdBy?: { id: string; email: string; username: string | null } | null;
    jobCounts?: Partial<Record<JobStatus, number>>;
    jobs?: GenerationJob[];
    plans?: BatchPlan[];
}

export interface CreateBatchInput {
    kind: PlanKind;
    mediaSource: MediaSource;
    planCount: number;
    costCapUsd?: number;
    settings: Record<string, unknown>;
}

export interface ExercisePreview {
    kind: 'exercise';
    id: string;
    name: string;
    description: string | null;
    status: string;
    image: string | null;
    level: string | null;
    durationWeeks: number | null;
    weeks: {
        weekNumber: number;
        days: {
            dayOfWeek: string;
            exercises: {
                sets: number | null;
                reps: string | null;
                duration: string | null;
                exercise: {
                    id: string;
                    name: string | null;
                    image: string | null;
                    videoUrl: string | null;
                    difficulty: string | null;
                    status: string;
                    createdByBatch: boolean;
                    /** This exercise is live in the app; the picture shown replaces its current one when the plan is published. */
                    pictureOnPublish?: boolean;
                };
            }[];
        }[];
    }[];
}

export interface DietPreview {
    kind: 'diet';
    id: string;
    name: string | null;
    description: string | null;
    status: string;
    image: string | null;
    goal: string | null;
    calories: number | null;
    duration: string | null;
    cuisineName: string | null;
    /** The USDA food each ingredient's calories and macros came from. */
    nutritionSources?: { ingredient: string; usdaMatch: string; kcalPer100g: number }[];
    days: {
        dayNumber: number;
        meals: {
            id: string;
            mealType: string;
            name: string;
            calories: number | null;
            protein: number | null;
            carbs: number | null;
            fats: number | null;
            portionSize: string | null;
            image: string | null;
            recipe: string | null;
        }[];
    }[];
}

export type PlanPreview = ExercisePreview | DietPreview;

const base = '/admin/ai-generator';

export const aiGeneratorService = {
    status: async () => (await api.get<{ data: GeneratorStatus }>(`${base}/status`)).data.data,
    listBatches: async () => (await api.get<{ data: GenerationBatch[] }>(`${base}/batches`, { params: { limit: 50 } })).data.data,
    getBatch: async (id: string) => (await api.get<{ data: GenerationBatch }>(`${base}/batches/${id}`)).data.data,
    createBatch: async (input: CreateBatchInput) => (await api.post<{ data: GenerationBatch }>(`${base}/batches`, input)).data.data,
    cancel: async (id: string) => (await api.post(`${base}/batches/${id}/cancel`)).data.data as { cancelledJobs: number; stillRunning: number },
    publish: async (id: string, planIds?: string[]) =>
        (await api.post(`${base}/batches/${id}/publish`, planIds ? { planIds } : {})).data.data as { plans: number; exercises: number; pictures?: number },
    /** Makes one plan of the batch again with the same settings (replaces its draft). */
    retryJob: async (batchId: string, jobId: string, raiseCapByUsd?: number) =>
        (await api.post(`${base}/batches/${batchId}/jobs/${jobId}/retry`, raiseCapByUsd ? { raiseCapByUsd } : {})).data.data as { jobId: string; costCapUsd: number | null },
    /** Queues a new plan in the batch: this job's plan with the picked coach ideas applied. */
    reviseJob: async (batchId: string, jobId: string, ideas: string[], raiseCapByUsd?: number) =>
        (await api.post(`${base}/batches/${batchId}/jobs/${jobId}/revise`, { ideas, ...(raiseCapByUsd ? { raiseCapByUsd } : {}) })).data.data as { jobId: string; costCapUsd: number | null },
    discard: async (id: string, planIds?: string[]) =>
        (await api.post(`${base}/batches/${id}/discard`, planIds ? { planIds } : {})).data.data as Record<string, number>,
    planPreview: async (batchId: string, planId: string) =>
        (await api.get<{ data: PlanPreview }>(`${base}/batches/${batchId}/plans/${planId}`)).data.data,
    setMedia: async (batchId: string, body: { target: 'plan' | 'meal' | 'exercise'; id: string; image?: string | null; videoUrl?: string | null }) =>
        (await api.post(`${base}/batches/${batchId}/media`, body)).data.data as { updated: number },
};
