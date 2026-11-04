import React, { useEffect, useRef, useState } from 'react';
import {
    AlertCircle, ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Copy, Dumbbell, Edit, ImageIcon,
    Loader2, Plus, Save, Trash2, X,
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

interface Exercise {
    id: string;
    name: string;
    image?: string | null;
}

interface ScheduleApiRow {
    id: string;
    exerciseId: string;
    dayOfWeek: string;
    sets: number | null;
    reps: string | null;
    duration: string | null;
    orderIndex: number | null;
    exercise?: Exercise;
}

interface ExercisePlanApi {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    level: string | null;
    durationWeeks: number | null;
    exercisePlanWeeks?: { id: string; weekNumber: number; exercisePlanSchedule?: ScheduleApiRow[] }[];
}

/** One exercise on one weekday of one week. */
interface RowDraft {
    key: number;
    /** Set for a row already saved, so saving updates it and keeps users' progress attached. */
    serverId?: string;
    exerciseId: string;
    sets: string;
    reps: string;
    duration: string;
}

type WeekDraft = Record<string, RowDraft[]>; // weekday -> rows

interface PlanForm {
    name: string;
    description: string;
    level: string;
    weeks: string;
    imageFile: File | null;
    imagePreview: string;
}

// The app sorts a week's workouts by these names.
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const emptyForm = (): PlanForm => ({ name: '', description: '', level: '', weeks: '4', imageFile: null, imagePreview: '' });

let keySeed = Date.now();
const nextKey = () => keySeed++;

const workoutCount = (plan: ExercisePlanApi) =>
    (plan.exercisePlanWeeks || []).reduce((sum, w) => sum + (w.exercisePlanSchedule?.length || 0), 0);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ExercisePlanComponent: React.FC = () => {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [plans, setPlans] = useState<ExercisePlanApi[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editingPlan, setEditingPlan] = useState<ExercisePlanApi | null>(null);
    const [form, setForm] = useState<PlanForm>(emptyForm());
    const [weeks, setWeeks] = useState<Record<number, WeekDraft>>({});
    const [activeWeek, setActiveWeek] = useState(1);
    const [copyFromWeek, setCopyFromWeek] = useState('');
    const [loadingPlan, setLoadingPlan] = useState(false);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const imageRef = useRef<HTMLInputElement>(null);

    const weekCount = Math.min(Math.max(parseInt(form.weeks, 10) || 1, 1), 104);
    const weekNumbers = Array.from({ length: weekCount }, (_, i) => i + 1);
    const rowsIn = (week: number) => WEEKDAYS.reduce((sum, d) => sum + (weeks[week]?.[d]?.length || 0), 0);
    const filledWeeks = Object.keys(weeks).map(Number).filter(w => rowsIn(w) > 0).sort((a, b) => a - b);

    useEffect(() => {
        fetchPlans();
        api.get('/exercises')
            .then(res => setExercises((res.data?.data || []).map((e: any) => ({ id: e.id, name: e.name, image: e.image }))))
            .catch(() => setExercises([]));
    }, []);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/exercise-plans');
            setPlans(res.data?.data || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load exercise plans.');
        } finally {
            setLoading(false);
        }
    };

    // ── Open / reset ──────────────────────────────────────────────────────────
    const openCreate = () => {
        setEditingPlan(null);
        setForm(emptyForm());
        setWeeks({});
        setActiveWeek(1);
        setCopyFromWeek('');
        setSaveError('');
        setView('edit');
    };

    const openEdit = async (plan: ExercisePlanApi) => {
        setEditingPlan(plan);
        setForm({
            name: plan.name || '',
            description: plan.description || '',
            level: plan.level || '',
            weeks: String(plan.durationWeeks || Math.max(1, ...(plan.exercisePlanWeeks || []).map(w => w.weekNumber))),
            imageFile: null,
            imagePreview: plan.image || '',
        });
        setWeeks({});
        setActiveWeek(1);
        setCopyFromWeek('');
        setSaveError('');
        setView('edit');
        setLoadingPlan(true);
        try {
            // Load the full plan so every saved workout comes back with its id.
            const res = await api.get(`/exercise-plans/${plan.id}`);
            const full: ExercisePlanApi = res.data?.data || plan;
            const next: Record<number, WeekDraft> = {};
            for (const week of full.exercisePlanWeeks || []) {
                const byDay: WeekDraft = {};
                const rows = [...(week.exercisePlanSchedule || [])].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                for (const row of rows) {
                    const day = WEEKDAYS.find(d => d.toLowerCase() === String(row.dayOfWeek).toLowerCase()) || 'Monday';
                    (byDay[day] ||= []).push({
                        key: nextKey(),
                        serverId: row.id,
                        exerciseId: row.exerciseId,
                        sets: row.sets != null ? String(row.sets) : '',
                        reps: row.reps || '',
                        duration: row.duration || '',
                    });
                }
                next[week.weekNumber] = byDay;
            }
            setWeeks(next);
        } catch (err: any) {
            setSaveError(err.response?.data?.message || "Couldn't load this plan's workouts. Reload the page before saving.");
        } finally {
            setLoadingPlan(false);
        }
    };

    // ── Schedule editing ──────────────────────────────────────────────────────
    const updateDay = (day: string, update: (rows: RowDraft[]) => RowDraft[]) => {
        setWeeks(prev => {
            const week = prev[activeWeek] || {};
            return { ...prev, [activeWeek]: { ...week, [day]: update(week[day] || []) } };
        });
    };

    const addRow = (day: string) => updateDay(day, rows => [...rows, { key: nextKey(), exerciseId: '', sets: '3', reps: '10', duration: '' }]);
    const removeRow = (day: string, key: number) => updateDay(day, rows => rows.filter(r => r.key !== key));
    const changeRow = (day: string, key: number, field: keyof RowDraft, value: string) =>
        updateDay(day, rows => rows.map(r => (r.key === key ? { ...r, [field]: value } : r)));
    const moveRow = (day: string, index: number, delta: number) =>
        updateDay(day, rows => {
            const target = index + delta;
            if (target < 0 || target >= rows.length) return rows;
            const next = [...rows];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    // Adds a copy of another week's workouts to the week being edited (nothing is overwritten).
    const copyWeek = () => {
        const from = Number(copyFromWeek);
        const source = weeks[from];
        if (!from || from === activeWeek || !source) return;
        setWeeks(prev => {
            const target = { ...(prev[activeWeek] || {}) };
            for (const day of WEEKDAYS) {
                const rows = source[day] || [];
                if (rows.length) target[day] = [...(target[day] || []), ...rows.map(r => ({ ...r, key: nextKey(), serverId: undefined }))];
            }
            return { ...prev, [activeWeek]: target };
        });
        setCopyFromWeek('');
        showToast(`Copied week ${from}'s workouts to week ${activeWeek}.`);
    };

    // ── Save / delete ─────────────────────────────────────────────────────────
    const save = async () => {
        if (!form.name.trim()) {
            showToast('Plan name is required.', 'error');
            return;
        }
        if (editingPlan && loadingPlan) {
            showToast("This plan's workouts are still loading.", 'error');
            return;
        }
        const lateWeek = filledWeeks.find(w => w > weekCount);
        if (lateWeek) {
            showToast(`Week ${lateWeek} has workouts but the plan is only ${weekCount} weeks. Increase the weeks or remove them.`, 'error');
            return;
        }
        const missing = filledWeeks.flatMap(w => WEEKDAYS.flatMap(d => (weeks[w][d] || []).filter(r => !r.exerciseId).map(() => `week ${w} ${d}`)));
        if (missing.length) {
            showToast(`Pick an exercise for every row (${missing[0]}).`, 'error');
            return;
        }

        setSaving(true);
        setSaveError('');
        let createdId: string | null = null;
        try {
            const image = form.imageFile ? await uploadFile(form.imageFile) : (form.imagePreview || null);
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                level: form.level || null,
                durationWeeks: weekCount,
                image,
            };
            let planId: string;
            if (editingPlan) {
                await api.put(`/exercise-plans/${editingPlan.id}`, payload);
                planId = editingPlan.id;
            } else {
                const res = await api.post('/exercise-plans', payload);
                planId = res.data?.data?.id;
                createdId = planId || null;
            }

            await api.put(`/exercise-plans/${planId}/schedule`, {
                weeks: filledWeeks.map(weekNumber => ({
                    weekNumber,
                    days: WEEKDAYS.filter(d => (weeks[weekNumber][d] || []).length).map(dayOfWeek => ({
                        dayOfWeek,
                        exercises: weeks[weekNumber][dayOfWeek].map(r => ({
                            id: r.serverId,
                            exerciseId: r.exerciseId,
                            sets: r.sets ? parseInt(r.sets, 10) : null,
                            reps: r.reps || null,
                            duration: r.duration || null,
                        })),
                    })),
                })),
            });

            showToast(editingPlan ? 'Exercise plan updated.' : 'Exercise plan created.');
            setView('list');
            fetchPlans();
        } catch (err: any) {
            if (createdId) await api.delete(`/exercise-plans/${createdId}`).catch(() => undefined);
            const msg = err.response?.data?.message || 'Failed to save exercise plan.';
            setSaveError(msg);
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (plan: ExercisePlanApi) => {
        if (!window.confirm(`Delete "${plan.name}"?`)) return;
        try {
            await api.delete(`/exercise-plans/${plan.id}`);
            showToast('Exercise plan deleted.');
            fetchPlans();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to delete exercise plan.', 'error');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const renderToast = () => toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white
            ${toast.type === 'success' ? 'bg-teal-500' : 'bg-red-500'}`}>
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toast.msg}
        </div>
    );

    const renderList = () => (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-xl">
                        <CalendarDays className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Exercise Plans</h2>
                        <p className="text-gray-500 text-sm">Weekly workout plans shown on the app's Exercise tab</p>
                    </div>
                </div>
                <Button
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-teal-600 hover:to-cyan-600 shadow-lg"
                    onClick={openCreate}
                >
                    <Plus className="w-5 h-5 mr-2" /> Add Exercise Plan
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
                </div>
            ) : plans.length === 0 ? (
                <div className="py-14 text-center">
                    <Dumbbell className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">No exercise plans yet</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full bg-white rounded-xl overflow-hidden">
                        <thead className="bg-gradient-to-r from-teal-100 to-cyan-100">
                            <tr>
                                {['Plan', 'Level', 'Weeks', 'Workouts', 'Actions'].map((h, i) => (
                                    <th key={h} className={`px-5 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {plans.map(plan => (
                                <tr key={plan.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            {plan.image ? (
                                                <img src={plan.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <ImageIcon className="w-5 h-5 text-gray-300" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{plan.name}</div>
                                                {plan.description && <div className="text-xs text-gray-400 line-clamp-1 max-w-xs">{plan.description}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-700">{plan.level || '—'}</td>
                                    <td className="px-5 py-4 text-sm text-gray-700">{plan.durationWeeks ?? plan.exercisePlanWeeks?.length ?? '—'}</td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${workoutCount(plan) ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {workoutCount(plan) ? `${workoutCount(plan)} exercises` : 'No workouts yet'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-right whitespace-nowrap">
                                        <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50" onClick={() => openEdit(plan)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(plan)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderDay = (day: string) => {
        const rows = weeks[activeWeek]?.[day] || [];
        return (
            <div key={day} className="border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{day}</span>
                        <span className="text-xs text-gray-400">{rows.length ? `${rows.length} exercise${rows.length === 1 ? '' : 's'}` : 'Rest day'}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addRow(day)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add exercise
                    </Button>
                </div>
                {rows.length > 0 && (
                    <div className="p-3 space-y-2">
                        {rows.map((row, index) => (
                            <div key={row.key} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-12 md:col-span-5">
                                    <Select value={row.exerciseId} onValueChange={v => changeRow(day, row.key, 'exerciseId', v)}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Pick an exercise" /></SelectTrigger>
                                        <SelectContent>
                                            {exercises.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input className="col-span-3 md:col-span-1 h-9" type="number" min={0} placeholder="Sets" value={row.sets} onChange={e => changeRow(day, row.key, 'sets', e.target.value)} />
                                <Input className="col-span-4 md:col-span-2 h-9" placeholder="Reps (e.g. 10)" maxLength={50} value={row.reps} onChange={e => changeRow(day, row.key, 'reps', e.target.value)} />
                                <Input className="col-span-5 md:col-span-2 h-9" placeholder="Duration (e.g. 45 sec)" maxLength={50} value={row.duration} onChange={e => changeRow(day, row.key, 'duration', e.target.value)} />
                                <div className="col-span-12 md:col-span-2 flex justify-end gap-1">
                                    <button type="button" className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={index === 0} onClick={() => moveRow(day, index, -1)} title="Move up"><ArrowUp className="w-4 h-4" /></button>
                                    <button type="button" className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={index === rows.length - 1} onClick={() => moveRow(day, index, 1)} title="Move down"><ArrowDown className="w-4 h-4" /></button>
                                    <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => removeRow(day, row.key)} title="Remove"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderEditor = () => (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3">
                    <button type="button" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setView('list')}><ArrowLeft className="w-4 h-4" /></button>
                    <div>
                        <h2 className="font-bold text-gray-900">{editingPlan ? 'Edit Exercise Plan' : 'Create Exercise Plan'}</h2>
                        <p className="text-xs text-gray-400">Plan details, then each week's workouts</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setView('list')}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                    <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                        {saving ? 'Saving...' : 'Save Plan'}
                    </Button>
                </div>
            </div>

            {saveError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{saveError}</p>
                </div>
            )}

            {/* Plan details */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-3 space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan Name <span className="text-red-500">*</span></Label>
                            <Input value={form.name} maxLength={100} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 4-Week Full Body Beginner" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</Label>
                            <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                                <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weeks <span className="text-red-500">*</span></Label>
                            <Input type="number" min={1} max={104} value={form.weeks} onChange={e => setForm(f => ({ ...f, weeks: e.target.value }))} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</Label>
                        <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Who this plan is for and what it does" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan Image</Label>
                    <div
                        className="border-2 border-dashed border-gray-200 rounded-xl h-[150px] flex items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 overflow-hidden"
                        onClick={() => imageRef.current?.click()}
                    >
                        {form.imagePreview ? (
                            <img src={form.imagePreview} alt="Plan" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-gray-400 pointer-events-none">
                                <ImageIcon className="w-7 h-7" />
                                <span className="text-xs font-semibold">Click to upload</span>
                            </div>
                        )}
                    </div>
                    <input
                        ref={imageRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setForm(f => ({ ...f, imageFile: file, imagePreview: ev.target?.result as string }));
                            reader.readAsDataURL(file);
                        }}
                    />
                </div>
            </div>

            {/* Weeks and workouts */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-teal-500" />
                        <h3 className="font-bold text-gray-800">Weekly Workouts</h3>
                        <span className="text-xs text-gray-400">In the app these become Day 1, Day 2, ... in week and weekday order</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={copyFromWeek} onValueChange={setCopyFromWeek}>
                            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Copy from week..." /></SelectTrigger>
                            <SelectContent>
                                {filledWeeks.filter(w => w !== activeWeek).map(w => (
                                    <SelectItem key={w} value={String(w)}>Week {w} ({rowsIn(w)} exercises)</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={copyWeek} disabled={!copyFromWeek}>
                            <Copy className="w-4 h-4 mr-1" /> Copy to Week {activeWeek}
                        </Button>
                    </div>
                </div>

                {loadingPlan ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading workouts...</div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {weekNumbers.map(w => {
                                const count = rowsIn(w);
                                return (
                                    <button
                                        key={w}
                                        type="button"
                                        onClick={() => { setActiveWeek(w); setCopyFromWeek(''); }}
                                        className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold
                                            ${w === activeWeek ? 'border-teal-500 bg-teal-50 text-teal-700' : count ? 'border-teal-200 text-gray-700 hover:border-teal-400' : 'border-gray-200 text-gray-400 hover:border-teal-300'}`}
                                    >
                                        Week {w}{count ? <span className="ml-1 text-[10px] text-teal-600">· {count}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                        {exercises.length === 0 && (
                            <p className="text-xs text-amber-600 mb-3">No exercises in the library yet. Add some on the Exercises page first.</p>
                        )}
                        <div className="space-y-3">{WEEKDAYS.map(renderDay)}</div>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <>
            {renderToast()}
            {view === 'list' ? renderList() : renderEditor()}
        </>
    );
};

export default ExercisePlanComponent;
