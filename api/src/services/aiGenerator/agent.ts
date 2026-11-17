import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { CONTENT_STATUS } from '../../utils/contentStatus.js';
import { dropJobDraft, dropUnusedDraftExercises } from './batchService.js';
import { JOB_STATUS, LIMITS, MediaSource, PendingMedia, ReviewData } from './constants.js';
import { describeDietPlan, dietToolDefinitions, loadMealTypes, runDietTool } from './dietTools.js';
import { cuisineName, dietRulebook } from './dietRules.js';
import {
  correctTags,
  describeExercisePlan,
  exerciseCatalogText,
  exerciseTagsSchema,
  exerciseToolDefinitions,
  existingPlanNames,
  library,
  runExerciseTool,
} from './exerciseTools.js';
import { pictureFor, stockVideo } from './media.js';
import { aiSettings, chat, ChatMessage, ToolDefinition } from './openai.js';
import { defaultCalories, describeRules, ExerciseRules, sessionBand } from './validate.js';
import { macroTargets, targetsText } from './macros.js';
import {
  loadDietDraft,
  loadExerciseDraft,
  revisedSpec,
  revisionOf,
  revisionText,
} from './revise.js';
import { JobContext, JobError, JobHandler, JobOutcome } from './worker.js';
import type { AgentState, LogEntry, ToolResult } from './agentTypes.js';

/**
 * Generates one plan: an OpenAI model calls our tools (search/create exercises, USDA nutrition,
 * save the draft) until the plan passes the code checks, then a second model reviews it and the
 * first fixes what it finds (at most CRITIC_ROUNDS times). Pictures are added last, so a plan
 * that gets rejected never costs image money. Our code does every database write.
 */

const MAX_STEPS = 30;
/** Reviewer fix rounds (now that rejected saves stop early and old drafts aren't resent, a second round is cheap). */
/** How many times reviewer findings go back to the writer AI before the plan is left for the admin. */
const criticRoundsFor = (kind: string) => (kind === 'diet' ? 3 : 2);
const MAX_NUDGES = 3;
/** Give up after this many save attempts in a row that break the rules. */
const MAX_REJECTIONS_IN_ROW = 5;
const SAVE_TOOLS = new Set(['save_exercise_plan', 'save_diet_plan']);
const OMITTED_DRAFT = JSON.stringify({
  omitted: 'Earlier draft removed to save space; the latest save call below is the current one.',
});

/**
 * Every call resends the whole conversation, so old full-plan drafts made each retry dearer.
 * Keep only the newest save call's arguments; earlier ones become a short placeholder.
 */
const compactDrafts = (messages: ChatMessage[]) => {
  let newest = true;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    for (const call of message.tool_calls ?? []) {
      if (!SAVE_TOOLS.has(call.function.name) || call.function.arguments === OMITTED_DRAFT)
        continue;
      if (newest) newest = false;
      else call.function.arguments = OMITTED_DRAFT;
    }
  }
};

const now = () => new Date().toISOString();
const bullets = (items: string[]) => items.map(item => `• ${item}`).join('\n');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Plain-language log line for a tool step (the batch page is read by non-technical admins). */
const friendlyStep = (name: string, summary: string, errors: string[]) => {
  if (SAVE_TOOLS.has(name)) {
    if (summary.startsWith('saved')) return 'Plan draft saved.';
    if (summary === 'invalid arguments' || summary === 'bad JSON')
      return "The AI's draft was incomplete, so it tried again.";
    const more = errors.length > 3 ? ` (and ${errors.length - 3} more)` : '';
    return `Not saved yet: ${plural(errors.length, 'thing')} to fix: ${errors.slice(0, 3).join('; ')}${more}`;
  }
  const search = summary.match(/^"(.*)": (\d+) found$/);
  if (search) return `Searched the exercise library for "${search[1]}" (${search[2]} found).`;
  const created = summary.match(/^created "(.*)"$/);
  if (created) return `Added a new exercise to the library: ${created[1]}.`;
  const reused = summary.match(/^reused "(.*)"$/);
  if (reused) return `Used an exercise already in the library: ${reused[1]}.`;
  const nutrition = summary.match(/^(\d+) found, (\d+) missing$/);
  if (nutrition)
    return `Looked up nutrition: ${nutrition[1]} found${Number(nutrition[2]) ? `, ${nutrition[2]} not found` : ''}.`;
  return summary;
};
const clip = (text: string, max = 400) => (text.length > max ? `${text.slice(0, max)}…` : text);

const record = (state: AgentState, entry: Omit<LogEntry, 'at'>) => {
  state.log.push({ at: now(), ...entry });
};

