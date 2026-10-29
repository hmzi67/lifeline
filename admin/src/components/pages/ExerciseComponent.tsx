import React, { useState, useEffect, useCallback } from 'react';
import {
    Dumbbell, Plus, Loader2, AlertCircle, Timer, Flame, Edit, Trash2,
    ImageIcon, Video, Search, ChevronRight, RotateCcw, Save, ArrowLeft, X,
    Activity, Sprout, TrendingUp, Zap, FileText, Film, Eye, Target,
    Repeat2, SlidersHorizontal, ClipboardList, ShieldAlert, Tag, Clapperboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/axios';
import { MediaUploadField } from '@/components/shared/MediaUploadField';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface User { id: string; email: string; username: string; }
interface Challenge { id: string; name: string; status: string; }
interface UserExercise { user: User; }
interface ChallengeExercise { challenge: Challenge; }

interface ExerciseDetailData {
    id: string;
    exerciseId: string;
    sets: number | null;
    reps: string | null;
    calories: number | null;
    timeRequired: string | null;
    mediaUrl: string | null;
    instructions: string | null;
}

interface Exercise {
    id: string;
    name: string | null;
    purpose: string | null;
    description: string | null;
    image: string | null;
    duration: string | null;
    displayDuration: string | null;
    videoUrl: string | null;
    difficulty: string | null;
    caloriesBurnEstimate: number | null;
    userExercises?: UserExercise[];
    challengeExercises?: ChallengeExercise[];
    exerciseDetails?: ExerciseDetailData[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FOCUS_AREAS = [
    { label: 'Full Body', value: 'Full Body' },
    { label: 'Shoulders', value: 'Shoulders' },
    { label: 'Chest', value: 'Chest' },
    { label: 'Arms', value: 'Arms' },
    { label: 'Back', value: 'Back' },
    { label: 'Belly / Core', value: 'Belly / Core' },
    { label: 'Legs', value: 'Legs' },
];

const DIFFICULTY_OPTIONS: { value: string; label: string; Icon: LucideIcon; iconClass: string; active: string; hover: string }[] = [
    { value: 'Beginner', label: 'Beginner', Icon: Sprout, iconClass: 'text-green-500', active: 'border-green-500 bg-green-50 text-green-800', hover: 'hover:border-green-300' },
    { value: 'Intermediate', label: 'Intermediate', Icon: TrendingUp, iconClass: 'text-yellow-500', active: 'border-yellow-500 bg-yellow-50 text-yellow-800', hover: 'hover:border-yellow-300' },
    { value: 'Advanced', label: 'Advanced', Icon: Zap, iconClass: 'text-red-500', active: 'border-red-500 bg-red-50 text-red-800', hover: 'hover:border-red-300' },
];

const EXERCISE_TYPES = [
    'Strength Training', 'Cardio', 'HIIT',
    'Flexibility / Stretching', 'Balance & Stability', 'Plyometrics',
];

const EQUIPMENT_OPTIONS = [
    'No Equipment (Bodyweight)', 'Dumbbells', 'Barbell',
    'Resistance Band', 'Pull-up Bar', 'Gym Machine', 'Kettlebell',
];

const MUSCLE_GROUPS = [
    'Pectoralis Major (Chest)', 'Biceps', 'Triceps',
    'Deltoids (Shoulders)', 'Latissimus Dorsi (Back)',
    'Quadriceps', 'Hamstrings', 'Glutes', 'Abdominals (Core)',
];

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
    { id: 'basic', label: 'Basic Info', Icon: FileText },
    { id: 'media', label: 'Media & Instructions', Icon: Film },
    { id: 'preview', label: 'Preview', Icon: Eye },
];

type TabId = 'basic' | 'media' | 'preview';

const DEFAULT_FORM = {
    name: '',
    description: '',
    focusAreas: [] as string[],
    duration: '',
    displayDuration: '',
    videoUrl: '',
    image: '',
    difficulty: 'Intermediate',
    caloriesBurnEstimate: '',
    sets: '',
    reps: '',
    rest: '',
    instructions: '',
    safetyTips: '',
    exerciseType: 'Strength Training',
    equipment: 'No Equipment (Bodyweight)',
    muscleGroup: 'Pectoralis Major (Chest)',
};

type FormData = typeof DEFAULT_FORM;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Seeded and app-created rows store lowercase ("beginner"); the admin form uses Title case.
const normalizeDifficulty = (d: string | null | undefined) =>
    d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : '';

const diffBadgeClass = (d: string | null) => {
    const map: Record<string, string> = {
        Beginner: 'bg-green-50 text-green-800 border border-green-300',
        Intermediate: 'bg-yellow-50 text-yellow-800 border border-yellow-300',
        Advanced: 'bg-red-50 text-red-800 border border-red-300',
    };
    return map[normalizeDifficulty(d)] ?? 'bg-gray-100 text-gray-500 border border-gray-200';
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const StepCard: React.FC<{ step: string; title: string; Icon?: LucideIcon; children: React.ReactNode }> = ({ step, title, Icon, children }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-md">
                Step {step}
            </span>
            {Icon && <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <h3 className="font-bold text-gray-800 text-[15px]">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

interface UnitInputProps {
    label: string;
    unit: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
    hint?: string;
}

const UnitInput: React.FC<UnitInputProps> = ({ label, unit, value, onChange, placeholder, type = 'text', required, hint }) => (
    <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-100 transition-all bg-white">
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-2.5 text-sm outline-none min-w-0 text-gray-800 placeholder:text-gray-400"
            />
            <span className="px-3 py-2.5 bg-teal-50 text-teal-700 text-xs font-bold border-l border-teal-100 flex items-center whitespace-nowrap">
                {unit}
            </span>
        </div>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const ExerciseComponent: React.FC = () => {
    // ── View state ─────────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [activeTab, setActiveTab] = useState<TabId>('basic');
    const [tabIdx, setTabIdx] = useState(0);

    // ── Data state ─────────────────────────────────────────────────────────
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [editingDetail, setEditingDetail] = useState<ExerciseDetailData | null>(null);

    // ── List state ─────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // ── Form state ─────────────────────────────────────────────────────────
    const [formData, setFormData] = useState<FormData>({ ...DEFAULT_FORM });

    // ── Toast ──────────────────────────────────────────────────────────────
    const [toast, setToast] = useState({ message: '', visible: false });

    // ─────────────────────────────────────────────────────────────────────
    // Data fetching
    // ─────────────────────────────────────────────────────────────────────

    const fetchExercises = useCallback(async () => {
        setLoading(true);
        setPageError('');
        try {
            const res = await api.get('/exercises');
            if (res.data.success) setExercises(res.data.data);
        } catch (err: any) {
            setPageError(err.response?.data?.message || 'Failed to fetch exercises. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchExercises(); }, [fetchExercises]);

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    const showToast = (message: string) => {
        setToast({ message, visible: true });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
    };

    const resetForm = () => {
        setFormData({ ...DEFAULT_FORM });
        setEditingExercise(null);
        setEditingDetail(null);
        setSubmitError('');
        setActiveTab('basic');
        setTabIdx(0);
    };

    const setField = (key: keyof FormData, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const toggleFocusArea = (value: string) => {
        setFormData(prev => ({
            ...prev,
            focusAreas: prev.focusAreas.includes(value)
                ? prev.focusAreas.filter(a => a !== value)
                : [...prev.focusAreas, value],
        }));
    };

    const switchTab = (id: TabId, idx: number) => {
        setActiveTab(id);
        setTabIdx(idx);
    };

    const goNext = () => {
        const next = tabIdx + 1;
        if (next < TABS.length) switchTab(TABS[next].id, next);
    };

    // ─────────────────────────────────────────────────────────────────────
    // Open create form
    // ─────────────────────────────────────────────────────────────────────

    const openCreate = () => {
        resetForm();
        setViewMode('form');
    };

    // ─────────────────────────────────────────────────────────────────────
    // Open edit form
    // ─────────────────────────────────────────────────────────────────────

    const openEdit = async (exercise: Exercise) => {
        setSubmitError('');

        const focusAreas = exercise.purpose
            ? exercise.purpose.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        // Load exercise detail
        let detail: ExerciseDetailData | null = null;
        try {
            const res = await api.get(`/exercise-details/exercise/${exercise.id}`);
            if (res.data.success && res.data.data.length > 0) {
                detail = res.data.data[0];
                setEditingDetail(detail);
            }
        } catch {
            /* no detail found — that's fine */
        }

        // Parse combined instructions back into instructions + safetyTips
        const rawInstructions = detail?.instructions ?? '';
        let instructions = rawInstructions;
        let safetyTips = '';
        const safetyMarker = '\n\nSafety Tips:\n';
        if (rawInstructions.includes(safetyMarker)) {
            const parts = rawInstructions.split(safetyMarker);
            instructions = parts[0];
            safetyTips = parts[1] ?? '';
        }

        // Strip " min" suffix from duration if present
        const duration = (exercise.duration ?? '').replace(/\s*min\s*$/i, '');

        setEditingExercise(exercise);
        setFormData({
            name: exercise.name ?? '',
            description: exercise.description ?? '',
            focusAreas,
            duration,
            displayDuration: exercise.displayDuration ?? '',
            videoUrl: exercise.videoUrl ?? '',
            image: exercise.image ?? '',
            difficulty: normalizeDifficulty(exercise.difficulty) || 'Intermediate',
            caloriesBurnEstimate: exercise.caloriesBurnEstimate?.toString() ?? '',
            sets: detail?.sets?.toString() ?? '',
            reps: detail?.reps ?? '',
            rest: detail?.timeRequired ?? '',
            instructions,
            safetyTips,
            exerciseType: 'Strength Training',
            equipment: 'No Equipment (Bodyweight)',
            muscleGroup: 'Pectoralis Major (Chest)',
        });
        setActiveTab('basic');
        setTabIdx(0);
        setViewMode('form');
    };

    // ─────────────────────────────────────────────────────────────────────
    // Submit
    // ─────────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            setSubmitError('Exercise name is required.');
            return;
        }
        setSubmitLoading(true);
        setSubmitError('');

        try {
            // Build combined instructions
            const combinedInstructions = formData.instructions
                ? (formData.safetyTips
                    ? `${formData.instructions}\n\nSafety Tips:\n${formData.safetyTips}`
                    : formData.instructions)
                : formData.safetyTips || '';

            // Exercise payload
            const exercisePayload = {
                name: formData.name.trim(),
                purpose: formData.focusAreas.length ? formData.focusAreas.join(', ') : undefined,
                description: formData.description || undefined,
                image: formData.image || undefined,
                duration: formData.duration ? `${formData.duration} min` : undefined,
                displayDuration: formData.displayDuration || undefined,
                videoUrl: formData.videoUrl || undefined,
                difficulty: formData.difficulty || undefined,
                caloriesBurnEstimate: formData.caloriesBurnEstimate
                    ? parseInt(formData.caloriesBurnEstimate)
                    : undefined,
            };

            let exerciseId: string;
            if (editingExercise) {
                await api.put(`/exercises/${editingExercise.id}`, exercisePayload);
                exerciseId = editingExercise.id;
            } else {
                const res = await api.post('/exercises', exercisePayload);
                exerciseId = res.data.data.id;
            }

            // Create/update exercise detail if any detail fields are filled
            const hasDetail = formData.sets || formData.reps || formData.rest || combinedInstructions;
            if (hasDetail) {
                const detailPayload = {
                    exerciseId,
                    sets: formData.sets ? parseInt(formData.sets) : undefined,
                    reps: formData.reps || undefined,
                    calories: formData.caloriesBurnEstimate ? parseInt(formData.caloriesBurnEstimate) : undefined,
                    timeRequired: formData.rest || undefined,
                    instructions: combinedInstructions || undefined,
                };
                if (editingDetail) {
                    await api.put(`/exercise-details/${editingDetail.id}`, detailPayload);
                } else {
                    await api.post('/exercise-details', detailPayload);
                }
            }

            showToast(`"${formData.name}" ${editingExercise ? 'updated' : 'created'} successfully!`);
            resetForm();
            setViewMode('list');
            fetchExercises();
        } catch (err: any) {
            setSubmitError(err.response?.data?.message || 'Failed to save exercise. Please try again.');
        } finally {
            setSubmitLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await api.delete(`/exercises/${deleteTarget.id}`);
            showToast(`"${deleteTarget.name}" deleted.`);
            setDeleteTarget(null);
            fetchExercises();
        } catch {
            showToast('Failed to delete exercise.');
        } finally {
            setDeleteLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // Derived data
    // ─────────────────────────────────────────────────────────────────────

    const filteredExercises = exercises.filter(e => {
        const q = searchQuery.toLowerCase();
        const matchQ = !q || e.name?.toLowerCase().includes(q) || e.purpose?.toLowerCase().includes(q);
        const matchD = !filterDifficulty || normalizeDifficulty(e.difficulty) === filterDifficulty;
        return matchQ && matchD;
    });

    const stats = {
        total: exercises.length,
        beginners: exercises.filter(e => normalizeDifficulty(e.difficulty) === 'Beginner').length,
        intermediate: exercises.filter(e => normalizeDifficulty(e.difficulty) === 'Intermediate').length,
        advanced: exercises.filter(e => normalizeDifficulty(e.difficulty) === 'Advanced').length,
        avgCal: exercises.length
            ? Math.round(exercises.reduce((s, e) => s + (e.caloriesBurnEstimate ?? 0), 0) / exercises.length)
            : 0,
    };

    // ─────────────────────────────────────────────────────────────────────
    // Loading state
    // ─────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-red-500 mx-auto" />
                    <p className="text-gray-500">Loading exercises…</p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // LIST VIEW
    // ─────────────────────────────────────────────────────────────────────

    if (viewMode === 'list') {
        return (
            <div className="space-y-6">

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl">
                            <Dumbbell className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Exercise Management</h2>
                            <p className="text-sm text-gray-500">Manage your full exercise library</p>
                        </div>
                    </div>
                    <Button
                        onClick={openCreate}
                        className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Add Exercise
                    </Button>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                            <Activity className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                        <div className="text-sm text-gray-500 mt-0.5">Total Exercises</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                            <Sprout className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="text-3xl font-bold text-green-600">{stats.beginners}</div>
                        <div className="text-sm text-gray-500 mt-0.5">Beginner</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center mb-3">
                            <TrendingUp className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div className="text-3xl font-bold text-yellow-600">{stats.intermediate}</div>
                        <div className="text-sm text-gray-500 mt-0.5">Intermediate</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
                            <Flame className="w-5 h-5 text-orange-400" />
                        </div>
                        <div className="text-3xl font-bold text-orange-500">{stats.avgCal}</div>
                        <div className="text-sm text-gray-500 mt-0.5">Avg Calories</div>
                    </div>
                </div>

                {/* Table panel */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                    {/* Panel header with search/filter */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf] animate-pulse" />
                            <h3 className="font-bold text-gray-900 text-lg">Exercise Library</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 gap-2 focus-within:border-red-400 transition-colors">
                                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search exercises…"
                                    className="bg-transparent text-sm outline-none w-44 text-gray-700 placeholder:text-gray-400"
                                />
                            </div>
                            <select
                                value={filterDifficulty}
                                onChange={e => setFilterDifficulty(e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none cursor-pointer focus:border-red-400"
                            >
                                <option value="">All Levels</option>
                                <option>Beginner</option>
                                <option>Intermediate</option>
                                <option>Advanced</option>
                            </select>
                        </div>
                    </div>

                    {pageError && (
                        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600">{pageError}</p>
                        </div>
                    )}

                    {filteredExercises.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-100">
                                        {['Exercise', 'Focus Area', 'Duration', 'Difficulty', 'Calories', 'Users', 'Actions'].map(h => (
                                            <th key={h} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredExercises.map(ex => (
                                        <tr key={ex.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {ex.image ? (
                                                        <img
                                                            src={ex.image}
                                                            alt={ex.name ?? ''}
                                                            className="w-10 h-10 rounded-lg object-cover border border-gray-100"
                                                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                                                            <Dumbbell className="w-5 h-5 text-red-300" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-sm">{ex.name}</div>
                                                        {ex.videoUrl && (
                                                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                                <Video className="w-3 h-3" /> Video
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {ex.purpose ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                                                        {ex.purpose.split(',')[0].trim()}
                                                    </span>
                                                ) : <span className="text-gray-300 text-sm">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {ex.duration ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Timer className="w-4 h-4 text-blue-400" />{ex.duration}
                                                    </div>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {ex.difficulty ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${diffBadgeClass(ex.difficulty)}`}>
                                                        {ex.difficulty}
                                                    </span>
                                                ) : <span className="text-gray-300 text-sm">—</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {ex.caloriesBurnEstimate ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Flame className="w-4 h-4 text-orange-400" />
                                                        <span className="text-sm font-bold text-orange-500">{ex.caloriesBurnEstimate} kcal</span>
                                                    </div>
                                                ) : <span className="text-gray-300 text-sm">—</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                                                    {ex.userExercises?.length ?? 0} users
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEdit(ex)}
                                                        title="Edit"
                                                        className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(ex)}
                                                        title="Delete"
                                                        className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-16 px-6">
                            <Dumbbell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-400 mb-2">
                                {searchQuery || filterDifficulty ? 'No exercises match your search' : 'No exercises yet'}
                            </h3>
                            <p className="text-sm text-gray-400 mb-6">
                                {searchQuery || filterDifficulty ? 'Try a different filter or search term' : 'Add your first exercise to get started'}
                            </p>
                            {!searchQuery && !filterDifficulty && (
                                <Button onClick={openCreate} className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white">
                                    <Plus className="w-4 h-4 mr-2" /> Add Exercise
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Delete confirm modal */}
                {deleteTarget && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-[95vw] overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                    <h3 className="font-bold text-gray-900">Delete Exercise</h3>
                                </div>
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                <p className="text-sm text-gray-600">
                                    Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteTarget.name || 'this exercise'}</span>? This action cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleDelete} disabled={deleteLoading} className="bg-red-600 hover:bg-red-700 text-white">
                                        {deleteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : 'Delete'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // FORM VIEW
    // ─────────────────────────────────────────────────────────────────────

    const diffOption = DIFFICULTY_OPTIONS.find(d => d.value === formData.difficulty);
    const previewAreas = formData.focusAreas.join(' • ') || 'No focus area selected';

    return (
        <div className="space-y-5 pb-28">

            {/* Form header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { resetForm(); setViewMode('list'); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {editingExercise ? 'Edit Exercise' : 'Add New Exercise'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {editingExercise ? `Editing "${editingExercise.name}"` : 'Fill in the exercise details below'}
                        </p>
                    </div>
                </div>
                {tabIdx === 2 && (
                    <Button
                        onClick={handleSubmit}
                        disabled={submitLoading}
                        className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg"
                    >
                        {submitLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {submitLoading ? 'Saving…' : editingExercise ? 'Update Exercise' : 'Save Exercise'}
                    </Button>
                )}
            </div>

            {/* Tab bar */}
            <div className="flex items-center bg-white border border-gray-100 shadow-sm rounded-xl p-1 gap-1 w-fit">
                {TABS.map((tab, idx) => (
                    <button
                        key={tab.id}
                        onClick={() => switchTab(tab.id, idx)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                            }`}
                    >
                        <tab.Icon className="w-4 h-4 flex-shrink-0" />{tab.label}
                    </button>
                ))}
            </div>

            {/* ── TAB 1: BASIC INFO ── */}
            {activeTab === 'basic' && (
                <div className="space-y-4">

                    <StepCard step="01" title="Exercise Info" Icon={Tag}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                    Exercise Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setField('name', e.target.value)}
                                    placeholder="e.g. Push-Up, Barbell Squat, Plank"
                                    className="border-gray-200 focus:border-red-400 focus:ring-red-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Description</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={e => setField('description', e.target.value)}
                                    placeholder="Brief description of the exercise and its benefits…"
                                    rows={3}
                                    className="resize-none border-gray-200 focus:border-red-400 focus:ring-red-100"
                                />
                            </div>
                        </div>
                    </StepCard>

                    <StepCard step="02" title="Select Focus Area" Icon={Target}>
                        <div className="space-y-3">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                Focus Area <span className="text-red-500">*</span>
                                <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-gray-400">(Multiple allowed)</span>
                            </Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {FOCUS_AREAS.map(fa => (
                                    <button
                                        key={fa.value}
                                        type="button"
                                        onClick={() => toggleFocusArea(fa.value)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] text-sm font-medium transition-all ${formData.focusAreas.includes(fa.value)
                                            ? 'bg-teal-50 border-teal-400 text-teal-800 font-semibold shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50'
                                            }`}
                                    >
                                        {fa.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-gray-400">Which body-part section this exercise will appear in on the app</p>
                        </div>
                    </StepCard>

                    <StepCard step="03" title="Sets &amp; Reps" Icon={Repeat2}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <UnitInput label="Number of Sets" required unit="sets" value={formData.sets} onChange={v => setField('sets', v)} placeholder="3" type="number" />
                            <UnitInput label="Reps per Set" required unit="reps" value={formData.reps} onChange={v => setField('reps', v)} placeholder="12" type="number" />
                            <UnitInput label="Rest Between Sets" required unit="sec" value={formData.rest} onChange={v => setField('rest', v)} placeholder="60" type="number" />
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Hold / Tempo</Label>
                                <div className="flex border border-gray-200 rounded-lg overflow-hidden focus-within:border-red-400 transition-colors bg-white">
                                    <input type="number" placeholder="30" className="flex-1 px-3 py-2.5 text-sm outline-none min-w-0 text-gray-800 placeholder:text-gray-400" />
                                    <span className="px-3 py-2.5 bg-teal-50 text-teal-700 text-xs font-bold border-l border-teal-100 flex items-center">sec</span>
                                </div>
                                <p className="text-[11px] text-gray-400">For isometric holds (plank, wall sit)</p>
                            </div>
                        </div>
                    </StepCard>

                    <StepCard step="04" title="Duration &amp; Calories" Icon={Timer}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <UnitInput label="Total Duration" required unit="min" value={formData.duration} onChange={v => setField('duration', v)} placeholder="15" type="number" />
                            <UnitInput label="Calories to Burn" required unit="kcal" value={formData.caloriesBurnEstimate} onChange={v => setField('caloriesBurnEstimate', v)} placeholder="120" type="number" />
                        </div>
                    </StepCard>

                    <StepCard step="05" title="Difficulty &amp; Classification" Icon={SlidersHorizontal}>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                    Difficulty Level <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex gap-3">
                                    {DIFFICULTY_OPTIONS.map(d => (
                                        <button
                                            key={d.value}
                                            type="button"
                                            onClick={() => setField('difficulty', d.value)}
                                            className={`flex-1 py-3 rounded-xl border-2 text-center text-sm font-medium transition-all cursor-pointer ${formData.difficulty === d.value
                                                ? d.active
                                                : `border-gray-200 bg-white text-gray-500 ${d.hover}`
                                                }`}
                                        >
                                            <d.Icon className={`w-5 h-5 mx-auto mb-1.5 ${formData.difficulty === d.value ? d.iconClass : 'text-gray-300'}`} />
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Exercise Type</Label>
                                    <Select value={formData.exerciseType} onValueChange={v => setField('exerciseType', v)}>
                                        <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                                        <SelectContent>{EXERCISE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Equipment Required</Label>
                                    <Select value={formData.equipment} onValueChange={v => setField('equipment', v)}>
                                        <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                                        <SelectContent>{EQUIPMENT_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Primary Muscle Group</Label>
                                    <Select value={formData.muscleGroup} onValueChange={v => setField('muscleGroup', v)}>
                                        <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                                        <SelectContent>{MUSCLE_GROUPS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </StepCard>
                </div>
            )}

            {/* ── TAB 2: MEDIA & INSTRUCTIONS ── */}
            {activeTab === 'media' && (
                <div className="space-y-4">
                    <StepCard step="06" title="Media" Icon={Clapperboard}>
                        <div className="space-y-5">
                            <MediaUploadField
                                label="Demo Video"
                                value={formData.videoUrl}
                                onChange={(value) => setField('videoUrl', value)}
                                accept="video/*"
                                mediaKind="video"
                                placeholder="https://example.com/exercise-demo.mp4"
                            />
                            <MediaUploadField
                                label="Thumbnail Image"
                                value={formData.image}
                                onChange={(value) => setField('image', value)}
                                accept="image/*"
                                mediaKind="image"
                                placeholder="https://example.com/exercise-thumbnail.jpg"
                            />
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Display Duration</Label>
                                <Input
                                    value={formData.displayDuration}
                                    onChange={e => setField('displayDuration', e.target.value)}
                                    placeholder="e.g. 3:45 or 45 seconds"
                                    className="border-gray-200 focus:border-red-400"
                                />
                                <p className="text-[10px] text-gray-400">How the duration appears to users (e.g. &ldquo;3:45&rdquo;, &ldquo;45 sec&rdquo;)</p>
                            </div>
                        </div>
                    </StepCard>

                    <StepCard step="07" title="Instructions &amp; Safety" Icon={ClipboardList}>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Step-by-Step Instructions</Label>
                                <Textarea
                                    value={formData.instructions}
                                    onChange={e => setField('instructions', e.target.value)}
                                    placeholder={"1. Stand with feet shoulder-width apart\n2. Lower your body until thighs are parallel to the floor\n3. Keep chest up and back straight\n4. Push through heels to return to start position"}
                                    rows={6}
                                    className="resize-none border-gray-200 focus:border-red-400 font-mono text-sm leading-relaxed"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-yellow-500" /> Safety Tips / Common Mistakes</Label>
                                <Textarea
                                    value={formData.safetyTips}
                                    onChange={e => setField('safetyTips', e.target.value)}
                                    placeholder={"- Keep your back straight\n- Don't let knees cave inward\n- Breathe out on the exertion phase"}
                                    rows={4}
                                    className="resize-none border-gray-200 focus:border-yellow-400 font-mono text-sm leading-relaxed"
                                />
                            </div>
                        </div>
                    </StepCard>
                </div>
            )}

            {/* ── TAB 3: PREVIEW ── */}
            {activeTab === 'preview' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
                    {/* Preview header */}
                    <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                        {formData.image ? (
                            <img src={formData.image} alt="Exercise" className="w-16 h-16 rounded-2xl object-cover border border-gray-200" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Dumbbell className="w-8 h-8 text-red-300" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-xl font-bold text-gray-900 truncate">{formData.name || 'New Exercise'}</div>
                            <div className="text-sm text-gray-400 mt-0.5">{previewAreas}</div>
                        </div>
                        {diffOption && (
                            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 flex items-center gap-1.5 ${diffOption.active}`}>
                                <diffOption.Icon className={`w-3.5 h-3.5 ${diffOption.iconClass}`} />
                                {diffOption.label}
                            </span>
                        )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { val: formData.sets || '—', lbl: 'Sets' },
                            { val: formData.reps || '—', lbl: 'Reps' },
                            { val: formData.duration ? `${formData.duration} min` : '—', lbl: 'Duration' },
                            { val: formData.caloriesBurnEstimate ? `${formData.caloriesBurnEstimate} kcal` : '—', lbl: 'Calories' },
                        ].map(s => (
                            <div key={s.lbl} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                                <div className="text-2xl font-extrabold text-teal-600">{s.val}</div>
                                <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{s.lbl}</div>
                            </div>
                        ))}
                    </div>

                    {formData.description && (
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Description</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">{formData.description}</p>
                        </div>
                    )}

                    {/* Classification */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wide mb-2">
                                <Activity className="w-3 h-3" /> Exercise Type
                            </div>
                            <div className="text-sm font-semibold text-gray-700">{formData.exerciseType}</div>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wide mb-2">
                                <SlidersHorizontal className="w-3 h-3" /> Equipment
                            </div>
                            <div className="text-sm font-semibold text-gray-700">{formData.equipment.replace(' (Bodyweight)', '')}</div>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wide mb-2">
                                <Dumbbell className="w-3 h-3" /> Primary Muscle
                            </div>
                            <div className="text-sm font-semibold text-gray-700">{formData.muscleGroup.split(' (')[0]}</div>
                        </div>
                    </div>

                    {formData.videoUrl && (
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                            <Video className="w-5 h-5 text-blue-400 flex-shrink-0" />
                            <a href={formData.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                                {formData.videoUrl}
                            </a>
                        </div>
                    )}

                    {formData.instructions && (
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Instructions</h4>
                            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-4">{formData.instructions}</pre>
                        </div>
                    )}

                    {formData.safetyTips && (
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-yellow-500" /> Safety Tips</h4>
                            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-yellow-50 border border-yellow-100 rounded-xl p-4">{formData.safetyTips}</pre>
                        </div>
                    )}

                    {!formData.name && !formData.description && !formData.instructions && (
                        <p className="text-sm text-gray-400 text-center py-4">Fill in Basic Info to see a full preview here.</p>
                    )}
                </div>
            )}

            {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{submitError}</p>
                </div>
            )}

            {/* Sticky status bar / bottom nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-8 py-3.5 flex items-center justify-between z-30">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf] animate-pulse flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-700 truncate max-w-[180px]">{formData.name || 'New Exercise'}</span>
                    <span className="text-gray-200 hidden md:block">—</span>
                    <div className="hidden md:flex gap-2 overflow-x-auto">
                        {formData.sets && formData.reps && (
                            <span className="text-xs bg-teal-50 border border-teal-200 text-teal-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                                {formData.sets} sets \u00D7 {formData.reps} reps
                            </span>
                        )}
                        {formData.duration && (
                            <span className="text-xs bg-teal-50 border border-teal-200 text-teal-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                                <Timer className="w-3 h-3" /> {formData.duration} min
                            </span>
                        )}
                        {formData.caloriesBurnEstimate && (
                            <span className="text-xs bg-orange-50 border border-orange-200 text-orange-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                                <Flame className="w-3 h-3" /> {formData.caloriesBurnEstimate} kcal
                            </span>
                        )}
                        {(formData.videoUrl || formData.image) && (
                            <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Media added
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <Button variant="outline" onClick={() => { resetForm(); setViewMode('list'); }} className="text-gray-500 hover:text-gray-700">
                        <RotateCcw className="w-4 h-4 mr-1.5" /> Cancel
                    </Button>
                    {tabIdx < TABS.length - 1 ? (
                        <Button onClick={goNext} className="bg-white text-gray-700 border border-gray-200 hover:border-red-400 hover:text-red-500 hover:bg-red-50 shadow-sm">
                            Next: {TABS[tabIdx + 1].label}
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={submitLoading} className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-md">
                            {submitLoading
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                                : <><Save className="w-4 h-4 mr-2" />{editingExercise ? 'Update Exercise' : 'Save Exercise'}</>
                            }
                        </Button>
                    )}
                </div>
            </div>

            {/* Toast */}
            <div className={`fixed bottom-20 right-6 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 transition-all duration-300 ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                {toast.message}
            </div>
        </div>
    );
};

export default ExerciseComponent;
