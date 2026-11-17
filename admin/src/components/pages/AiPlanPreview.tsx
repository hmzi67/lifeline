import React, { useCallback, useEffect, useState } from 'react';
import { ImageIcon, Loader2, Maximize2, Upload, Video, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { handleApiError, uploadFile } from '@/services/crudService';
import { aiGeneratorService, type DietPreview, type ExercisePreview, type PlanPreview } from '@/services/aiGeneratorService';

type MediaTarget = 'plan' | 'meal' | 'exercise';

const GOAL_LABELS: Record<string, string> = { weight_loss: 'Lose weight', weight_gain: 'Gain weight', build_muscle: 'Build muscle' };
const capital = (value: string | null) => (value ? value[0].toUpperCase() + value.slice(1) : value);

/** Full-size view of a picture or video, opened by clicking its thumbnail. */
const MediaViewer: React.FC<{ value: string | null; kind: 'image' | 'video'; onClose: () => void }> = ({ value, kind, onClose }) => (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl p-3 bg-black border-0">
            <DialogTitle className="sr-only">{kind === 'video' ? 'Video' : 'Picture'}</DialogTitle>
            {value &&
                (kind === 'video' ? (
                    <video src={value} className="w-full max-h-[80vh] object-contain rounded" controls autoPlay />
                ) : (
                    <img src={value} alt="" className="w-full max-h-[80vh] object-contain rounded" />
                ))}
            {value && (
                <a href={value} target="_blank" rel="noreferrer" className="text-xs text-gray-300 hover:text-white underline">
                    Open in a new tab
                </a>
            )}
        </DialogContent>
    </Dialog>
);

/** A thumbnail: click to see it full size; upload/replace/remove buttons when editable. */
const PictureSlot: React.FC<{
    value: string | null;
    kind?: 'image' | 'video';
    size?: 'sm' | 'lg';
    editable: boolean;
    onSave: (url: string | null) => Promise<void>;
}> = ({ value, kind = 'image', size = 'sm', editable, onSave }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [viewing, setViewing] = useState(false);
    const box = size === 'lg' ? 'w-28 h-28' : 'w-12 h-12';

    const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setBusy(true);
        setError('');
        try {
            await onSave(await uploadFile(file));
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex-shrink-0">
            <div className={`${box} relative rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center group`}>
                {value ? (
                    <button type="button" onClick={() => setViewing(true)} className="w-full h-full cursor-zoom-in" title={`View ${kind}`}>
                        {kind === 'video' ? (
                            <video src={value} className="w-full h-full object-cover" muted />
                        ) : (
                            <img src={value} alt="" className="w-full h-full object-cover" />
                        )}
                        <Maximize2 className="absolute bottom-0.5 left-0.5 w-3 h-3 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                    </button>
                ) : kind === 'video' ? (
                    <Video className="w-4 h-4 text-gray-400" />
                ) : (
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                )}
                {editable && (
                    <label
                        className={
                            value && !busy
                                ? 'absolute bottom-0.5 right-0.5 p-0.5 rounded bg-white/90 text-gray-600 cursor-pointer opacity-0 group-hover:opacity-100'
                                : 'absolute inset-0 flex items-center justify-center bg-black/20 text-white cursor-pointer'
                        }
                        title={value ? `Replace ${kind}` : `Upload ${kind}`}
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className={value ? 'w-3 h-3' : 'w-4 h-4'} />}
                        <input type="file" accept={kind === 'video' ? 'video/mp4,video/webm' : 'image/*'} className="hidden" onChange={pick} disabled={busy} />
                    </label>
                )}
                {editable && value && !busy && (
                    <button
                        type="button"
                        onClick={() => onSave(null).catch((err) => setError(handleApiError(err)))}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-white/90 text-gray-600 opacity-0 group-hover:opacity-100"
                        title={`Remove ${kind}`}
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
            {error && <p className="text-[11px] text-red-600 mt-1 max-w-[7rem]">{error}</p>}
            <MediaViewer value={viewing ? value : null} kind={kind} onClose={() => setViewing(false)} />
        </div>
    );
};

const macro = (value: number | null) => (value == null ? '–' : Math.round(value));

const DietBody: React.FC<{ plan: DietPreview; editable: boolean; save: (target: MediaTarget, id: string, image: string | null) => Promise<void> }> = ({ plan, editable, save }) => (
    <div className="space-y-4">
        {plan.days.map((day) => {
            const total = day.meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0);
            return (
                <div key={day.dayNumber}>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">
                        Day {day.dayNumber} <span className="font-normal text-gray-500">· {total} kcal</span>
                    </h4>
                    <div className="space-y-2">
                        {day.meals.map((meal) => (
                            <details key={meal.id} className="rounded-xl border border-gray-100 p-2">
                                <summary className="flex items-center gap-3 cursor-pointer list-none">
                                    <PictureSlot value={meal.image} editable={editable} onSave={(url) => save('meal', meal.id, url)} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs text-gray-500">{meal.mealType}</div>
                                        <div className="text-sm font-medium text-gray-900 truncate">{meal.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {meal.calories ?? '–'} kcal · P {macro(meal.protein)} · C {macro(meal.carbs)} · F {macro(meal.fats)} g
                                            {meal.portionSize ? ` · ${meal.portionSize}` : ''}
                                        </div>
                                    </div>
                                </summary>
                                {meal.recipe && <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3">{meal.recipe}</pre>}
                            </details>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

/** Which USDA food each ingredient's numbers came from, so a wrong match is easy to spot. */
const NutritionSources: React.FC<{ sources: NonNullable<DietPreview['nutritionSources']> }> = ({ sources }) => (
    <details className="rounded-xl border border-gray-100 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-800">
            Where the calories come from ({sources.length} ingredients)
            <span className="block text-xs font-normal text-gray-500 mt-0.5">
                Each ingredient is matched to a food in our own food table or the USDA database. Check that the match is the same food; if one is wrong, make the plan again.
            </span>
        </summary>
        <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-left text-gray-500">
                        <th className="py-1 pr-3 font-medium">Ingredient in the plan</th>
                        <th className="py-1 pr-3 font-medium">Food the numbers came from</th>
                        <th className="py-1 font-medium text-right whitespace-nowrap">kcal per 100 g</th>
                    </tr>
                </thead>
                <tbody>
                    {sources.map((source) => (
                        <tr key={source.ingredient} className="border-t border-gray-100 text-gray-700">
                            <td className="py-1 pr-3">{source.ingredient}</td>
                            <td className="py-1 pr-3">{source.usdaMatch}</td>
                            <td className="py-1 text-right">{source.kcalPer100g}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </details>
);

const ExerciseBody: React.FC<{
    plan: ExercisePreview;
    editable: boolean;
    save: (target: MediaTarget, id: string, image: string | null, field?: 'image' | 'videoUrl') => Promise<void>;
}> = ({ plan, editable, save }) => (
    <div className="space-y-4">
        {plan.weeks.map((week) => (
            <div key={week.weekNumber}>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Week {week.weekNumber}</h4>
                <div className="space-y-3">
                    {week.days.map((day) => (
                        <div key={day.dayOfWeek} className="rounded-xl border border-gray-100 p-3">
                            <div className="text-xs font-medium text-gray-500 mb-2">{day.dayOfWeek}</div>
                            <div className="space-y-2">
                                {day.exercises.map((row, index) => {
                                    // Library exercises are shared with other plans; only the ones this batch made can be changed here.
                                    const own = editable && row.exercise.createdByBatch;
                                    return (
                                        <div key={`${row.exercise.id}-${index}`} className="flex items-center gap-3">
                                            <PictureSlot value={row.exercise.image} editable={own} onSave={(url) => save('exercise', row.exercise.id, url, 'image')} />
                                            {row.exercise.createdByBatch && (
                                                <PictureSlot value={row.exercise.videoUrl} kind="video" editable={own} onSave={(url) => save('exercise', row.exercise.id, url, 'videoUrl')} />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-gray-900 truncate">
                                                    {row.exercise.name}
                                                    {row.exercise.createdByBatch && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-medium align-middle">NEW</span>
                                                    )}
                                                    {row.exercise.pictureOnPublish && (
                                                        <span
                                                            className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium align-middle"
                                                            title="This exercise is already in the app. It keeps its current picture there until you publish this plan."
                                                        >
                                                            NEW PICTURE ON PUBLISH
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {row.sets} × {row.reps ? `${row.reps} reps (${row.duration})` : row.duration}
                                                    {row.exercise.difficulty ? ` · ${row.exercise.difficulty}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const AiPlanPreview: React.FC<{ batchId: string; planId: string; canEditMedia: boolean; onClose: () => void; onChanged: () => void }> = ({
    batchId,
    planId,
    canEditMedia,
    onClose,
    onChanged,
}) => {
    const [plan, setPlan] = useState<PlanPreview | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            setPlan(await aiGeneratorService.planPreview(batchId, planId));
        } catch (err) {
            setError(handleApiError(err));
        }
    }, [batchId, planId]);

    useEffect(() => {
        load();
    }, [load]);

    const save = async (target: MediaTarget, id: string, url: string | null, field: 'image' | 'videoUrl' = 'image') => {
        await aiGeneratorService.setMedia(batchId, { target, id, [field]: url });
        await load();
        if (target === 'plan') onChanged();
    };

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="bg-white sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{plan?.name ?? 'Plan'}</DialogTitle>
                    <DialogDescription>
                        {plan?.kind === 'diet'
                            ? [GOAL_LABELS[plan.goal ?? ''] ?? plan.goal, plan.calories ? `${plan.calories} kcal/day` : null, plan.duration, plan.cuisineName].filter(Boolean).join(' · ')
                            : plan
                              ? [capital(plan.level), plan.durationWeeks ? `${plan.durationWeeks} weeks` : null].filter(Boolean).join(' · ')
                              : ''}
                    </DialogDescription>
                </DialogHeader>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {!plan && !error && <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto" />}

                {plan && (
                    <div className="space-y-5">
                        <div className="flex gap-4">
                            <PictureSlot value={plan.image} size="lg" editable={canEditMedia} onSave={(url) => save('plan', plan.id, url)} />
                            <div className="text-sm text-gray-700 space-y-2">
                                <p>{plan.description}</p>
                                {canEditMedia && <p className="text-xs text-gray-500">Click a picture to see it full size; hover it to replace or remove it. A meal&apos;s picture is used for every day that has the same meal.</p>}
                            </div>
                        </div>
                        {plan.kind === 'diet' && !!plan.nutritionSources?.length && <NutritionSources sources={plan.nutritionSources} />}
                        {plan.kind === 'diet' ? (
                            <DietBody plan={plan} editable={canEditMedia} save={(t, id, url) => save(t, id, url)} />
                        ) : (
                            <ExerciseBody plan={plan} editable={canEditMedia} save={save} />
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AiPlanPreview;