const systemPrompt = (kind: string) =>
  kind === 'exercise'
    ? `You are an experienced, safety-minded strength and conditioning coach creating a workout plan for the Lifeline fitness app.
Rules:
- The admin's notes, if any, are hard requirements (e.g. "no floor exercises", "no jumping"). Before every save, check each exercise against them and replace any that break them.
- Use exercise ids from the library list or search_exercises. Create an exercise only when a needed, common exercise is missing.
- Pick exercises that fit the level and focus area, warm up first, and balance the week (don't train the same muscle hard on back-to-back days).
- Progress across weeks: add sets, time or harder variations step by step.
- Durations are per set, written like "45 sec" or "2 min". Reps like "12" or "10 each side"; use null for timed sets.
- The name and description are shown to app users: give the plan a short, appealing name (no "plan 2 of 3", "variant" or batch numbers) and describe what it does for them. Never mention our checks or numeric rules (like a minute range) in either.
- Call save_exercise_plan with the complete plan. If it returns errors, fix every one and save again.
- When it saves without errors, reply with one short sentence and no tool call.`
    : `You are a registered dietitian creating a meal plan for the Lifeline nutrition app.
Rules:
- Every meal lists its ingredients with grams, using plain USDA-style names ("chicken breast, cooked", "rolled oats", "olive oil").
- Calories and macros are calculated from those ingredients by our code, and on save it scales each day's portions to the daily calorie target. Aim roughly for the target; focus on the right foods, the macro balance and variety.
- The admin's notes, if any, are hard requirements. Before every save, check each meal against them.
- Name each meal only after what its ingredients contain: if the name says roti, paratha, naan, rice, chai, lassi, raita, chaat masala, fruit or keema (minced meat), that ingredient is in the list. When you fix a meal, check its name and ingredients still match.
- Follow the rulebook in the brief strictly: every meal is a real home dish of the given cuisine that fits the diet type. Never invent fusion meals (a Western dish with a local name) to hit a protein or calorie number; pick a different dish of the cuisine instead. Vary meals across days.
- The name and description are shown to app users: give the plan a short, appealing name (no "plan 2 of 3", "variant" or batch numbers) and describe what it does for them. Never mention our checks or numeric rules in either.
- Call save_diet_plan with the complete plan. If it returns errors, fix every one and save again.
- When it saves without errors, reply with one short sentence and no tool call.`;

/** Tells the AI which plans exist, so a new one doesn't repeat a name (or a whole plan). */
const existingPlansText = async (state: AgentState, kind: 'exercise' | 'diet') => {
  const names = [...(await existingPlanNames(state, kind)).values()].slice(-80);
  return names.length
    ? `Plans that already exist (give yours a clearly different name and don't copy one): ${names.join('; ')}\n`
    : '';
};

