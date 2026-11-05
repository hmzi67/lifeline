import React, { useState, useEffect, useRef } from 'react';
import {
    Package, Plus, Loader2, AlertCircle, Calendar, Flame, Edit, Trash2,
    ImageIcon, FileText, ChevronRight, ChevronLeft, Target, Salad, Clock,
    Eye, RotateCcw, Save, X, UtensilsCrossed, Utensils, Check,
    List, Info, Dumbbell, TrendingDown, TrendingUp,
    PlusCircle, ArrowLeft, LayoutList, BookOpen, Users, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/axios';
import { uploadFile } from '@/services/crudService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MealType {
    id: string;
    name: string;
}

interface Ingredient {
    id: number;
    name: string;
    quantity: string;
    unit: string;
}

interface MealDraft {
    id: number;
    /** Set for a meal already saved on the server, so saving updates it instead of adding a copy. */
    serverId?: string;
    mealTypeId: string;
    mealTypeName: string;
    name: string;
    calories: string;
    protein: string;
    carbs: string;
    fats: string;
    portionSize: string;
    recipe: string;
    ingredients: Ingredient[];
    imageFile: File | null;
    imagePreview: string;
}

interface PlanInfo {
    goal: string;
    dietType: string;
    name: string;
    description: string;
    duration: string;
    customDays: string;
    caloriesPerDay: string;
    caloriesMin: string;
    caloriesMax: string;
    cuisineName: string;
    gender: string;
    imageFile: File | null;
    imagePreview: string;
}

interface DietPlanApi {
    id: string;
    name: string | null;
    calories: number | null;
    duration: string | null;
    description: string | null;
    image: string | null;
    cuisineName?: string | null;
    gender?: string | null;
    goal?: string | null;
    createdAt?: string;
    userDietPlans?: { user: { id: string; email: string; username: string } }[];
    challengeDiets?: { challenge: { id: string; name: string; status: string } }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GOALS = [
    { value: 'weight_loss', label: 'Weight Loss', icon: TrendingDown },
    { value: 'weight_gain', label: 'Weight Gain', icon: TrendingUp },
    { value: 'build_muscle', label: 'Build Muscle', icon: Dumbbell },
    { value: 'modify_diet', label: 'Modify Diet', icon: Salad },
    { value: 'manage_stress', label: 'Manage Stress', icon: Target },
    { value: 'intermittent_fasting', label: 'Intermittent Fasting', icon: Clock },
];

const DIET_TYPES = [
    { value: 'traditional', label: 'Traditional' },
    { value: 'keto', label: 'Keto' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan (Plant Diet)' },
    { value: 'pescatarian', label: 'Pescatarian' },
    { value: 'paleo', label: 'Paleo' },
    { value: 'mediterranean', label: 'Mediterranean' },
    { value: 'diabetes_1', label: 'Diabetes Type 1' },
    { value: 'diabetes_2', label: 'Diabetes Type 2' },
    { value: 'high_protein', label: 'High-Protein' },
    { value: 'calorie_cutting', label: 'Calorie-Cutting' },
    { value: 'high_calories', label: 'High Calories' },
];

const DURATIONS = [
    { value: '7', label: '7 Days (1 Week)' },
    { value: '14', label: '14 Days (2 Weeks)' },
    { value: '21', label: '21 Days (3 Weeks)' },
    { value: '30', label: '30 Days (1 Month)' },
    { value: '45', label: '45 Days' },
    { value: '60', label: '60 Days (2 Months)' },
    { value: '90', label: '90 Days (3 Months)' },
    { value: 'custom', label: 'Custom' },
];

const UNITS = ['piece', 'grams', 'ml', 'cup', 'tbsp', 'tsp', 'slice', 'oz', 'kg', 'lb'];

const CUISINES = [
    { value: 'indian', label: 'Indian' },
    { value: 'italian', label: 'Italian' },
    { value: 'mexican', label: 'Mexican' },
    { value: 'asian', label: 'Asian' },
    { value: 'american', label: 'American' },
    { value: 'mediterranean', label: 'Mediterranean' },
    { value: 'middle_eastern', label: 'Middle Eastern' },
    { value: 'thai', label: 'Thai' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'fusion', label: 'Fusion' },
    { value: 'other', label: 'Other' },
];

const GENDERS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'all', label: 'All' },
];

const GOAL_LABEL: Record<string, string> = Object.fromEntries(GOALS.map(g => [g.value, g.label]));
const DIET_LABEL: Record<string, string> = Object.fromEntries(DIET_TYPES.map(d => [d.value, d.label]));
const CUISINE_LABEL: Record<string, string> = Object.fromEntries(CUISINES.map(c => [c.value, c.label]));
const GENDER_LABEL: Record<string, string> = Object.fromEntries(GENDERS.map(g => [g.value, g.label]));

// ─────────────────────────────────────────────────────────────────────────────
// Empty state helpers
// ─────────────────────────────────────────────────────────────────────────────

const emptyPlanInfo = (): PlanInfo => ({
    goal: '',
    dietType: '',
    name: '',
    description: '',
    duration: '',
    customDays: '',
    caloriesPerDay: '',
    caloriesMin: '',
    caloriesMax: '',
    cuisineName: '',
    gender: '',
    imageFile: null,
    imagePreview: '',
});

