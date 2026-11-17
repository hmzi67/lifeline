import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    Ban,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Dumbbell,
    Eye,
    ImageIcon,
    Loader2,
    RefreshCw,
    RotateCcw,
    Sparkles,
    Trash2,
    Upload,
    Utensils,
    Wand2,
    XCircle,
} from 'lucide-react';
import { handleApiError } from '@/services/crudService';
import {
    aiGeneratorService,
    type BatchPlan,
    type BatchStatus,
    type GenerationBatch,
    type GenerationJob,
    type GeneratorStatus,
    type JobStatus,
    type MediaSource,
    type PlanKind,
} from '@/services/aiGeneratorService';
import AiPlanPreview from './AiPlanPreview';

// ─── Labels ───────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
    weight_loss: 'Lose weight',
    weight_gain: 'Gain weight',
    build_muscle: 'Build muscle',
};

type LogStep = NonNullable<GenerationJob['log']>[number];

/** Plain names for the steps on the batch page (it is read by non-technical admins). */
const STEP_LABELS: Record<string, string> = {
    save_exercise_plan: 'Check',
    save_diet_plan: 'Check',
    search_exercises: 'Exercise library',
    create_exercise: 'Exercise library',
    lookup_nutrition: 'Nutrition',
    critic: 'Coach review',
    note: 'Note',
    model: 'AI',
};
const stepLabel = (entry: LogStep) => {
    if (entry.type === 'media') return entry.name === 'plan cover' ? 'Cover picture' : `Picture (${String(entry.name ?? '').replace(/^(image|video|meal): /, '')})`;
    return STEP_LABELS[entry.name ?? ''] ?? STEP_LABELS[entry.type] ?? entry.name ?? entry.type;
};
/** "AI calls a tool" lines just repeat the next line, so they are hidden. */
const visibleSteps = (log: GenerationJob['log']) => (log ?? []).filter((entry) => !(entry.type === 'model' && /^calls /.test(entry.summary)));

const MEDIA_LABELS: Record<MediaSource, string> = {
    ai_generated: 'AI-generated',
    stock: 'Stock (Pixabay)',
    stock_or_ai: 'Stock, else AI-generated',
    admin_upload: 'I will upload',
};

/** Which cards a media source turns on: AI and Stock can be picked together (stock first, AI when no match). */
const mediaCardOn = (source: MediaSource, card: MediaSource) =>
    card === 'ai_generated' ? source === 'ai_generated' || source === 'stock_or_ai' : card === 'stock' ? source === 'stock' || source === 'stock_or_ai' : source === card;

const nextMediaSource = (source: MediaSource, card: MediaSource): MediaSource => {
    if (card === 'admin_upload') return 'admin_upload';
    const ai = mediaCardOn(source, 'ai_generated');
    const stock = mediaCardOn(source, 'stock');
    const nextAi = card === 'ai_generated' ? !ai : ai;
    const nextStock = card === 'stock' ? !stock : stock;
    if (nextAi && nextStock) return 'stock_or_ai';
    if (nextStock) return 'stock';
    if (nextAi) return 'ai_generated';
    return source; // keep at least one picked
};

const MEDIA_OPTIONS: { value: MediaSource; title: string; detail: (s: GeneratorStatus | null) => string }[] = [
    {
        value: 'ai_generated',
        title: 'AI-generated',
        detail: (s) => `OpenAI makes a cover, meal photos and pictures for exercises that lack their own (about $${(s?.imageCostUsd ?? 0.02).toFixed(2)} each). No videos.`,
    },
    {
        value: 'stock',
        title: 'Stock (Pixabay)',
        detail: () => 'Free stock photos, plus short stock videos for new exercises. Matches can be loose.',
    },
    {
        value: 'admin_upload',
        title: 'I will upload',
        detail: () => 'Plans are saved without pictures. You add them on the batch page before publishing.',
    },
];