const specText = async (state: AgentState, kind: string) => {
  const spec = state.spec as Record<string, any>;
  if (kind === 'exercise') {
    const rules = describeRules(spec as ExerciseRules);
    return `Create plan ${spec.position} of ${spec.of} in this batch (variant ${spec.variant} of this combination, so make it distinct).
Level: ${spec.level}
Focus area: ${spec.focusArea}
Weeks: ${spec.weeks}; workout days per week: ${spec.daysPerWeek}; target session length: ${spec.minutesPerSession} min
Session time is counted as sets x (duration + 30 sec rest) summed over the day's exercises; every day must come to ${sessionBand(Number(spec.minutesPerSession)).low}-${sessionBand(Number(spec.minutesPerSession)).high} min.
Equipment: ${spec.bodyweightOnly ? 'none (bodyweight only)' : spec.equipment || 'bodyweight and basic dumbbells'}
${rules.length ? `Rules our code checks on every exercise, from its labels: ${rules.join('; ')}. Only pick exercises whose labels fit.\n` : ''}${spec.brief ? `Admin's notes: ${spec.brief}\n` : ''}${await existingPlansText(state, 'exercise')}
Exercise library (id | name | difficulty | purpose | labels: position, impact, equipment):
${await exerciseCatalogText(state)}`;
  }
  const mealTypes = (await loadMealTypes(state)).map(t => t.name);
  return `Create plan ${spec.position} of ${spec.of} in this batch (variant ${spec.variant} of this combination, so make it distinct).
Goal: ${spec.goal}
Diet type: ${spec.dietType}
Daily calories: ${spec.caloriesPerDay ?? defaultCalories(spec.goal)} (each day within 10%)
Daily targets: ${targetsText(macroTargets(spec.goal, spec.dietType))}. Our code fine-tunes portions toward these on every save, but your dishes must make them reachable (e.g. a protein dish at most meals for a high-protein plan).
Days: ${spec.days}; meals per day: ${spec.mealsPerDay} using these meal types: ${mealTypes.join(', ')}
${dietRulebook(spec.dietType, spec.cuisine)}
${spec.brief ? `Admin's notes: ${spec.brief}\n` : ''}${await existingPlansText(state, 'diet')}`;
};

const labelReply = z.object({ labels: z.array(exerciseTagsSchema.extend({ id: z.string() })) });

/**
 * Labels library exercises that have none (floor/standing/seated, impact, equipment) with one
 * cheap AI call per 80 exercises, and saves the labels. They let our code check a batch's rules
 * instead of guessing from an exercise's name. Runs once per exercise; a failure only adds a note.
 */
const labelExercises = async (state: AgentState, signal: AbortSignal) => {
  const all = await library(state);
  const todo = [...all.values()].filter(exercise => exercise.name && !exercise.tags);
  let done = 0;
  try {
    for (let start = 0; start < todo.length; start += 80) {
      const chunk = todo.slice(start, start + 80);
      const response = await chat(
        {
          model: aiSettings().criticModel,
          messages: [
            {
              role: 'system',
              content: `Label each exercise for a fitness app. Reply as JSON: {"labels":[{"id":string,"position":"standing"|"seated"|"floor","impact":"low"|"high","equipment":string[]}]}.
- position "floor": any part is done lying, sitting or kneeling on the floor or with hands on the floor (planks, push-ups, hip thrusts, glute bridges, Russian twists, crunches, sit-ups, mountain climbers, burpees). An incline push-up on a bench is "standing". "seated": on a chair, bench or machine seat (rowing machine, chest press, lat pulldown).
- impact "high": jumping, running, hopping or explosive swings (burpees, jumping jacks, box jumps, mountain climbers done fast). Everything else is "low".
- equipment: everything needed, lowercase, e.g. ["dumbbells"], ["kettlebell"], ["cable machine"], ["bench"]. Goblet squats, farmer carries, overhead presses and Romanian deadlifts need a weight. Empty only for pure bodyweight.
Include every id exactly once.`,
            },
            {
              role: 'user',
              content: chunk
                .map(exercise => `${exercise.id} | ${exercise.name} | ${exercise.purpose ?? ''}`)
                .join('\n'),
            },
          ],
          json: true,
          maxOutputTokens: 6000,
        },
        signal
      );
      state.costUsd += response.costUsd;
      const parsed = labelReply.safeParse(JSON.parse(response.message.content ?? '{}'));
      if (!parsed.success) continue;
      for (const { id, ...label } of parsed.data.labels) {
        const exercise = all.get(id);
        if (!exercise || exercise.tags) continue;
        const tags = correctTags(exercise.name, label) ?? label;
        await prisma.exercise.update({ where: { id }, data: { tags } });
        exercise.tags = tags;
        done += 1;
      }
    }
  } catch (error) {
    if (error instanceof JobError && /API key/i.test(error.message)) throw error;
    record(state, {
      type: 'note',
      summary: `Some exercises could not be labelled (${error instanceof Error ? clip(error.message, 120) : 'error'}).`,
    });
  }
  if (done)
    record(state, {
      type: 'note',
      summary: `Labelled ${plural(done, 'library exercise')} (floor or standing, impact, equipment) so rules can be checked.`,
    });
};

const FORMAT_LIMITS: Record<string, string> = {
  exercise: `What this app's plans can and can't express (don't flag these):
- There is no rest field; the app assumes about 30 sec rest after each set.
- Using the same short warm-up exercise to open every session is fine.
- Each exercise row has only sets, reps and a per-set duration; there are no tempo, load or RPE fields.
- Exercises in a day are done in the listed order. There is no circuit or superset grouping, so "circuit-style" just means a sensible order with short rests.
- There is no notes, cueing or disclaimer field; don't ask the plan to state clearances, cues or which machine to use.
- Each exercise carries labels (position, impact, equipment) listed under the plan. Our code already enforces the yes/no rules in the requirements (noFloorExercises, lowImpactOnly, bodyweightOnly) from those labels, so don't guess from a name whether an exercise is on the floor or high impact.
Anything that breaks the admin's notes in the requirements is always mustFix.`,
  diet: `What this app's plans can and can't express (don't flag these):
- Meals have a name, ingredients with grams and computed nutrition; there are no cooking steps or timing fields.
- Calorie and macro numbers were calculated by code from USDA data; don't recompute them.
- Portions were scaled by code to the calorie target and the protein/carb/fat targets, so odd gram amounts (e.g. 85 g) are fine and the macro shares were already checked by code.
The requirements include a rulebook for the cuisine and diet type. A meal that isn't a real home dish of that cuisine, or doesn't fit the diet type (e.g. a sandwich, toast or oats bowl in a Pakistani plan, gym food in a High-Protein plan), is mustFix: name the meal and suggest a dish of the cuisine to replace it.
- Our code picks and checks the USDA food behind each ingredient. Don't comment on USDA matches, USDA names or how an ingredient is spelled. Do flag a meal whose name doesn't match what its ingredients make.`,
};

/**
 * The only kinds of problem that may block a plan. A reviewer will always find something to say,
 * so anything outside these is a suggestion, and our code drops must-fix items without one of
 * these types. Things our code checks (calories, macros, USDA matches, session time, labels)
 * are not on the list.
 */
const MUST_FIX_TYPES: Record<string, Record<string, string>> = {
  diet: {
    safety: 'could harm the user (e.g. raw or unsafe food, a dangerous amount of something)',
    diet_type:
      'a meal clearly breaks the diet type (meat in a vegetarian plan, a sugary dessert in a diabetes plan, bread and rice in keto)',
    cuisine: 'a meal is not a real home dish of the requested cuisine',
    admin_notes: "a meal breaks the admin's notes",
    wrong_name:
      'a meal is named after a main food it does not contain (e.g. "fruit chaat" with no fruit, "keema" made with chunks), or the plan name or description promises something false',
    broken:
      'nonsense content: empty or gibberish meals, a meal type used wrongly, a day copied by mistake',
  },
  exercise: {
    safety:
      'a real injury risk for this level (e.g. heavy or explosive moves for beginners, no warm-up before hard work)',
    level: 'clearly too hard or too easy for the requested level',
    focus_area: 'the plan mostly ignores the requested focus area',
    admin_notes: "an exercise breaks the admin's notes",
    wrong_name: 'the plan name or description promises something false',
    broken: 'nonsense content: empty days, an exercise repeated many times in one day by mistake',
  },
};

const criticPrompt = (kind: string) => {
  const types = MUST_FIX_TYPES[kind] ?? MUST_FIX_TYPES.diet;
  return `You review ${kind === 'exercise' ? 'workout plans as a certified strength coach' : 'meal plans as a registered dietitian'} before they go to app users.
${FORMAT_LIMITS[kind] ?? ''}
"mustFix" is only for these kinds of problem (use the type in brackets):
${Object.entries(types)
  .map(([type, meaning]) => `- [${type}] ${meaning}`)
  .join('\n')}
Everything else is a "suggestion": variety, repetition, balance, portion sizes, taste, a spice, garnish, drink or side named but not listed, more vegetables, nicer names. Our code already checks calories, protein/carbs/fat, the USDA foods${kind === 'exercise' ? ', session length and exercise labels' : ''}; don't mention those.
Most good plans have an empty mustFix list; that is the normal result, not a failure to look hard enough. When unsure, it is a suggestion. An item you would word with "may", "could", "consider" or "if intended" is a suggestion.
Only list problems. Never list something that is fine, matches a requirement or was done as asked. A rule in the requirements applies only when it is set (true).
Reply as JSON: {"mustFix": [{"type": string, "problem": string}], "suggestions": string[]} with at most 6 short, specific items in each list.`;
};

/**
 * After the first review, the reviewer checks its own earlier list instead of starting over.
 * Without this every round found new small things (a name not matching its ingredients) and the
 * plan never converged.
 */
const followUp = (earlier: string[]) => `

This is a re-check. The previous review asked for these fixes:
- ${earlier.join('\n- ')}

Check each item above against the plan as it is now and drop it if it is fixed or no longer applies; never repeat an item just because it was listed before.
For this review, put under "mustFix" only (a) items above that are still not fixed and (b) new problems that are serious: a safety risk, a meal or exercise that breaks the diet type, cuisine, level or the admin's notes, or nonsense content. Put every other new finding under "suggestions".`;

/** Spend so far of this job's batch, to respect the batch cost cap mid-job. */
const batchBudget = async (batchId: string) => {
  const batch = await prisma.aiGenerationBatch.findUnique({
    where: { id: batchId },
    select: { costUsd: true, costCapUsd: true },
  });
  return { spentBefore: batch?.costUsd ?? 0, cap: batch?.costCapUsd ?? null };
};

const review = async (
  state: AgentState,
  kind: string,
  signal: AbortSignal,
  earlier: string[] = []
) => {
  if (!state.lastPlan)
    return { approved: false, issues: ['No plan saved.'], suggestions: [] as string[] };
  const text =
    state.lastPlan.kind === 'exercise'
      ? describeExercisePlan(state, state.lastPlan.plan)
      : describeDietPlan(state, state.lastPlan.plan);
  const specObject = state.spec as Record<string, any>;
  const spec =
    JSON.stringify(state.spec) +
    (kind === 'diet' ? `\n\n${dietRulebook(specObject.dietType, specObject.cuisine)}` : '');
  // A reply that isn't JSON is asked for once more; if it still can't be read, the plan was not
  // reviewed and must not pass as if it had been.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await chat(
      {
        model: aiSettings().criticModel,
        messages: [
          { role: 'system', content: criticPrompt(kind) },
          {
            role: 'user',
            content: `Requirements: ${spec}\n\nPlan:\n${text}${earlier.length ? followUp(earlier) : ''}`,
          },
        ],
        json: true,
        maxOutputTokens: 2000,
      },
      signal
    );
    state.costUsd += response.costUsd;
    try {
      const parsed = JSON.parse(response.message.content ?? '');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('not an object');
      // Models sometimes write "None" instead of an empty list; that is not an issue.
      const empty = /^\s*(none|n\/a|na|no issues?|nothing|-)\.?\s*$/i;
      const text = (item: unknown) => {
        if (!item || typeof item !== 'object') return String(item ?? '');
        const fields = item as Record<string, unknown>;
        const found = ['problem', 'suggestion', 'idea', 'text', 'description']
          .map(key => fields[key])
          .find(v => typeof v === 'string');
        return typeof found === 'string' ? found : '';
      };
      const list = (value: unknown) =>
        Array.isArray(value)
          ? value
              .map(text)
              .filter(item => item.trim() && !empty.test(item))
              .slice(0, 6)
          : [];
      // A "problem" that says the plan does what was asked is not one (seen in testing).
      const fine =
        /\b(matches|meets|satisfies|complies with|in line with|as (requested|required))\b.*\b(requirement|request|brief|rules?)\b|\bno (issues?|problems?)\b/i;
      // A must-fix item counts only with one of the allowed types; anything else becomes a suggestion.
      const allowed = MUST_FIX_TYPES[kind] ?? MUST_FIX_TYPES.diet;
      const typed = (Array.isArray(parsed.mustFix) ? parsed.mustFix : []).map((item: unknown) =>
        item && typeof item === 'object'
          ? {
              type: String((item as any).type ?? '')
                .toLowerCase()
                .replace(/[^a-z_]/g, ''),
              problem: String((item as any).problem ?? ''),
            }
          : { type: '', problem: String(item) }
      );
      const issues = list(
        typed
          .filter((item: { type: string }) => item.type in allowed)
          .map((item: { problem: string }) => item.problem)
      ).filter(item => !fine.test(item));
      parsed.suggestions = [
        ...list(parsed.suggestions),
        ...typed
          .filter((item: { type: string }) => !(item.type in allowed))
          .map((item: { problem: string }) => item.problem),
      ];
      const suggestions = list(parsed.suggestions);
      const verdict = { approved: issues.length === 0, issues, suggestions };
      const summary = [
        verdict.approved ? 'Approved.' : `Must fix: ${issues.join('; ')}.`,
        ...(suggestions.length ? [`Optional ideas: ${suggestions.join('; ')}.`] : []),
      ].join(' ');
      record(state, { type: 'critic', summary: clip(summary, 700), costUsd: response.costUsd });
      return verdict;
    } catch {
      record(state, {
        type: 'critic',
        summary: attempt
          ? 'The review could not be read again, so this plan was not reviewed.'
          : 'The review could not be read; asking again.',
        costUsd: response.costUsd,
      });
    }
  }
  return { approved: false, unreadable: true, issues: [] as string[], suggestions: [] as string[] };
};