const emptyMeal = (): MealDraft => ({
    id: Date.now(),
    mealTypeId: '',
    mealTypeName: '',
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    portionSize: '',
    recipe: '',
    ingredients: [{ id: Date.now(), name: '', quantity: '', unit: 'grams' }],
    imageFile: null,
    imagePreview: '',
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface StepBadgeProps { step: number; label: string }
const StepBadge: React.FC<StepBadgeProps> = ({ step, label }) => (
    <div className="flex items-center gap-3 mb-5">
        <div className="w-7 h-7 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center font-mono">
            {String(step).padStart(2, '0')}
        </div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{label}</h3>
    </div>
);

interface SectionCardProps { children: React.ReactNode; className?: string }
const SectionCard: React.FC<SectionCardProps> = ({ children, className = '' }) => (
    <div className={`bg-white border border-gray-200 rounded-2xl p-6 mb-5 ${className}`}>
        {children}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DietComponent
// ─────────────────────────────────────────────────────────────────────────────

// Splits a saved recipe back into ingredients and instructions (the reverse of
// buildRecipeWithIngredients), so editing a plan doesn't nest "Instructions:" on every save.
const parseRecipe = (recipe: string | null | undefined): { ingredients: Ingredient[]; instructions: string } => {
    const text = (recipe || '').replace(/\r\n/g, '\n');
    if (!text.startsWith('Ingredients:\n')) {
        return { ingredients: [], instructions: text.startsWith('Instructions:\n') ? text.slice('Instructions:\n'.length) : text };
    }
    const [ingredientBlock, ...rest] = text.slice('Ingredients:\n'.length).split('\n\nInstructions:\n');
    let id = Date.now();
    const ingredients = ingredientBlock.split('\n').filter(line => line.startsWith('- ')).map(line => {
        const [name, amount = ''] = line.slice(2).split(/:\s*/, 2);
        const parts = amount.trim().split(/\s+/);
        const unit = parts.length > 1 && UNITS.includes(parts[parts.length - 1]) ? parts.pop()! : 'grams';
        return { id: id++, name: name.trim(), quantity: parts.join(' '), unit };
    });
    return { ingredients, instructions: rest.join('\n\nInstructions:\n') };
};

type View = 'list' | 'create';
type Tab = 'plan-info' | 'meals' | 'preview';

const DietComponent: React.FC = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [view, setView] = useState<View>('list');
    const [activeTab, setActiveTab] = useState<Tab>('plan-info');

    // List view state
    const [dietPlans, setDietPlans] = useState<DietPlanApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Create/edit state
    const [planInfo, setPlanInfo] = useState<PlanInfo>(emptyPlanInfo());
    // Meals for each day of the plan (Day 1, Day 2, ...); the editor shows one day at a time.
    const [mealsByDay, setMealsByDay] = useState<Record<number, MealDraft[]>>({});
    const [activeDay, setActiveDay] = useState(1);
    const [copyFromDay, setCopyFromDay] = useState('');
    // When editing, the saved days must load before a save, or saving would drop them.
    const [scheduleState, setScheduleState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    const [currentMeal, setCurrentMeal] = useState<MealDraft>(emptyMeal());
    const [mealTypes, setMealTypes] = useState<MealType[]>([]);
    const [editingPlan, setEditingPlan] = useState<DietPlanApi | null>(null);

    // Save state
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Ingredient counter ref
    const ingCounter = useRef(100);
    const planImageRef = useRef<HTMLInputElement>(null);
    const mealImageRef = useRef<HTMLInputElement>(null);

    const meals = mealsByDay[activeDay] ?? [];
    const setMeals = (update: (prev: MealDraft[]) => MealDraft[]) =>
        setMealsByDay(prev => ({ ...prev, [activeDay]: update(prev[activeDay] ?? []) }));
    const planDayCount = () => {
        const n = parseInt(planInfo.duration === 'custom' ? planInfo.customDays : planInfo.duration, 10);
        return Number.isFinite(n) && n > 0 ? Math.min(n, 366) : 1;
    };
    const dayNumbers = Array.from({ length: planDayCount() }, (_, i) => i + 1);
    const filledDays = Object.keys(mealsByDay).map(Number).filter(d => (mealsByDay[d]?.length ?? 0) > 0).sort((a, b) => a - b);
    const totalMeals = filledDays.reduce((sum, d) => sum + mealsByDay[d].length, 0);
    // Days that still have meals after the duration was shortened: shown in red, block saving.
    const lateDays = filledDays.filter(d => d > planDayCount());
    const lateDaysMessage = lateDays.length
        ? `Day${lateDays.length === 1 ? '' : 's'} ${lateDays.join(', ')} ${lateDays.length === 1 ? 'has' : 'have'} meals, but the plan is only ${planDayCount()} days long. Increase the duration, or open ${lateDays.length === 1 ? 'that day' : 'those days'} (in red) and remove the meals.`
        : '';

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchDietPlans();
        fetchMealTypes();
    }, []);

    // ── API calls ─────────────────────────────────────────────────────────────
    const fetchDietPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/diet-plans');
            if (res.data.success) setDietPlans(res.data.data || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch diet plans.');
        } finally {
            setLoading(false);
        }
    };

    const fetchMealTypes = async () => {
        try {
            const res = await api.get('/meal-types');
            if (res.data.success) setMealTypes(res.data.data || []);
        } catch { /* silent */ }
    };

    // ── Toast helper ──────────────────────────────────────────────────────────
    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Plan info handlers ────────────────────────────────────────────────────
    const handlePlanInfoChange = (field: keyof PlanInfo, value: string) => {
        setPlanInfo(prev => ({ ...prev, [field]: value }));
    };

    const handlePlanImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setPlanInfo(prev => ({
            ...prev,
            imageFile: file,
            imagePreview: ev.target?.result as string,
        }));
        reader.readAsDataURL(file);
    };

    // ── Meal handlers ─────────────────────────────────────────────────────────
    const handleMealChange = (field: keyof MealDraft, value: string) => {
        setCurrentMeal(prev => ({ ...prev, [field]: value }));
    };

    const handleMealTypeChange = (id: string) => {
        const mt = mealTypes.find(m => m.id === id);
        setCurrentMeal(prev => ({ ...prev, mealTypeId: id, mealTypeName: mt?.name || '' }));
    };

    const handleMealImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setCurrentMeal(prev => ({
            ...prev,
            imageFile: file,
            imagePreview: ev.target?.result as string,
        }));
        reader.readAsDataURL(file);
    };

    // ── Ingredient handlers ───────────────────────────────────────────────────
    const addIngredient = () => {
        ingCounter.current += 1;
        setCurrentMeal(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { id: ingCounter.current, name: '', quantity: '', unit: 'grams' }],
        }));
    };

    const removeIngredient = (id: number) => {
        setCurrentMeal(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter(i => i.id !== id),
        }));
    };

    const updateIngredient = (id: number, field: keyof Ingredient, value: string) => {
        setCurrentMeal(prev => ({
            ...prev,
            ingredients: prev.ingredients.map(i => i.id === id ? { ...i, [field]: value } : i),
        }));
    };

    // ── Add meal to list ──────────────────────────────────────────────────────
    const addMealToList = () => {
        if (!currentMeal.mealTypeId || !currentMeal.name || !currentMeal.calories) {
            showToast('Please fill Meal Type, Name and Calories.', 'error');
            return;
        }
        setMeals(prev => [...prev, { ...currentMeal, id: Date.now() }]);
        setCurrentMeal(emptyMeal());
        if (mealImageRef.current) mealImageRef.current.value = '';
        showToast('Meal added successfully.');
    };

    const removeMeal = (id: number) => {
        setMeals(prev => prev.filter(m => m.id !== id));
    };

    // Adds a copy of another day's meals to the day being edited (nothing is overwritten).
    const copyMealsFromDay = () => {
        const from = Number(copyFromDay);
        const source = mealsByDay[from] ?? [];
        if (!from || from === activeDay || source.length === 0) return;
        // Meals this day already has (same type, name, calories and portion) are not copied again,
        // so copying twice doesn't duplicate anything.
        const sameMeal = (m: MealDraft) => [m.mealTypeId, m.name.trim().toLowerCase(), m.calories.trim(), m.portionSize.trim().toLowerCase()].join('|');
        const existing = new Set(meals.map(sameMeal));
        const toAdd = source.filter(m => !existing.has(sameMeal(m)));
        setCopyFromDay('');
        if (toAdd.length === 0) {
            showToast(`Day ${activeDay} already has all of Day ${from}'s meals.`, 'error');
            return;
        }
        const stamp = Date.now();
        setMeals(prev => [
            ...prev,
            ...toAdd.map((m, i) => ({ ...m, id: stamp + i, serverId: undefined, ingredients: m.ingredients.map(x => ({ ...x })) })),
        ]);
        const skipped = source.length - toAdd.length;
        showToast(`Copied ${toAdd.length} meal${toAdd.length === 1 ? '' : 's'} from Day ${from} to Day ${activeDay}${skipped ? ` (${skipped} already there)` : ''}.`);
    };

    // ── Reset ─────────────────────────────────────────────────────────────────
    const resetAll = () => {
        setPlanInfo(emptyPlanInfo());
        setMealsByDay({});
        setActiveDay(1);
        setCopyFromDay('');
        setScheduleState('idle');
        setCurrentMeal(emptyMeal());
        setEditingPlan(null);
        setSaveError('');
        setActiveTab('plan-info');
        if (planImageRef.current) planImageRef.current.value = '';
        if (mealImageRef.current) mealImageRef.current.value = '';
    };

    // ── Open create / edit ────────────────────────────────────────────────────
    const openCreate = () => {
        resetAll();
        setView('create');
    };

    const openEdit = (plan: DietPlanApi) => {
        resetAll();
        setEditingPlan(plan);

        const durationNum = plan.duration?.replace(/\D/g, '') || '';
        const durVal = DURATIONS.find(d => d.value === durationNum) ? durationNum : (durationNum ? 'custom' : '');
        const customDays = durVal === 'custom' ? durationNum : '';

        setPlanInfo({
            goal: plan.goal || '',
            dietType: '',
            name: plan.name || '',
            description: plan.description || '',
            duration: durVal,
            customDays,
            caloriesPerDay: plan.calories?.toString() || '',
            caloriesMin: '',
            caloriesMax: '',
            cuisineName: plan.cuisineName || '',
            gender: plan.gender || '',
            imageFile: null,
            imagePreview: plan.image || '',
        });

        setView('create');
        loadSchedule(plan.id);
    };

    const loadSchedule = async (planId: string) => {
        setScheduleState('loading');
        try {
            const res = await api.get(`/diet-plans/${planId}/schedule`);
            const byDay: Record<number, MealDraft[]> = {};
            let stamp = Date.now();
            for (const day of res.data?.data || []) {
                byDay[day.dayNumber] = (day.dietPlanMeals || []).map((m: any) => {
                    const { ingredients, instructions } = parseRecipe(m.recipe);
                    return {
                        ...emptyMeal(),
                        id: stamp++,
                        serverId: m.id,
                        mealTypeId: m.mealTypeId,
                        mealTypeName: m.mealType?.name || '',
                        name: m.name || '',
                        calories: m.calories != null ? String(m.calories) : '',
                        portionSize: m.portionSize || '',
                        protein: m.protein != null ? String(m.protein) : '',
                        carbs: m.carbs != null ? String(m.carbs) : '',
                        fats: m.fats != null ? String(m.fats) : '',
                        recipe: instructions,
                        ingredients: ingredients.length ? ingredients : emptyMeal().ingredients,
                        imagePreview: m.image || '',
                    };
                });
            }
            setMealsByDay(byDay);
            const first = Object.keys(byDay).map(Number).sort((a, b) => a - b)[0];
            if (first) setActiveDay(first);
            setScheduleState('loaded');
        } catch (err: any) {
            setScheduleState('error');
            setSaveError(err.response?.data?.message || "Couldn't load this plan's meals. Reload the page before saving.");
        }
    };

    // ── Delete plan ───────────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this diet plan?')) return;
        try {
            await api.delete(`/diet-plans/${id}`);
            showToast('Diet plan deleted.');
            fetchDietPlans();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to delete diet plan.', 'error');
        }
    };

    // ── Save plan ─────────────────────────────────────────────────────────────
    const savePlan = async () => {
        if (!planInfo.name) {
            showToast('Plan name is required.', 'error');
            setActiveTab('plan-info');
            return;
        }
        if (editingPlan && scheduleState !== 'loaded') {
            showToast(scheduleState === 'loading' ? "This plan's meals are still loading." : "This plan's meals didn't load. Reload the page before saving.", 'error');
            return;
        }
        if (lateDaysMessage) {
            setSaveError(lateDaysMessage);
            showToast(lateDaysMessage, 'error');
            setActiveTab('meals');
            return;
        }

        setSaving(true);
        setSaveError('');

        // Set once a new plan row exists, so a failed schedule save can remove it
        // instead of leaving an empty duplicate in the list.
        let createdPlanId: string | null = null;

        try {
            // Upload new images first; a meal or plan keeps its saved image URL otherwise.
            const planImage = planInfo.imageFile ? await uploadFile(planInfo.imageFile) : (planInfo.imagePreview || null);
            const days = [];
            for (const dayNumber of filledDays) {
                const dayMeals = [];
                for (const meal of mealsByDay[dayNumber]) {
                    dayMeals.push({
                        id: meal.serverId,
                        mealTypeId: meal.mealTypeId,
                        name: meal.name,
                        calories: meal.calories ? parseInt(meal.calories, 10) : null,
                        portionSize: meal.portionSize || null,
                        protein: meal.protein ? parseFloat(meal.protein) : null,
                        carbs: meal.carbs ? parseFloat(meal.carbs) : null,
                        fats: meal.fats ? parseFloat(meal.fats) : null,
                        image: meal.imageFile ? await uploadFile(meal.imageFile) : (meal.imagePreview || null),
                        recipe: buildRecipeWithIngredients(meal) || null,
                    });
                }
                days.push({ dayNumber, meals: dayMeals });
            }

            const durationDays = planInfo.duration === 'custom' ? planInfo.customDays : planInfo.duration;
            const submitData = {
                name: planInfo.name,
                calories: planInfo.caloriesPerDay ? parseInt(planInfo.caloriesPerDay) : undefined,
                duration: durationDays ? `${durationDays} days` : undefined,
                description: planInfo.description || undefined,
                image: planImage,
                cuisineName: planInfo.cuisineName || undefined,
                gender: planInfo.gender || undefined,
                goal: planInfo.goal || null,
            };

            let planId: string;
            if (editingPlan) {
                await api.put(`/diet-plans/${editingPlan.id}`, submitData);
                planId = editingPlan.id;
            } else {
                const res = await api.post('/diet-plans', submitData);
                planId = res.data?.data?.id;
                createdPlanId = planId || null;
            }

            await api.put(`/diet-plans/${planId}/schedule`, { days });

            showToast(editingPlan ? 'Diet plan updated successfully.' : 'Diet plan created successfully.');
            resetAll();
            setView('list');
            fetchDietPlans();
        } catch (err: any) {
            if (createdPlanId) {
                await api.delete(`/diet-plans/${createdPlanId}`).catch(() => undefined);
            }
            const data = err.response?.data;
            const msg = data?.message || data?.error?.message || 'Failed to save diet plan.';
            setSaveError(msg);
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const buildRecipeWithIngredients = (meal: MealDraft): string => {
        const ingLines = meal.ingredients
            .filter(i => i.name)
            .map(i => `- ${i.name}: ${i.quantity} ${i.unit}`)
            .join('\n');

        if (!ingLines) return meal.recipe;
        const parts: string[] = [];
        parts.push(`Ingredients:\n${ingLines}`);
        if (meal.recipe) parts.push(`Instructions:\n${meal.recipe}`);
        return parts.join('\n\n');
    };

    // ── Computed duration label ───────────────────────────────────────────────
    const durationLabel = () => {
        if (!planInfo.duration) return '—';
        if (planInfo.duration === 'custom') return planInfo.customDays ? `${planInfo.customDays}d` : 'Custom';
        return `${planInfo.duration}d`;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render helpers
    // ─────────────────────────────────────────────────────────────────────────

    const renderMealTypeBadge = (name: string) => {
        const colors: Record<string, string> = {
            breakfast: 'bg-amber-100 text-amber-700',
            lunch: 'bg-green-100 text-green-700',
            dinner: 'bg-indigo-100 text-indigo-700',
            snack: 'bg-pink-100 text-pink-700',
            'pre-workout': 'bg-orange-100 text-orange-700',
            'post-workout': 'bg-cyan-100 text-cyan-700',
        };
        const key = name.toLowerCase().replace(/[\s_]/g, '-');
        const cls = colors[key] || 'bg-gray-100 text-gray-600';
        return (
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
                {name}
            </span>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Tab: Plan Info
    // ─────────────────────────────────────────────────────────────────────────
    const renderPlanInfoTab = () => (
        <div className="space-y-5">
            {/* Step 1: Goal */}
            <SectionCard>
                <StepBadge step={1} label="Select Fitness Goal" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GOALS.map(g => {
                        const Icon = g.icon;
                        const active = planInfo.goal === g.value;
                        return (
                            <button
                                key={g.value}
                                type="button"
                                onClick={() => handlePlanInfoChange('goal', g.value)}
                                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150
                                    ${active
                                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                                        : 'border-gray-200 hover:border-teal-300 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-teal-600' : 'text-gray-400'}`} />
                                <span className="text-sm font-semibold">{g.label}</span>
                                {active && <Check className="w-4 h-4 ml-auto text-teal-500 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </SectionCard>

            {/* Step 2: Diet type, cuisine name, plan name, image, description */}
            <SectionCard>
                <StepBadge step={2} label="Diet Plan Details" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Diet Type <span className="text-red-500">*</span>
                        </Label>
                        <Select value={planInfo.dietType} onValueChange={v => handlePlanInfoChange('dietType', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select diet type" />
                            </SelectTrigger>
                            <SelectContent>
                                {DIET_TYPES.map(d => (
                                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuisine Name</Label>
                        <Input
                            value={planInfo.cuisineName}
                            onChange={e => handlePlanInfoChange('cuisineName', e.target.value)}
                            placeholder="e.g. Mediterranean, Indian"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Plan Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={planInfo.name}
                            onChange={e => handlePlanInfoChange('name', e.target.value)}
                            placeholder="e.g. 30-Day Keto Weight Loss Plan"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</Label>
                        <Input
                            value={planInfo.description}
                            onChange={e => handlePlanInfoChange('description', e.target.value)}
                            placeholder="Short description of this diet plan"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan Image</Label>
                        <div
                            className="border-2 border-dashed border-gray-200 rounded-xl h-[88px] flex items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all overflow-hidden"
                            onClick={() => planImageRef.current?.click()}
                        >
                            {planInfo.imagePreview ? (
                                <img src={planInfo.imagePreview} alt="Plan" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-gray-400 pointer-events-none">
                                    <ImageIcon className="w-7 h-7" />
                                    <span className="text-xs font-semibold">Click to upload plan image</span>
                                    <span className="text-[10px]">PNG, JPG — max 2MB</span>
                                </div>
                            )}
                        </div>
                        <input
                            ref={planImageRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePlanImageChange}
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Step 3: Duration */}
            <SectionCard>
                <StepBadge step={3} label="Plan Duration" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Duration <span className="text-red-500">*</span>
                        </Label>
                        <Select value={planInfo.duration} onValueChange={v => handlePlanInfoChange('duration', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                                {DURATIONS.map(d => (
                                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {planInfo.duration === 'custom' && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Days</Label>
                            <Input
                                type="number"
                                min={1}
                                value={planInfo.customDays}
                                onChange={e => handlePlanInfoChange('customDays', e.target.value)}
                                placeholder="Enter number of days"
                            />
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Step 4: Calories & Gender */}
            <SectionCard>
                <StepBadge step={4} label="Daily Calorie Target" />
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Flame className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">Daily Calorie Distribution</span>
                    </div>
                    <div className="max-w-xs">
                        <Label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Total Calories / Day</Label>
                        <Input
                            type="number"
                            className="mt-1.5 font-mono font-semibold text-gray-800"
                            value={planInfo.caloriesPerDay}
                            onChange={e => handlePlanInfoChange('caloriesPerDay', e.target.value)}
                            placeholder="1800"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">kcal</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calorie Range Min</Label>
                        <Input
                            type="number"
                            value={planInfo.caloriesMin}
                            onChange={e => handlePlanInfoChange('caloriesMin', e.target.value)}
                            placeholder="1500"
                        />
                        <p className="text-[10px] text-gray-400">Minimum daily calories</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calorie Range Max</Label>
                        <Input
                            type="number"
                            value={planInfo.caloriesMax}
                            onChange={e => handlePlanInfoChange('caloriesMax', e.target.value)}
                            placeholder="2000"
                        />
                        <p className="text-[10px] text-gray-400">Maximum daily calories</p>
                    </div>
                </div>
                <div className="mt-5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Target Gender</Label>
                    <div className="grid grid-cols-4 gap-3">
                        {GENDERS.map(g => {
                            const active = planInfo.gender === g.value;
                            return (
                                <button
                                    key={g.value}
                                    type="button"
                                    onClick={() => handlePlanInfoChange('gender', g.value)}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150
                                        ${active
                                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                                            : 'border-gray-200 hover:border-teal-300 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {active && <Check className="w-3.5 h-3.5 text-teal-500" />}
                                    {g.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">Who this diet plan is designed for</p>
                </div>
            </SectionCard>

            <div className="flex justify-end pb-6">
                <Button
                    className="bg-teal-500 hover:bg-teal-600 text-white gap-2"
                    onClick={() => setActiveTab('meals')}
                >
                    Next: Add Meals <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Tab: Meals
    // ─────────────────────────────────────────────────────────────────────────
    const renderMealsTab = () => (
        <div className="space-y-5">
            {/* Summary bar */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-2xl p-5">
                {[
                    { label: 'Goal', value: GOAL_LABEL[planInfo.goal] || '—' },
                    { label: 'Diet Type', value: DIET_LABEL[planInfo.dietType] || '—' },
                    { label: 'Duration', value: durationLabel() },
                    { label: 'Kcal / Day', value: planInfo.caloriesPerDay || '—' },
                    { label: 'Cuisine', value: CUISINE_LABEL[planInfo.cuisineName] || planInfo.cuisineName || '—' },
                    { label: 'Gender', value: GENDER_LABEL[planInfo.gender] || planInfo.gender || '—' },
                ].map(s => (
                    <div key={s.label} className="text-center">
                        <div className="text-lg font-bold font-mono truncate">{s.value}</div>
                        <div className="text-[10px] uppercase tracking-widest mt-1 opacity-75">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Day picker: meals below belong to the selected day */}
            <SectionCard>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-teal-500" />
                        <h3 className="font-bold text-gray-800">Plan Days</h3>
                        <span className="text-xs text-gray-400">Pick a day, then add that day's meals</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={copyFromDay} onValueChange={setCopyFromDay}>
                            <SelectTrigger className="w-44 h-9 text-xs">
                                <SelectValue placeholder="Copy meals from day..." />
                            </SelectTrigger>
                            <SelectContent>
                                {filledDays.filter(d => d !== activeDay).map(d => (
                                    <SelectItem key={d} value={String(d)}>Day {d} ({mealsByDay[d].length} meals)</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={copyMealsFromDay} disabled={!copyFromDay}>
                            <Copy className="w-4 h-4 mr-1" /> Copy to Day {activeDay}
                        </Button>
                    </div>
                </div>
                {scheduleState === 'loading' ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading this plan's meals...
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                        {[...dayNumbers, ...lateDays].map(d => {
                            const late = d > planDayCount();
                            const count = mealsByDay[d]?.length || 0;
                            const active = d === activeDay;
                            return (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => { setActiveDay(d); setCopyFromDay(''); }}
                                    className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all
                                        ${late
                                            ? `border-red-400 text-red-600 ${active ? 'bg-red-50' : 'hover:bg-red-50'}`
                                            : active
                                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                                            : count
                                                ? 'border-teal-200 text-gray-700 hover:border-teal-400'
                                                : 'border-gray-200 text-gray-400 hover:border-teal-300'}`}
                                >
                                    Day {d}{count ? <span className="ml-1 text-[10px] text-teal-600">· {count}</span> : null}
                                </button>
                            );
                        })}
                    </div>
                )}
                {lateDaysMessage && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600">{lateDaysMessage}</p>
                    </div>
                )}
                <p className="text-[10px] text-gray-400 mt-2">
                    {filledDays.filter(d => d <= planDayCount()).length} of {planDayCount()} days have meals. The number of days comes from the plan's duration; days without meals show nothing in the app.
                </p>
            </SectionCard>

            {/* Add meal form */}
            <SectionCard>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <UtensilsCrossed className="w-5 h-5 text-teal-500" />
                        <h3 className="font-bold text-gray-800">Add New Meal</h3>
                        <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">Day {activeDay}</span>
                    </div>
                    <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white" onClick={addMealToList}>
                        <Plus className="w-4 h-4 mr-1" /> Add Meal
                    </Button>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Meal Type <span className="text-red-500">*</span>
                        </Label>
                        <Select value={currentMeal.mealTypeId} onValueChange={handleMealTypeChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {mealTypes.map(mt => (
                                    <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Meal Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={currentMeal.name}
                            maxLength={100}
                            onChange={e => handleMealChange('name', e.target.value)}
                            placeholder="e.g. Egg with Brown Bread"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meal Image</Label>
                        <div
                            className="border-2 border-dashed border-gray-200 rounded-xl h-[42px] flex items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all overflow-hidden"
                            onClick={() => mealImageRef.current?.click()}
                        >
                            {currentMeal.imagePreview ? (
                                <img src={currentMeal.imagePreview} alt="Meal" className="h-full object-cover rounded-xl" />
                            ) : (
                                <div className="flex items-center gap-2 text-gray-400 text-xs pointer-events-none">
                                    <ImageIcon className="w-4 h-4" />
                                    <span className="font-semibold">Upload meal photo</span>
                                </div>
                            )}
                        </div>
                        <input ref={mealImageRef} type="file" accept="image/*" className="hidden" onChange={handleMealImageChange} />
                    </div>
                </div>

                {/* Macros */}
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Flame className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">Meal Calories & Macros</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Calories', key: 'calories', placeholder: '350', unit: 'kcal', color: 'text-gray-800 border-gray-800' },
                            { label: 'Proteins', key: 'protein', placeholder: '25', unit: 'grams', color: 'text-blue-600 border-blue-400' },
                            { label: 'Carbs', key: 'carbs', placeholder: '30', unit: 'grams', color: 'text-orange-500 border-orange-400' },
                            { label: 'Fats', key: 'fats', placeholder: '12', unit: 'grams', color: 'text-green-600 border-green-400' },
                        ].map(m => (
                            <div key={m.key} className="flex flex-col gap-1">
                                <span className={`text-[11px] font-bold uppercase tracking-wide ${m.color.split(' ')[0]}`}>{m.label}</span>
                                <input
                                    type="number"
                                    value={currentMeal[m.key as keyof MealDraft] as string}
                                    onChange={e => handleMealChange(m.key as keyof MealDraft, e.target.value)}
                                    placeholder={m.placeholder}
                                    className={`px-3 py-2 bg-white rounded-lg border-2 font-mono font-semibold text-sm outline-none focus:ring-2 focus:ring-teal-300 ${m.color}`}
                                />
                                <span className="text-[10px] text-gray-400 text-center">{m.unit}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Portion size */}
                <div className="mb-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Portion Size</Label>
                    <Input
                        value={currentMeal.portionSize}
                        maxLength={150}
                        onChange={e => handleMealChange('portionSize', e.target.value)}
                        placeholder="e.g. 1 bowl (300g)"
                    />
                </div>

                {/* Ingredients */}
                <div className="mb-4">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                        Ingredients
                    </Label>
                    <div className="grid grid-cols-[1fr_100px_90px_36px] gap-2 px-3 mb-1">
                        {['Ingredient Name', 'Quantity', 'Unit', ''].map(h => (
                            <span key={h} className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{h}</span>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {currentMeal.ingredients.map(ing => (
                            <div
                                key={ing.id}
                                className="grid grid-cols-[1fr_100px_90px_36px] gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                            >
                                <input
                                    type="text"
                                    value={ing.name}
                                    onChange={e => updateIngredient(ing.id, 'name', e.target.value)}
                                    placeholder="e.g. Eggs"
                                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-teal-400"
                                />
                                <input
                                    type="number"
                                    value={ing.quantity}
                                    onChange={e => updateIngredient(ing.id, 'quantity', e.target.value)}
                                    placeholder="Qty"
                                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-teal-400"
                                />
                                <select
                                    value={ing.unit}
                                    onChange={e => updateIngredient(ing.id, 'unit', e.target.value)}
                                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-teal-400"
                                >
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeIngredient(ing.id)}
                                    className="w-8 h-8 flex items-center justify-center bg-red-50 border border-red-200 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addIngredient}
                        className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-teal-300 text-teal-600 rounded-xl text-sm font-semibold hover:bg-teal-50 hover:border-teal-500 transition-all"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Add Ingredient
                    </button>
                </div>

                {/* Recipe */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Cooking Instructions
                    </Label>
                    <Textarea
                        value={currentMeal.recipe}
                        onChange={e => handleMealChange('recipe', e.target.value)}
                        placeholder="Step-by-step cooking instructions:&#10;1. Boil water and add eggs for 8 minutes&#10;2. Toast the brown bread&#10;3. Season with salt and pepper"
                        rows={4}
                        className="resize-none"
                    />
                    <p className="text-[10px] text-gray-400">Press Enter for new steps.</p>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline" onClick={() => setCurrentMeal(emptyMeal())}>
                        <RotateCcw className="w-4 h-4 mr-1" /> Clear
                    </Button>
                    <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={addMealToList}>
                        <Check className="w-4 h-4 mr-1" /> Add This Meal
                    </Button>
                </div>
            </SectionCard>

            {/* Meals list */}
            <SectionCard>
                <div className="flex items-center gap-3 mb-4">
                    <List className="w-5 h-5 text-teal-500" />
                    <h3 className="font-bold text-gray-800">Day {activeDay} Meals</h3>
                    <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">
                        {meals.length} meals
                    </span>
                </div>
                {meals.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Utensils className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No meals for Day {activeDay} yet. Add one above, or copy another day's meals.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {meals.map(meal => (
                            <div key={meal.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        {meal.imagePreview && (
                                            <img src={meal.imagePreview} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                        )}
                                        {renderMealTypeBadge(meal.mealTypeName || 'Meal')}
                                        <span className="font-semibold text-sm text-gray-800">{meal.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-3 text-sm font-mono">
                                            <span className="font-semibold text-gray-800 flex items-center gap-1">
                                                <Flame className="w-3.5 h-3.5 text-orange-500" />{meal.calories} kcal
                                            </span>
                                            {meal.protein && <span className="text-blue-600">P: {meal.protein}g</span>}
                                            {meal.carbs && <span className="text-orange-500">C: {meal.carbs}g</span>}
                                            {meal.fats && <span className="text-green-600">F: {meal.fats}g</span>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeMeal(meal.id)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {meal.ingredients.some(i => i.name) && (
                                    <div className="px-4 py-2.5 border-t border-gray-100">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Ingredients</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {meal.ingredients.filter(i => i.name).map(i => (
                                                <span key={i.id} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-full border border-teal-100">
                                                    {i.name}{i.quantity ? ` — ${i.quantity} ${i.unit}` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <div className="flex items-center justify-between pb-6">
                <Button variant="outline" onClick={() => setActiveTab('plan-info')}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => setActiveTab('preview')}>
                    Preview Plan <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Tab: Preview
    // ─────────────────────────────────────────────────────────────────────────
    const renderPreviewTab = () => (
        <div className="space-y-5">
            <SectionCard>
                {planInfo.imagePreview && (
                    <img src={planInfo.imagePreview} alt="" className="w-full max-h-56 object-cover rounded-xl mb-4" />
                )}
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    {planInfo.name || 'Unnamed Plan'}
                </h2>
                <div className="flex flex-wrap gap-2 mb-5">
                    {[
                        { icon: Target, label: GOAL_LABEL[planInfo.goal] || '—', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                        { icon: Salad, label: DIET_LABEL[planInfo.dietType] || '—', color: 'bg-green-50 text-green-700 border-green-200' },
                        { icon: Calendar, label: `${durationLabel()} Days`, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { icon: Flame, label: `${planInfo.caloriesPerDay || '—'} kcal/day`, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                        ...(planInfo.cuisineName ? [{ icon: UtensilsCrossed, label: CUISINE_LABEL[planInfo.cuisineName] || planInfo.cuisineName, color: 'bg-amber-50 text-amber-700 border-amber-200' }] : []),
                        ...(planInfo.gender ? [{ icon: Users, label: GENDER_LABEL[planInfo.gender] || planInfo.gender, color: 'bg-purple-50 text-purple-700 border-purple-200' }] : []),
                    ].map(tag => {
                        const Icon = tag.icon;
                        return (
                            <span key={tag.label} className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-semibold ${tag.color}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {tag.label}
                            </span>
                        );
                    })}
                </div>

                {planInfo.description && (
                    <p className="text-sm text-gray-600 mb-5 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                        {planInfo.description}
                    </p>
                )}

                {planInfo.caloriesPerDay && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5 flex items-center gap-4">
                        <Flame className="w-8 h-8 text-teal-500 flex-shrink-0" />
                        <div>
                            <div className="text-2xl font-bold font-mono text-gray-900">{planInfo.caloriesPerDay} <span className="text-sm font-normal text-gray-500">kcal / day</span></div>
                            {(planInfo.caloriesMin || planInfo.caloriesMax) && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                    Range: {planInfo.caloriesMin || '—'} – {planInfo.caloriesMax || '—'} kcal
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-teal-500" />
                    Meals ({totalMeals}) · {filledDays.length} of {planDayCount()} days
                </h3>
                {totalMeals === 0 ? (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <Utensils className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No meals added yet</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filledDays.map(day => (
                        <div key={day}>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Day {day}</h4>
                        <div className="space-y-3">
                        {mealsByDay[day].map(meal => (
                            <div key={meal.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        {meal.imagePreview && (
                                            <img src={meal.imagePreview} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                        )}
                                        {renderMealTypeBadge(meal.mealTypeName || 'Meal')}
                                        <span className="font-bold text-sm text-gray-800">{meal.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm font-mono">
                                        <span className="flex items-center gap-1 font-semibold text-gray-800">
                                            <Flame className="w-3.5 h-3.5 text-orange-500" />{meal.calories} kcal
                                        </span>
                                        {meal.protein && <span className="text-blue-600">P: {meal.protein}g</span>}
                                        {meal.carbs && <span className="text-orange-500">C: {meal.carbs}g</span>}
                                        {meal.fats && <span className="text-green-600">F: {meal.fats}g</span>}
                                    </div>
                                </div>
                                {meal.ingredients.some(i => i.name) && (
                                    <div className="px-4 py-3 border-t border-gray-100">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Ingredients</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {meal.ingredients.filter(i => i.name).map(i => (
                                                <span key={i.id} className="px-2.5 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-full border border-teal-100">
                                                    {i.name}{i.quantity ? ` — ${i.quantity} ${i.unit}` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {meal.recipe && (
                                    <div className="px-4 py-3 border-t border-gray-100">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Instructions</p>
                                        <p className="text-sm text-gray-600 whitespace-pre-line">{meal.recipe}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                        </div>
                        </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <div className="flex justify-end pb-6">
                <Button className="bg-teal-500 hover:bg-teal-600 text-white gap-2" onClick={savePlan} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Save & Publish Plan'}
                </Button>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Tabs bar config
    // ─────────────────────────────────────────────────────────────────────────
    const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'plan-info', label: 'Plan Info', icon: Info },
        { id: 'meals', label: 'Daily Meals', icon: UtensilsCrossed },
        { id: 'preview', label: 'Preview', icon: Eye },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // List view
    // ─────────────────────────────────────────────────────────────────────────
    const renderListView = () => (
        <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-xl">
                            <Salad className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Diet Management</h2>
                            <p className="text-gray-500 text-sm">Manage all diet plans and meal schedules</p>
                        </div>
                    </div>
                    <Button
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl"
                        onClick={openCreate}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Diet Plan
                    </Button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-5 mb-8">
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-teal-600" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Plans</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{dietPlans.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Users</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                            {dietPlans.reduce((acc, p) => acc + (p.userDietPlans?.length || 0), 0)}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-purple-600" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Challenge Diets</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                            {dietPlans.reduce((acc, p) => acc + (p.challengeDiets?.length || 0), 0)}
                        </p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">All Diet Plans</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
                        </div>
                    ) : dietPlans.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full bg-white rounded-xl overflow-hidden">
                                <thead className="bg-gradient-to-r from-teal-100 to-cyan-100">
                                    <tr>
                                        {['Plan Name', 'Calories', 'Duration', 'Description', 'Active Users', 'Actions'].map((h, i) => (
                                            <th
                                                key={h}
                                                className={`px-5 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {dietPlans.map(plan => (
                                        <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    {plan.image ? (
                                                        <img src={plan.image} alt={plan.name || ''} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                            <ImageIcon className="w-5 h-5 text-gray-300" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {plan.calories ? (
                                                    <div className="flex items-center gap-1 text-sm text-gray-800">
                                                        <Flame className="w-4 h-4 text-orange-500" />
                                                        {plan.calories} kcal
                                                    </div>
                                                ) : <span className="text-gray-400 text-sm">—</span>}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {plan.duration ? (
                                                    <div className="flex items-center gap-1 text-sm text-gray-800">
                                                        <Calendar className="w-4 h-4 text-blue-500" />
                                                        {plan.duration}
                                                    </div>
                                                ) : <span className="text-gray-400 text-sm">—</span>}
                                            </td>
                                            <td className="px-5 py-4 max-w-[200px]">
                                                {plan.description ? (
                                                    <div className="flex items-start gap-1.5">
                                                        <FileText className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-gray-500 line-clamp-2">{plan.description}</span>
                                                    </div>
                                                ) : <span className="text-gray-400 text-sm">—</span>}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
                                                    {plan.userDietPlans?.length || 0} users
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-600 hover:bg-blue-50"
                                                        onClick={() => openEdit(plan)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:bg-red-50"
                                                        onClick={() => handleDelete(plan.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl py-14 text-center">
                            <Salad className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 font-medium">No diet plans yet</p>
                            <p className="text-gray-300 text-sm mt-1">Create your first diet plan to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Create / Edit view
    // ─────────────────────────────────────────────────────────────────────────
    const renderCreateView = () => (
        <div className="space-y-5">
            {/* Top bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => { resetAll(); setView('list'); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="font-bold text-gray-900">
                            {editingPlan ? `Edit: ${editingPlan.name}` : 'Create Diet Plan'}
                        </h2>
                        <p className="text-xs text-gray-400">Fill in the plan details then add daily meals</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {planInfo.name && (
                        <span className="hidden md:block text-sm text-gray-500">
                            <strong className="text-gray-700">{planInfo.name}</strong>
                            {planInfo.caloriesPerDay && ` — ${planInfo.caloriesPerDay} kcal/day`}
                        </span>
                    )}
                    <Button variant="outline" size="sm" onClick={resetAll}>
                        <RotateCcw className="w-4 h-4 mr-1" /> Reset
                    </Button>
                    <Button
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                        size="sm"
                        onClick={savePlan}
                        disabled={saving}
                    >
                        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                        Save Plan
                    </Button>
                </div>
            </div>

            {saveError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{saveError}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1.5 w-fit">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all
                                ${active ? 'bg-teal-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            {activeTab === 'plan-info' && renderPlanInfoTab()}
            {activeTab === 'meals' && renderMealsTab()}
            {activeTab === 'preview' && renderPreviewTab()}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Root render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="relative">
            {/* Toast notification */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold
                    ${toast.type === 'success' ? 'bg-teal-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {view === 'list' ? renderListView() : renderCreateView()}
        </div>
    );
};

export default DietComponent;