const JOB_STYLES: Record<JobStatus, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-gray-100 text-gray-600' },
    running: { label: 'Running', className: 'bg-blue-100 text-blue-700' },
    succeeded: { label: 'Ready', className: 'bg-emerald-100 text-emerald-700' },
    needs_attention: { label: 'Needs review', className: 'bg-amber-100 text-amber-800' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

const BATCH_STYLES: Record<BatchStatus, string> = {
    queued: 'bg-gray-100 text-gray-600',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
};

const capital = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

const money = (value: number | null | undefined) => `$${(value ?? 0).toFixed(2)}`;
const when = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-sm';

// ─── Small pieces ─────────────────────────────────────────────────────────────

const Chips: React.FC<{ options: string[]; value: string[]; onChange: (next: string[]) => void; label?: (v: string) => string }> = ({
    options,
    value,
    onChange,
    label = (v) => v,
}) => (
    <div className="flex flex-wrap gap-2">
        {options.map((option) => {
            const on = value.includes(option);
            return (
                <button
                    key={option}
                    type="button"
                    onClick={() => onChange(on ? value.filter((v) => v !== option) : [...value, option])}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        on ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-cyan-400'
                    }`}
                    aria-pressed={on}
                >
                    {label(option)}
                </button>
            );
        })}
    </div>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
        {children}
        {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
);

const NumberInput: React.FC<{ value: string; onChange: (v: string) => void; min: number; max: number; placeholder?: string }> = ({
    value,
    onChange,
    min,
    max,
    placeholder,
}) => <input type="number" className={inputClass} value={value} min={min} max={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;

const ServiceStatus: React.FC<{ status: GeneratorStatus | null }> = ({ status }) => {
    if (!status) return null;
    const items = [
        { name: 'OpenAI', ok: status.openai, missing: 'Plans will wait in the queue until OPENAI_API_KEY is set on the server.' },
        { name: 'USDA', ok: status.usda, missing: 'Diet plans need USDA_API_KEY for nutrition.' },
        { name: 'Pixabay', ok: status.pixabay, missing: 'Stock media needs PIXABAY_API_KEY.' },
    ];
    const problems = items.filter((item) => !item.ok);
    return (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            {items.map((item) => (
                <span key={item.name} className="inline-flex items-center gap-1">
                    {item.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    {item.name}
                </span>
            ))}
            <span className="text-gray-400">Model: {status.models.agent}</span>
            {problems.length > 0 && <span className="w-full text-amber-700">{problems.map((p) => p.missing).join(' ')}</span>}
        </div>
    );
};

// ─── New batch form ───────────────────────────────────────────────────────────

const NewBatchForm: React.FC<{ status: GeneratorStatus | null; onCreated: (batch: GenerationBatch) => void }> = ({ status, onCreated }) => {
    const [kind, setKind] = useState<PlanKind>('exercise');
    const [mediaSource, setMediaSource] = useState<MediaSource>('ai_generated');
    const [planCount, setPlanCount] = useState('3');
    const [costCap, setCostCap] = useState('2');
    const [brief, setBrief] = useState('');
    // Exercise
    const [levels, setLevels] = useState<string[]>(['beginner']);
    const [focusAreas, setFocusAreas] = useState<string[]>(['Full Body']);
    const [weeks, setWeeks] = useState('4');
    const [daysPerWeek, setDaysPerWeek] = useState('4');
    const [minutes, setMinutes] = useState('30');
    const [equipment, setEquipment] = useState('');
    const [noFloorExercises, setNoFloorExercises] = useState(false);
    const [lowImpactOnly, setLowImpactOnly] = useState(false);
    const [bodyweightOnly, setBodyweightOnly] = useState(false);
    // Diet
    const [goals, setGoals] = useState<string[]>(['weight_loss']);
    const [dietTypes, setDietTypes] = useState<string[]>(['Traditional']);
    const [calories, setCalories] = useState('');
    const [days, setDays] = useState('7');
    const [mealsPerDay, setMealsPerDay] = useState('4');
    const [cuisine, setCuisine] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const choices = status?.choices;
    const combos = kind === 'exercise' ? levels.length * focusAreas.length : goals.length * dietTypes.length;
    const count = Number(planCount) || 0;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        const optional = (v: string) => (v.trim() ? v.trim() : undefined);
        const settings =
            kind === 'exercise'
                ? {
                      levels,
                      focusAreas,
                      weeks: Number(weeks),
                      daysPerWeek: Number(daysPerWeek),
                      minutesPerSession: Number(minutes),
                      equipment: bodyweightOnly ? undefined : optional(equipment),
                      ...(noFloorExercises ? { noFloorExercises: true } : {}),
                      ...(lowImpactOnly ? { lowImpactOnly: true } : {}),
                      ...(bodyweightOnly ? { bodyweightOnly: true } : {}),
                      brief: optional(brief),
                  }
                : {
                      goals,
                      dietTypes,
                      caloriesPerDay: calories ? Number(calories) : undefined,
                      days: Number(days),
                      mealsPerDay: Number(mealsPerDay),
                      cuisine: optional(cuisine),
                      brief: optional(brief),
                  };
        setSubmitting(true);
        try {
            const batch = await aiGeneratorService.createBatch({
                kind,
                mediaSource,
                planCount: count,
                costCapUsd: costCap ? Number(costCap) : undefined,
                settings,
            });
            onCreated(batch);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setSubmitting(false);
        }
    };

    if (!choices) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-6">
            <div className="flex gap-2">
                {(['exercise', 'diet'] as PlanKind[]).map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setKind(value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                            kind === value ? 'bg-gradient-to-r from-teal-400 to-cyan-500 text-white border-transparent' : 'bg-white border-gray-300 text-gray-700'
                        }`}
                    >
                        {value === 'exercise' ? <Dumbbell className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                        {value === 'exercise' ? 'Exercise plans' : 'Diet plans'}
                    </button>
                ))}
            </div>

            {kind === 'exercise' ? (
                <div className="space-y-5">
                    <Field label="Levels">
                        <Chips options={choices.levels} value={levels} onChange={setLevels} label={(v) => v[0].toUpperCase() + v.slice(1)} />
                    </Field>
                    <Field label="Focus areas">
                        <Chips options={choices.focusAreas} value={focusAreas} onChange={setFocusAreas} />
                    </Field>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Field label="Weeks">
                            <NumberInput value={weeks} onChange={setWeeks} min={1} max={12} />
                        </Field>
                        <Field label="Days per week">
                            <NumberInput value={daysPerWeek} onChange={setDaysPerWeek} min={2} max={6} />
                        </Field>
                        <Field label="Minutes per session">
                            <NumberInput value={minutes} onChange={setMinutes} min={10} max={90} />
                        </Field>
                        <Field label="Equipment" hint={bodyweightOnly ? 'Off: “No equipment” is ticked below' : 'Empty = bodyweight and basic dumbbells'}>
                            <input className={inputClass} value={bodyweightOnly ? '' : equipment} disabled={bodyweightOnly} onChange={(e) => setEquipment(e.target.value)} placeholder="e.g. dumbbells, mat" />
                        </Field>
                    </div>
                    <div>
                        <span className="block text-sm font-medium text-gray-700 mb-1">Rules</span>
                        <p className="text-xs text-gray-500 mb-2">Ticked rules are checked automatically on every exercise, so a plan that breaks one is never saved. Use “Extra instructions” for anything else.</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                            {[
                                { label: 'No floor exercises', hint: 'standing or seated only', on: noFloorExercises, set: setNoFloorExercises },
                                { label: 'Low impact only', hint: 'no jumping or running', on: lowImpactOnly, set: setLowImpactOnly },
                                { label: 'No equipment', hint: 'bodyweight only', on: bodyweightOnly, set: setBodyweightOnly },
                            ].map((rule) => (
                                <label key={rule.label} className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 accent-cyan-600" checked={rule.on} onChange={(e) => rule.set(e.target.checked)} />
                                    <span>
                                        {rule.label} <span className="text-xs text-gray-500">({rule.hint})</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <Field label="Goals">
                        <Chips options={choices.dietGoals} value={goals} onChange={setGoals} label={(v) => GOAL_LABELS[v] ?? v} />
                    </Field>
                    <Field label="Diet types">
                        <Chips options={choices.dietTypes} value={dietTypes} onChange={setDietTypes} />
                    </Field>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Field label="Calories per day" hint="Empty = based on the goal">
                            <NumberInput value={calories} onChange={setCalories} min={1000} max={4500} placeholder="e.g. 1800" />
                        </Field>
                        <Field label="Days in the menu">
                            <NumberInput value={days} onChange={setDays} min={1} max={14} />
                        </Field>
                        <Field label="Meals per day">
                            <NumberInput value={mealsPerDay} onChange={setMealsPerDay} min={3} max={6} />
                        </Field>
                        <Field label="Cuisine" hint="Empty = Pakistani. Every meal will be a home dish of this cuisine.">
                            <input className={inputClass} value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="e.g. Pakistani" />
                        </Field>
                    </div>
                </div>
            )}

            <Field label="Extra instructions (optional)" hint="Anything the plans should follow, e.g. “no jumping, for people with knee pain”.">
                <textarea className={`${inputClass} min-h-[72px]`} value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={2000} />
            </Field>

            <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">Pictures and videos</span>
                <div className="grid md:grid-cols-3 gap-3">
                    {MEDIA_OPTIONS.map((option) => {
                        const unavailable = option.value === 'stock' && !status?.pixabay;
                        const on = mediaCardOn(mediaSource, option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                disabled={unavailable}
                                onClick={() => setMediaSource(nextMediaSource(mediaSource, option.value))}
                                className={`text-left p-4 rounded-xl border-2 transition-colors ${
                                    on ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:border-cyan-300'
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200`}
                            >
                                <span className="block font-semibold text-gray-900 text-sm">{option.title}</span>
                                <span className="block text-xs text-gray-600 mt-1">{unavailable ? 'Not available: PIXABAY_API_KEY is not set on the server.' : option.detail(status)}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    {mediaSource === 'stock_or_ai'
                        ? 'Both picked: a stock photo is used when Pixabay has a match, otherwise OpenAI makes one (about $' + (status?.imageCostUsd ?? 0.02).toFixed(2) + ' each). New exercises also get stock videos.'
                        : 'Tip: pick both AI-generated and Stock to try Pixabay first and fall back to AI pictures.'}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Number of plans" hint={combos > 1 ? `Spread over ${combos} combinations` : undefined}>
                    <NumberInput value={planCount} onChange={setPlanCount} min={1} max={status?.limits.maxPlansPerBatch ?? 30} />
                </Field>
                <Field label="Spending limit (USD)" hint="New plans stop starting once reached">
                    <NumberInput value={costCap} onChange={setCostCap} min={0} max={status?.limits.maxCostCapUsd ?? 100} />
                </Field>
            </div>

            {count > 0 && combos > count && (
                <p className="text-sm text-amber-700">
                    You picked {combos} combinations but only {count} plans, so some combinations get no plan.
                </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={submitting || combos === 0 || count < 1}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-medium shadow disabled:opacity-60"
            >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate {count || ''} {kind === 'exercise' ? 'exercise' : 'diet'} plan{count === 1 ? '' : 's'}
            </button>
        </form>
    );
};

// ─── Batch list ───────────────────────────────────────────────────────────────

const progressText = (batch: GenerationBatch) => {
    const c = batch.jobCounts ?? {};
    const done = (c.succeeded ?? 0) + (c.needs_attention ?? 0);
    // "Apply ideas" adds plans to a batch, so count its jobs rather than the number it started with.
    const total = Math.max(batch.planCount, Object.values(c).reduce((sum, n) => sum + (n ?? 0), 0));
    const parts = [`${done}/${total} made`];
    if (c.needs_attention) parts.push(`${c.needs_attention} to review`);
    if (c.failed) parts.push(`${c.failed} failed`);
    return parts.join(' · ');
};

const settingsText = (batch: GenerationBatch) => {
    const s = batch.settings ?? {};
    if (batch.kind === 'exercise') return `${(s.levels ?? []).map(capital).join(', ')} · ${(s.focusAreas ?? []).join(', ')} · ${s.weeks}w × ${s.daysPerWeek}d`;
    return `${(s.goals ?? []).map((g: string) => GOAL_LABELS[g] ?? g).join(', ')} · ${(s.dietTypes ?? []).join(', ')} · ${s.days} days`;
};

const BatchList: React.FC<{ batches: GenerationBatch[]; onOpen: (id: string) => void }> = ({ batches, onOpen }) => {
    if (!batches.length) return <p className="text-sm text-gray-500 py-6 text-center">No batches yet.</p>;
    return (
        <div className="divide-y divide-gray-100">
            {batches.map((batch) => (
                <button key={batch.id} type="button" onClick={() => onOpen(batch.id)} className="w-full flex items-center gap-4 py-3 px-2 text-left hover:bg-gray-50 rounded-lg">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        {batch.kind === 'exercise' ? <Dumbbell className="w-4 h-4 text-white" /> : <Utensils className="w-4 h-4 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{settingsText(batch)}</div>
                        <div className="text-xs text-gray-500">
                            {when(batch.createdAt)} · {progressText(batch)} · {money(batch.costUsd)}
                        </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${BATCH_STYLES[batch.status]}`}>{batch.status}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            ))}
        </div>
    );
};

// ─── Batch detail ─────────────────────────────────────────────────────────────

const specText = (job: GenerationJob) => {
    const s = job.spec ?? {};
    if (s.kind === 'diet') return `${GOAL_LABELS[s.goal] ?? s.goal} · ${s.dietType}${s.variant > 1 ? ` · variant ${s.variant}` : ''}`;
    return `${capital(s.level ?? '')} · ${s.focusArea}${s.variant > 1 ? ` · variant ${s.variant}` : ''}`;
};

const IDEAS_HEADING = 'Optional ideas from the coach review:';

/** The coach review's optional ideas for a job: stored on newer jobs, read from the message on older ones. */
const coachIdeas = (job: GenerationJob): string[] => {
    if (job.reviewData?.suggestions?.length) return job.reviewData.suggestions;
    const message = job.errorMessage ?? '';
    const start = message.indexOf(IDEAS_HEADING);
    if (start < 0) return [];
    return message
        .slice(start + IDEAS_HEADING.length)
        .split('\n\n')[0]
        .split('\n')
        .map((line) => line.replace(/^\s*•\s*/, '').trim())
        .filter(Boolean);
};

const JobRow: React.FC<{
    job: GenerationJob;
    plan: BatchPlan | undefined;
    busy: boolean;
    onPreview: (planId: string) => void;
    onPublish: (planId: string) => void;
    onDiscard: (planId: string) => void;
    onRetry: (job: GenerationJob) => void;
    onRevise: (job: GenerationJob, ideas: string[]) => Promise<boolean>;
}> = ({ job, plan, busy, onPreview, onPublish, onDiscard, onRetry, onRevise }) => {
    // A finished plan can be made again, unless it is already live in the app.
    const canRetry = job.status !== 'queued' && job.status !== 'running' && plan?.status !== 'published';
    const [showLog, setShowLog] = useState(false);
    const ideas = useMemo(() => coachIdeas(job), [job]);
    const canRevise = !!plan && ideas.length > 0 && job.status !== 'queued' && job.status !== 'running';
    const [showIdeas, setShowIdeas] = useState(false);
    const [picked, setPicked] = useState<Set<number>>(new Set());
    const revision = job.spec?.revision as { fromPosition: number; ideas: string[] } | undefined;
    const togglePick = (index: number) =>
        setPicked((current) => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    const style = JOB_STYLES[job.status];
    return (
        <div className="py-3">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-gray-400 w-6">#{job.position + 1}</span>
                {plan?.image ? (
                    <img src={plan.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{plan?.name ?? specText(job)}</div>
                    <div className="text-xs text-gray-500">
                        {specText(job)} · {money(job.costUsd)}
                        {job.attempts > 1 ? ` · ${job.attempts} tries` : ''}
                        {revision ? ` · ideas applied to #${revision.fromPosition + 1}` : ''}
                    </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.className}`}>
                    {job.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {style.label}
                </span>
                {plan && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plan.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {plan.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                )}
                <div className="flex items-center gap-1">
                    {plan && (
                        <button type="button" onClick={() => onPreview(plan.id)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100" title="Review plan">
                            <Eye className="w-4 h-4" />
                        </button>
                    )}
                    {plan?.status === 'draft' && (
                        <>
                            <button type="button" disabled={busy} onClick={() => onPublish(plan.id)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Publish">
                                <Upload className="w-4 h-4" />
                            </button>
                            <button type="button" disabled={busy || job.status === 'running'} onClick={() => onDiscard(plan.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" title="Discard">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                    {canRevise && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowIdeas((v) => !v)}
                            className={`p-2 rounded-lg text-violet-700 hover:bg-violet-50 disabled:opacity-50 ${showIdeas ? 'bg-violet-50' : ''}`}
                            title="Make a new version with some of the coach's ideas"
                        >
                            <Wand2 className="w-4 h-4" />
                        </button>
                    )}
                    {canRetry && (
                        <button type="button" disabled={busy} onClick={() => onRetry(job)} className="p-2 rounded-lg text-cyan-700 hover:bg-cyan-50 disabled:opacity-50" title="Make this plan again (same settings)">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                    <button type="button" onClick={() => setShowLog((v) => !v)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Agent steps">
                        {showLog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            {job.errorMessage && (
                <p className={`mt-2 ml-9 text-xs whitespace-pre-line ${job.status === 'failed' ? 'text-red-600' : 'text-amber-700'}`}>{job.errorMessage}</p>
            )}
            {canRevise && showIdeas && (
                <div className="mt-2 ml-9 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                    <p className="text-xs font-medium text-gray-800">Pick the ideas to apply</p>
                    <p className="text-xs text-gray-500 mb-2">
                        A new plan is added to this batch with these changes. This one stays as it is, so you can publish the version you prefer and discard the other.
                    </p>
                    <div className="space-y-1.5">
                        {ideas.map((idea, index) => (
                            <label key={index} className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" className="mt-0.5 accent-violet-600" checked={picked.has(index)} onChange={() => togglePick(index)} />
                                <span>{idea}</span>
                            </label>
                        ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={busy || picked.size === 0}
                            onClick={async () => {
                                const done = await onRevise(
                                    job,
                                    ideas.filter((_, index) => picked.has(index)),
                                );
                                if (done) {
                                    setShowIdeas(false);
                                    setPicked(new Set());
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            Make new version{picked.size ? ` with ${picked.size} idea${picked.size === 1 ? '' : 's'}` : ''}
                        </button>
                        <button type="button" onClick={() => setPicked(picked.size === ideas.length ? new Set() : new Set(ideas.map((_, i) => i)))} className="text-xs text-violet-700 hover:underline">
                            {picked.size === ideas.length ? 'Clear all' : 'Pick all'}
                        </button>
                    </div>
                </div>
            )}
            {showLog && (
                <ol className="mt-2 ml-9 space-y-1 border-l-2 border-gray-100 pl-3 max-h-72 overflow-y-auto">
                    {visibleSteps(job.log).length === 0 && <li className="text-xs text-gray-400">No steps yet.</li>}
                    {visibleSteps(job.log).map((entry, index) => (
                        <li key={index} className="text-xs text-gray-600">
                            <span className="text-gray-400">{new Date(entry.at).toLocaleTimeString()}</span>{' '}
                            <span className="font-medium text-gray-800">{stepLabel(entry)}</span>: {entry.summary}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

const BatchDetail: React.FC<{ batchId: string; onBack: () => void }> = ({ batchId, onBack }) => {
    const [batch, setBatch] = useState<GenerationBatch | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [previewId, setPreviewId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setBatch(await aiGeneratorService.getBatch(batchId));
            setError('');
        } catch (err) {
            setError(handleApiError(err));
        }
    }, [batchId]);

    const open = !!batch?.jobs?.some((job) => job.status === 'queued' || job.status === 'running');

    useEffect(() => {
        load();
    }, [load]);

    // Follow the batch while plans are still being made.
    useEffect(() => {
        if (!open) return;
        const timer = window.setInterval(load, 5000);
        return () => window.clearInterval(timer);
    }, [open, load]);

    const planById = useMemo(() => new Map((batch?.plans ?? []).map((plan) => [plan.id, plan])), [batch]);
    const drafts = (batch?.plans ?? []).filter((plan) => plan.status === 'draft');
    const missingPictures = batch?.mediaSource === 'admin_upload' ? drafts.filter((plan) => !plan.image).length : 0;

    const run = async (action: () => Promise<string>) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            setNotice(await action());
            await load();
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setBusy(false);
        }
    };

    const publish = (planIds?: string[]) => {
        const count = planIds?.length ?? drafts.length;
        // Plans the coach review flagged, or whose job failed, deserve a second look before going live.
        const picked = new Set(planIds ?? drafts.map((plan) => plan.id));
        const flagged = (batch?.jobs ?? []).filter((job) => job.resultPlanId && picked.has(job.resultPlanId) && job.status === 'needs_attention').length;
        const warning = !flagged
            ? ''
            : count === 1
              ? ' It is marked “Needs review”: the coach review found something to fix first.'
              : ` ${flagged} of them ${flagged === 1 ? 'is' : 'are'} marked “Needs review”: the coach review found something to fix first.`;
        if (!window.confirm(`Publish ${count} plan${count === 1 ? '' : 's'}? Users will see ${count === 1 ? 'it' : 'them'} in the app.${warning}`)) return;
        run(async () => {
            const result = await aiGeneratorService.publish(batchId, planIds);
            const extras = [
                ...(result.exercises ? [`${result.exercises} new exercise${result.exercises === 1 ? '' : 's'}`] : []),
                ...(result.pictures ? [`new pictures for ${result.pictures} exercise${result.pictures === 1 ? '' : 's'} already in the app`] : []),
            ];
            return `Published ${result.plans} plan${result.plans === 1 ? '' : 's'}${extras.length ? ` (plus ${extras.join(' and ')})` : ''}.`;
        });
    };

    const discard = (planIds?: string[]) => {
        const count = planIds?.length ?? drafts.length;
        if (!window.confirm(`Delete ${count} draft plan${count === 1 ? '' : 's'}? This cannot be undone.`)) return;
        run(async () => {
            await aiGeneratorService.discard(batchId, planIds);
            return `Deleted ${count} draft${count === 1 ? '' : 's'}.`;
        });
    };

    const retry = (job: GenerationJob) => {
        const hasDraft = !!job.resultPlanId && planById.get(job.resultPlanId)?.status === 'draft';
        const question = hasDraft
            ? 'Make this plan again with the same settings? Its current draft will be replaced by the new one.'
            : 'Make this plan again with the same settings?';
        if (!window.confirm(question)) return;
        run(async () => {
            try {
                await aiGeneratorService.retryJob(batchId, job.id);
            } catch (err: any) {
                // The batch has used its spending limit: offer to raise it by $1 for this retry.
                if (err?.response?.data?.code !== 'COST_CAP') throw err;
                if (!window.confirm(`${handleApiError(err)} Raise the limit by $1 and make the plan again?`)) return 'Nothing changed.';
                await aiGeneratorService.retryJob(batchId, job.id, 1);
            }
            return 'The plan is being made again. This page updates by itself.';
        });
    };

    /** Resolves true when the new version was queued. */
    const revise = async (job: GenerationJob, ideas: string[]) => {
        let queued = false;
        await run(async () => {
            try {
                await aiGeneratorService.reviseJob(batchId, job.id, ideas);
            } catch (err: any) {
                if (err?.response?.data?.code !== 'COST_CAP') throw err;
                if (!window.confirm(`${handleApiError(err)} Raise the limit by $1 and make the new version?`)) return 'Nothing changed.';
                await aiGeneratorService.reviseJob(batchId, job.id, ideas, 1);
            }
            queued = true;
            return `A new version of plan #${job.position + 1} is being made with ${ideas.length} idea${ideas.length === 1 ? '' : 's'}. It appears at the bottom of this list.`;
        });
        return queued;
    };

    const cancel = () => {
        if (!window.confirm('Stop this batch? Plans not started yet are cancelled; a plan being made now still finishes.')) return;
        run(async () => {
            const result = await aiGeneratorService.cancel(batchId);
            return `Cancelled ${result.cancelledJobs} plan${result.cancelledJobs === 1 ? '' : 's'}${result.stillRunning ? '; one is still finishing' : ''}.`;
        });
    };

    if (!batch) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4" /> All batches
                </button>
                {error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" /> All batches
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-gray-900">{settingsText(batch)}</h2>
                        <p className="text-sm text-gray-500">
                            {batch.kind === 'exercise' ? 'Exercise' : 'Diet'} plans · {MEDIA_LABELS[batch.mediaSource] ?? batch.mediaSource} · started {when(batch.createdAt)}
                            {batch.createdBy ? ` by ${batch.createdBy.username ?? batch.createdBy.email}` : ''}
                        </p>
                        {batch.settings?.brief && <p className="text-sm text-gray-600 mt-1">“{batch.settings.brief}”</p>}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${BATCH_STYLES[batch.status]}`}>{batch.status}</span>
                </div>

                <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                        <div className="text-gray-500 text-xs">Progress</div>
                        <div className="font-medium">{progressText({ ...batch, jobCounts: countJobs(batch.jobs ?? []) })}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs">Spent</div>
                        <div className="font-medium">
                            {money(batch.costUsd)}
                            {batch.costCapUsd ? <span className="text-gray-400"> of {money(batch.costCapUsd)}</span> : null}
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs">Drafts waiting</div>
                        <div className="font-medium">{drafts.length}</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                    {(batch.status === 'queued' || batch.status === 'running') && (
                        <button type="button" disabled={busy} onClick={cancel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            <Ban className="w-4 h-4" /> Stop batch
                        </button>
                    )}
                    {drafts.length > 0 && (
                        <>
                            <button type="button" disabled={busy} onClick={() => publish()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
                                <Upload className="w-4 h-4" /> Publish all drafts
                            </button>
                            <button type="button" disabled={busy || open} onClick={() => discard()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" title={open ? 'Stop the batch first' : undefined}>
                                <Trash2 className="w-4 h-4" /> Discard all drafts
                            </button>
                        </>
                    )}
                </div>

                {missingPictures > 0 && (
                    <p className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="w-4 h-4" /> {missingPictures} draft{missingPictures === 1 ? ' has' : 's have'} no cover picture yet. Open a plan to add pictures.
                    </p>
                )}
                {notice && <p className="text-sm text-emerald-700">{notice}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-2 divide-y divide-gray-100">
                {(batch.jobs ?? []).map((job) => (
                    <JobRow
                        key={job.id}
                        job={job}
                        plan={job.resultPlanId ? planById.get(job.resultPlanId) : undefined}
                        busy={busy}
                        onPreview={setPreviewId}
                        onPublish={(id) => publish([id])}
                        onDiscard={(id) => discard([id])}
                        onRetry={retry}
                        onRevise={revise}
                    />
                ))}
            </div>

            {previewId && (
                <AiPlanPreview
                    batchId={batch.id}
                    planId={previewId}
                    canEditMedia={planById.get(previewId)?.status === 'draft' || batch.mediaSource === 'admin_upload'}
                    onClose={() => setPreviewId(null)}
                    onChanged={load}
                />
            )}
        </div>
    );
};

const countJobs = (jobs: GenerationJob[]) =>
    jobs.reduce<Partial<Record<JobStatus, number>>>((acc, job) => ({ ...acc, [job.status]: (acc[job.status] ?? 0) + 1 }), {});

// ─── Page ─────────────────────────────────────────────────────────────────────

const AiGeneratorComponent: React.FC = () => {
    const [status, setStatus] = useState<GeneratorStatus | null>(null);
    const [batches, setBatches] = useState<GenerationBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openBatchId, setOpenBatchId] = useState<string | null>(null);

    const loadBatches = useCallback(async () => {
        try {
            setBatches(await aiGeneratorService.listBatches());
            setError('');
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        aiGeneratorService.status().then(setStatus).catch((err) => setError(handleApiError(err)));
        loadBatches();
    }, [loadBatches]);

    if (openBatchId) {
        return (
            <BatchDetail
                batchId={openBatchId}
                onBack={() => {
                    setOpenBatchId(null);
                    loadBatches();
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-500" /> Generate plans
                    </h2>
                    <p className="text-sm text-gray-500">
                        Plans are saved as drafts that only admins can see. Review them on the batch page, then publish.
                    </p>
                </div>
                <ServiceStatus status={status} />
                <NewBatchForm status={status} onCreated={(batch) => setOpenBatchId(batch.id)} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">Batches</h2>
                    <button type="button" onClick={loadBatches} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                {loading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                    </div>
                ) : (
                    <BatchList batches={batches} onOpen={setOpenBatchId} />
                )}
            </div>
        </div>
    );
};

export default AiGeneratorComponent;