/** True when a picture/video link is missing or points at another site instead of our /uploads. */
export const needsOwnPicture = (url: string | null | undefined) => !url || !/\/uploads\//.test(url);

/** Pictures (and stock videos) for what this job made. Failures only add notes. */
const addMedia = async (
  state: AgentState,
  kind: string,
  source: MediaSource,
  signal: AbortSignal,
  overBudget: () => boolean = () => false
) => {
  if (source === 'admin_upload' || !state.planId || !state.lastPlan) return [] as string[];
  const notes: string[] = [];
  const attempt = async (
    label: string,
    run: () => Promise<{ url: string | null; costUsd: number; note?: string }>
  ) => {
    try {
      const result = await run();
      state.costUsd += result.costUsd;
      if (result.note) notes.push(result.note);
      record(state, {
        type: 'media',
        name: label,
        summary: result.url ? 'added' : (result.note ?? 'none'),
        costUsd: result.costUsd,
      });
      return result.url;
    } catch (error) {
      const message = `${label}: ${error instanceof Error ? error.message : 'failed'}`;
      notes.push(message);
      record(state, { type: 'media', name: label, summary: clip(message) });
      return null;
    }
  };

  const plan = state.lastPlan.plan;
  // "Apply ideas": the new version reuses the original plan's pictures for what didn't change.
  const basePlanId =
    revisionOf((state.ctx.job.spec ?? {}) as Record<string, unknown>)?.fromPlanId ?? null;
  const baseCover = basePlanId
    ? kind === 'exercise'
      ? (
          await prisma.exercisePlan.findUnique({
            where: { id: basePlanId },
            select: { image: true },
          })
        )?.image
      : (await prisma.dietPlan.findUnique({ where: { id: basePlanId }, select: { image: true } }))
          ?.image
    : null;
  const reuse = async (label: string, url: string | null | undefined) => {
    if (!url) return null;
    record(state, { type: 'media', name: label, summary: 'kept from the original plan' });
    return url;
  };
  const cover =
    (await reuse('plan cover', baseCover)) ??
    (await attempt('plan cover', () =>
      pictureFor(
        source,
        {
          prompt: `Bright, appetising, realistic photo for a ${kind === 'exercise' ? 'fitness workout plan' : 'healthy meal plan'} called "${plan.name}". No text, no logos.`,
          stockQuery:
            kind === 'exercise'
              ? `${String(state.spec.focusArea ?? '')} workout`
              : `${String(state.spec.dietType ?? '')} healthy food`,
        },
        signal
      )
    ));
  if (cover) {
    if (kind === 'exercise')
      await prisma.exercisePlan.update({ where: { id: state.planId }, data: { image: cover } });
    else await prisma.dietPlan.update({ where: { id: state.planId }, data: { image: cover } });
  }

  const outOfTime = () => {
    if (!signal.aborted) return false;
    notes.push(
      'Ran out of time for pictures, so some are missing. Upload them here, or make the plan again.'
    );
    return true;
  };

  if (kind === 'exercise') {
    // Every exercise the plan uses, not only new ones: pictures are stored on the shared exercise,
    // so one with no picture or only another site's link (e.g. a placeholder) gets one from this
    // batch's source. Pictures already in our uploads (admin or earlier generated) are kept.
    //
    // An exercise that is already live in the app is not changed here: its new picture is held on
    // the job (pendingMedia) and applied when an admin publishes the plan, so app users never see
    // a picture nobody has reviewed. Draft exercises (new in this batch) get theirs right away.
    const pending: PendingMedia = {};
    const others = await prisma.aiGenerationJob.findMany({
      where: { batchId: state.batchId, id: { not: state.ctx.job.id } },
      select: { reviewData: true },
    });
    const alreadyMade: PendingMedia = Object.assign(
      {},
      ...others.map(job => ((job.reviewData ?? {}) as ReviewData).pendingMedia ?? {})
    );
    const planExercises =
      state.lastPlan.kind === 'exercise'
        ? state.lastPlan.plan.weeks.flatMap(w =>
            w.days.flatMap(d => d.exercises.map(e => e.exerciseId))
          )
        : [];
    for (const id of new Set([...state.createdExerciseIds, ...planExercises])) {
      if (outOfTime()) break;
      if (overBudget()) {
        notes.push('Cost cap reached; some exercises got no new picture.');
        break;
      }
      const exercise = await prisma.exercise.findUnique({
        where: { id },
        select: { name: true, image: true, videoUrl: true, status: true },
      });
      if (!exercise?.name) continue;
      const live = exercise.status === CONTENT_STATUS.published;
      const keep = async (field: 'image' | 'videoUrl', url: string) => {
        if (live) pending[id] = { ...pending[id], [field]: url };
        else await prisma.exercise.update({ where: { id }, data: { [field]: url } });
      };
      if (needsOwnPicture(exercise.image)) {
        // Another plan of this batch may already have made this exercise's picture.
        const image =
          (live && alreadyMade[id]?.image) ||
          (await attempt(`image: ${exercise.name}`, () =>
            pictureFor(
              source,
              {
                prompt: `Realistic photo of a person doing the exercise "${exercise.name}" with correct form, plain gym background. No text.`,
                stockQuery: `${exercise.name} exercise`,
              },
              signal
            )
          ));
        if (image) await keep('image', image);
      }
      // Videos only from stock: generated exercise videos often show wrong technique.
      if ((source === 'stock' || source === 'stock_or_ai') && needsOwnPicture(exercise.videoUrl)) {
        const video =
          (live && alreadyMade[id]?.videoUrl) ||
          (await attempt(`video: ${exercise.name}`, () =>
            stockVideo(`${exercise.name} exercise`, signal)
          ));
        if (video) await keep('videoUrl', video);
      }
    }
    const held = Object.keys(pending).length;
    if (held) {
      state.pendingMedia = pending;
      notes.push(
        `${plural(held, 'exercise')} already in the app ${held === 1 ? 'gets' : 'get'} a new picture when you publish this plan (shown in the preview). Nothing changes in the app before that.`
      );
    }
    return notes;
  }

  // One picture per distinct meal name in the plan.
  const meals = await prisma.dietPlanMeal.findMany({
    where: { day: { dietId: state.planId } },
    select: { id: true, name: true, recipe: true },
  });
  const byName = new Map<string, string[]>();
  const madeWith = new Map<string, string>();
  for (const meal of meals) {
    byName.set(meal.name, [...(byName.get(meal.name) ?? []), meal.id]);
    // The recipe starts with "- ingredient: 120 g" lines; the main ones tell the picture what is on the plate.
    const items = [...(meal.recipe ?? '').matchAll(/^- (.+?): \d+ g$/gm)].map(m => m[1]);
    if (items.length && !madeWith.has(meal.name))
      madeWith.set(meal.name, items.slice(0, 5).join(', '));
  }
  const cuisine = cuisineName((state.spec as { cuisine?: string }).cuisine);
  // Same meal name in the original plan: same dish, same picture.
  const basePictures = new Map<string, string>();
  if (basePlanId) {
    const baseMeals = await prisma.dietPlanMeal.findMany({
      where: { day: { dietId: basePlanId } },
      select: { name: true, image: true },
    });
    for (const meal of baseMeals)
      if (meal.name && meal.image) basePictures.set(meal.name.trim().toLowerCase(), meal.image);
  }
  for (const [name, ids] of byName) {
    if (outOfTime()) break;
    const kept = await reuse(`meal: ${name}`, basePictures.get(name.trim().toLowerCase()));
    if (kept) {
      await prisma.dietPlanMeal.updateMany({ where: { id: { in: ids } }, data: { image: kept } });
      continue;
    }
    if (overBudget()) {
      notes.push('Cost cap reached; some meals got no picture.');
      break;
    }
    const image = await attempt(`meal: ${name}`, () =>
      pictureFor(
        source,
        {
          prompt: `Realistic overhead food photo of the ${cuisine} home-cooked dish "${name}"${madeWith.get(name) ? ` (made with ${madeWith.get(name)})` : ''}, served the way it is eaten in a ${cuisine} home, in local tableware, natural light. Only this dish and its usual sides. No text.`,
          stockQuery: `${cuisine} ${name}`,
        },
        signal
      )
    );
    if (image)
      await prisma.dietPlanMeal.updateMany({ where: { id: { in: ids } }, data: { image } });
  }
  return notes;
};

const runTool = (
  state: AgentState,
  kind: string,
  name: string,
  args: unknown
): Promise<ToolResult> =>
  kind === 'exercise' ? runExerciseTool(state, name, args) : runDietTool(state, name, args);

export const runPlanJob: JobHandler = async (ctx: JobContext): Promise<JobOutcome> => {
  const kind = ctx.batch.kind;
  const state: AgentState = {
    ctx,
    batchId: ctx.batch.id,
    spec: revisedSpec((ctx.job.spec ?? {}) as Record<string, unknown>),
    costUsd: 0,
    log: [],
    planId: null,
    lastCheck: null,
    lastPlan: null,
    createdExerciseIds: [],
  };
  const settings = aiSettings();
  const budget = await batchBudget(ctx.batch.id);
  const overBudget = () => budget.cap != null && budget.spentBefore + state.costUsd >= budget.cap;
  const fail = (message: string, retryable = false) =>
    new JobError(message, retryable, state.costUsd, state.log);
  /** The job row always knows the draft this try saved, so a failed or cut-off try can remove it. */
  let recordedPlanId: string | null = null;
  const rememberDraft = async () => {
    if (!state.planId || state.planId === recordedPlanId) return;
    await prisma.aiGenerationJob.update({
      where: { id: ctx.job.id },
      data: { resultPlanId: state.planId },
    });
    recordedPlanId = state.planId;
  };

  let criticRounds = 0;
  let stoppedByCap = false;
  let reviewUnreadable = false;
  let nudges = 0;
  let rejectionsInRow = 0;
  let gaveUp = false;
  let approved = false;
  let openIssues: string[] = [];
  let suggestions: string[] = [];

  try {
    // A try that was cut off (server restart, timeout) may have left a draft: start clean.
    if (ctx.job.resultPlanId) await dropJobDraft(ctx.job.id);
    // Exercises an earlier, failed try created but no plan uses (only one job runs at a time).
    if (kind === 'exercise') await dropUnusedDraftExercises(ctx.batch.id);
    if (kind === 'exercise') await labelExercises(state, ctx.signal);

    const tools: ToolDefinition[] =
      kind === 'exercise'
        ? exerciseToolDefinitions
        : dietToolDefinitions((await loadMealTypes(state)).map(t => t.name));
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(kind) },
      { role: 'user', content: await specText(state, kind) },
    ];
    // "Apply ideas": start from the plan the ideas were for, not from scratch.
    const revision = revisionOf((ctx.job.spec ?? {}) as Record<string, unknown>);
    if (revision) {
      const current = revision.fromPlanId
        ? await (kind === 'exercise' ? loadExerciseDraft : loadDietDraft)(revision.fromPlanId)
        : null;
      messages.push({ role: 'user', content: revisionText(revision, current) });
    }

    for (let step = 0; step < MAX_STEPS && !approved; step++) {
      if (ctx.signal.aborted) throw fail('Stopped: the job ran too long.', true);
      if (overBudget()) {
        record(state, {
          type: 'note',
          summary: 'Stopped: the spending limit for this batch was reached.',
        });
        stoppedByCap = true;
        break;
      }

      compactDrafts(messages);
      const response = await chat({ model: settings.agentModel, messages, tools }, ctx.signal);
      state.costUsd += response.costUsd;
      messages.push(response.message);
      record(state, {
        type: 'model',
        summary: response.message.tool_calls?.length
          ? `calls ${response.message.tool_calls.map(c => c.function.name).join(', ')}`
          : clip(response.message.content ?? ''),
        costUsd: response.costUsd,
      });

      if (response.message.tool_calls?.length) {
        for (const call of response.message.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(call.function.arguments || '{}');
          } catch {
            args = null;
          }
          const outcome: ToolResult =
            args === null
              ? { result: { error: 'Arguments were not valid JSON.' }, summary: 'bad JSON' }
              : await runTool(state, kind, call.function.name, args);
          const rawErrors = (outcome.result as { errors?: unknown })?.errors;
          const errors = Array.isArray(rawErrors) ? rawErrors.map(String) : [];
          record(state, {
            type: 'tool',
            name: call.function.name,
            summary: clip(friendlyStep(call.function.name, outcome.summary, errors), 700),
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(outcome.result),
          });
          if (SAVE_TOOLS.has(call.function.name))
            rejectionsInRow = outcome.summary.startsWith('saved') ? 0 : rejectionsInRow + 1;
          await rememberDraft();
        }
        if (rejectionsInRow >= MAX_REJECTIONS_IN_ROW) {
          gaveUp = true;
          record(state, {
            type: 'note',
            summary: `Stopped: the AI's plan failed the checks ${rejectionsInRow} times in a row.`,
          });
          break;
        }
        continue;
      }

      // The model stopped calling tools: it needs a valid saved plan before review.
      if (!state.planId || state.lastCheck?.errors.length) {
        if (++nudges > MAX_NUDGES) break;
        messages.push({
          role: 'user',
          content:
            'No valid plan is saved yet. Call the save tool with the complete plan and fix any errors it returns.',
        });
        continue;
      }

      const verdict = await review(state, kind, ctx.signal, openIssues);
      if ('unreadable' in verdict) {
        reviewUnreadable = true;
        break;
      }
      suggestions = verdict.suggestions;
      if (verdict.approved) {
        approved = true;
        openIssues = [];
        break;
      }
      openIssues = verdict.issues;
      if (++criticRounds > criticRoundsFor(kind)) break;
      messages.push({
        role: 'user',
        content: `A reviewer found these problems. Fix every one (replace any exercise or meal that breaks the admin's notes; don't just add to the plan) and save the full plan again:\n- ${verdict.issues.join('\n- ')}`,
      });
    }

    if (!state.planId) {
      const lastErrors = state.lastCheck?.errors.slice(0, 5) ?? [];
      const reason = gaveUp
        ? `No plan was made: the AI tried ${MAX_REJECTIONS_IN_ROW} times in a row but each version failed the checks.`
        : "No plan was made: the AI didn't finish a version that passes the checks.";
      // Retrying a plan that kept breaking the rules usually just spends the same money again.
      throw fail(
        lastErrors.length ? `${reason}\n\nWhat was still wrong:\n${bullets(lastErrors)}` : reason,
        !gaveUp
      );
    }

    // The plan is written and reviewed. Pictures get their own time limit from here: a slow
    // picture step may leave pictures missing, but must never fail the job and redo the text.
    ctx.stopClock?.();
    await prisma.aiGenerationJob.updateMany({
      where: { id: ctx.job.id },
      data: { lockedAt: new Date() },
    });
    const source = (ctx.batch.mediaSource as MediaSource) ?? 'admin_upload';
    const mediaNotes = overBudget()
      ? ['Cost cap reached; no pictures added.']
      : await addMedia(
          state,
          kind,
          source,
          AbortSignal.timeout(LIMITS.mediaTimeoutMs),
          overBudget
        ).catch(error => [
          `Pictures stopped early: ${error instanceof Error ? clip(error.message, 160) : 'error'}`,
        ]);
    const reviewData: ReviewData = {
      ...(state.pendingMedia ? { pendingMedia: state.pendingMedia } : {}),
      ...(state.nutritionSources?.length ? { nutritionSources: state.nutritionSources } : {}),
      ...(suggestions.length ? { suggestions } : {}),
    };
    await prisma.aiGenerationJob.update({
      where: { id: ctx.job.id },
      data: { reviewData: reviewData as Prisma.InputJsonValue },
    });

    const warnings = state.lastCheck?.warnings ?? [];
    const lastSaveFailed = !!state.lastCheck?.errors.length;
    const needsAttention = !approved || lastSaveFailed || stoppedByCap || reviewUnreadable;
    // Plain language with headings and bullets: the batch page is read by non-technical admins.
    const message = [
      ...(stoppedByCap
        ? [
            'The spending limit for this batch was reached before the coach review, so nobody has checked this plan yet. Read it carefully before publishing, or press Retry and raise the limit.',
          ]
        : []),
      ...(reviewUnreadable
        ? [
            "The coach review's answer couldn't be read (twice), so nobody has checked this plan yet. Read it carefully before publishing, or press Retry.",
          ]
        : []),
      ...(openIssues.length
        ? [`Please fix before publishing (from the coach review):\n${bullets(openIssues)}`]
        : []),
      ...(lastSaveFailed
        ? [
            "Note: the AI's last round of changes didn't pass the checks, so this is the earlier version, from before those changes.",
          ]
        : []),
      ...(warnings.length ? [`Worth a quick look:\n${bullets(warnings)}`] : []),
      ...(suggestions.length
        ? [`Optional ideas from the coach review:\n${bullets(suggestions)}`]
        : []),
      ...(mediaNotes.length ? [`Pictures:\n${bullets(mediaNotes)}`] : []),
    ].join('\n\n');

    return {
      status: needsAttention ? JOB_STATUS.needsAttention : JOB_STATUS.succeeded,
      resultPlanId: state.planId,
      costUsd: state.costUsd,
      log: state.log,
      message: message || undefined,
    };
  } catch (error) {
    // A failed try leaves no plan: its half-made draft is removed, so nothing unreviewed or
    // hidden from the batch page can be published later.
    if (state.planId)
      await dropJobDraft(ctx.job.id, state.planId).catch(cleanup =>
        console.error(`Could not remove the draft of failed job ${ctx.job.id}:`, cleanup)
      );
    if (kind === 'exercise')
      await dropUnusedDraftExercises(ctx.batch.id).catch(cleanup =>
        console.error(`Could not remove unused exercises of job ${ctx.job.id}:`, cleanup)
      );
    if (error instanceof JobError)
      throw new JobError(error.message, error.retryable, state.costUsd, state.log);
    throw fail(error instanceof Error ? error.message : 'Unknown error');
  }
};
