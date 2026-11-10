/**
 * Lifeline API — Prisma Mock Data Seeder
 *
 * Writes directly to the database via Prisma.
 * No HTTP server required — bypasses all auth/CORS/rate-limit middleware.
 *
 * Run:
 *   npm run seed:mock
 */

import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';

function log(section: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${section}`);
  console.log('─'.repeat(60));
}

/** Convert "HH:MM" string to a Date (for @db.Time fields) */
function timeOf(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

// ─── 1. Roles ─────────────────────────────────────────────────────────────────

async function seedRoles() {
  log('1 / Roles');
  const defs = [
    { name: 'admin',   description: 'Administrator with full access' },
    { name: 'user',    description: 'Regular user' },
    { name: 'premium', description: 'Premium subscriber' },
  ];

  const created = [];
  for (const r of defs) {
    let role = await prisma.role.findFirst({ where: { name: r.name } });
    if (!role) role = await prisma.role.create({ data: r });
    created.push(role);
    console.log(`  role "${role.name}" → ${role.id}`);
  }
  return created;
}

// ─── 2. Users ─────────────────────────────────────────────────────────────────

async function seedUsers(adminRoleId: string, userRoleId: string) {
  log('2 / Users');
  const adminPw = await bcrypt.hash('Admin@12345', 10);
  const userPw  = await bcrypt.hash('User@12345', 10);

  const defs = [
    { email: 'admin@lifeline.dev',    username: 'admin_lifeline', password: adminPw, roleId: adminRoleId, isEmailVerified: true, status: 'active' },
    { email: 'john.doe@example.com',  username: 'john_doe',       password: userPw,  roleId: userRoleId,  isEmailVerified: true, status: 'active' },
    { email: 'jane.smith@example.com',username: 'jane_smith',      password: userPw,  roleId: userRoleId,  isEmailVerified: true, status: 'active' },
    { email: 'alex.j@example.com',    username: 'alex_johnson',   password: userPw,  roleId: userRoleId,  isEmailVerified: true, status: 'active' },
    { email: 'user@lifeline.dev',     username: 'test_user',      password: userPw,  roleId: userRoleId,  isEmailVerified: true, status: 'active' },
    { email: 'sarmad.razaq4@gmail.com', username: 'sarmad_razaq4', password: userPw, roleId: userRoleId, isEmailVerified: true, status: 'active' },
  ];

  const users = [];
  for (const u of defs) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) user = await prisma.user.create({ data: u });
    users.push(user);
    console.log(`  user "${user.email}" → ${user.id}`);
  }
  return users;
}

// ─── 3. App Settings ──────────────────────────────────────────────────────────

async function seedAppSettings() {
  log('3 / App Settings');
  const settings = [
    { key: 'app_version',            value: '1.0.0',  scope: 'global' },
    { key: 'maintenance_mode',       value: 'false',  scope: 'global' },
    { key: 'max_upload_size_mb',     value: '10',     scope: 'global' },
    { key: 'daily_water_goal_ml',    value: '2500',   scope: 'user'   },
    { key: 'daily_step_goal',        value: '10000',  scope: 'user'   },
    { key: 'subscription_trial_days',value: '7',      scope: 'global' },
  ];

  for (const s of settings) {
    const existing = await prisma.appSetting.findFirst({ where: { key: s.key } });
    if (existing) { console.log(`  setting "${s.key}" → already exists`); continue; }
    const created = await prisma.appSetting.create({ data: s });
    console.log(`  setting "${created.key}" → ${created.id}`);
  }
}

// ─── 4. Meal Types ────────────────────────────────────────────────────────────

async function seedMealTypes(): Promise<Record<string, string>> {
  log('4 / Meal Types');
  const names = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'];
  const map: Record<string, string> = {};

  for (const name of names) {
    let mt = await prisma.mealType.findFirst({ where: { name } });
    if (!mt) mt = await prisma.mealType.create({ data: { name } });
    map[name] = mt.id;
    console.log(`  meal type "${name}" → ${mt.id}`);
  }
  return map;
}

// ─── 5. Exercises ─────────────────────────────────────────────────────────────

async function seedExercises() {
  log('5 / Exercises');
  const defs = [
    { name: 'Push-Ups',         purpose: 'strength', difficulty: 'beginner',     caloriesBurnEstimate: 240, duration: '30 min', videoUrl: 'https://example.com/pushups.mp4',          image: 'https://example.com/pushups.jpg',          description: 'Classic upper body exercise targeting chest, shoulders, and triceps' },
    { name: 'Squats',           purpose: 'strength', difficulty: 'beginner',     caloriesBurnEstimate: 270, duration: '30 min', videoUrl: 'https://example.com/squats.mp4',           image: 'https://example.com/squats.jpg',           description: 'Fundamental lower body compound exercise' },
    { name: 'Deadlift',         purpose: 'strength', difficulty: 'intermediate', caloriesBurnEstimate: 300, duration: '45 min', videoUrl: 'https://example.com/deadlift.mp4',         image: 'https://example.com/deadlift.jpg',         description: 'Compound lift for full body strength and posterior chain' },
    { name: 'Bench Press',      purpose: 'strength', difficulty: 'intermediate', caloriesBurnEstimate: 210, duration: '40 min', videoUrl: 'https://example.com/benchpress.mp4',       image: 'https://example.com/benchpress.jpg',       description: 'Upper body horizontal pressing movement' },
    { name: 'Running',          purpose: 'cardio',   difficulty: 'beginner',     caloriesBurnEstimate: 360, duration: '30 min', videoUrl: 'https://example.com/running.mp4',          image: 'https://example.com/running.jpg',          description: 'Steady-state cardiovascular endurance exercise' },
    { name: 'Plank',            purpose: 'core',     difficulty: 'beginner',     caloriesBurnEstimate: 150, duration: '10 min', videoUrl: 'https://example.com/plank.mp4',            image: 'https://example.com/plank.jpg',            description: 'Core stability isometric hold exercise' },
    { name: 'Pull-Ups',         purpose: 'strength', difficulty: 'intermediate', caloriesBurnEstimate: 300, duration: '30 min', videoUrl: 'https://example.com/pullups.mp4',          image: 'https://example.com/pullups.jpg',          description: 'Upper body vertical pulling movement' },
    { name: 'Burpees',          purpose: 'cardio',   difficulty: 'intermediate', caloriesBurnEstimate: 450, duration: '20 min', videoUrl: 'https://example.com/burpees.mp4',          image: 'https://example.com/burpees.jpg',          description: 'Full body high-intensity exercise' },
    { name: 'Lunges',           purpose: 'strength', difficulty: 'beginner',     caloriesBurnEstimate: 240, duration: '30 min', videoUrl: 'https://example.com/lunges.mp4',           image: 'https://example.com/lunges.jpg',           description: 'Single-leg strength and balance exercise' },
    { name: 'Mountain Climbers',purpose: 'cardio',   difficulty: 'intermediate', caloriesBurnEstimate: 420, duration: '20 min', videoUrl: 'https://example.com/mountainclimbers.mp4', image: 'https://example.com/mountainclimbers.jpg', description: 'Core and cardio combination drill' },
    { name: 'Jump Rope',        purpose: 'cardio',   difficulty: 'beginner',     caloriesBurnEstimate: 380, duration: '20 min', videoUrl: 'https://example.com/jumprope.mp4',         image: 'https://example.com/jumprope.jpg',         description: 'Rhythmic cardio drill that improves coordination and endurance' },
    { name: 'Romanian Deadlift', purpose: 'strength', difficulty: 'intermediate', caloriesBurnEstimate: 290, duration: '35 min', videoUrl: 'https://example.com/romaniandeadlift.mp4', image: 'https://example.com/romaniandeadlift.jpg', description: 'Posterior chain strength exercise focused on hamstrings and glutes' },
    { name: 'Overhead Press',   purpose: 'strength', difficulty: 'intermediate', caloriesBurnEstimate: 220, duration: '30 min', videoUrl: 'https://example.com/overheadpress.mp4',    image: 'https://example.com/overheadpress.jpg',    description: 'Vertical pressing movement for shoulders and upper body strength' },
    { name: 'Bicycle Crunches', purpose: 'core',     difficulty: 'beginner',     caloriesBurnEstimate: 180, duration: '15 min', videoUrl: 'https://example.com/bicyclecrunches.mp4',   image: 'https://example.com/bicyclecrunches.jpg',   description: 'Dynamic core movement targeting obliques and abdominal endurance' },
    { name: 'Rowing Machine',   purpose: 'cardio',   difficulty: 'beginner',     caloriesBurnEstimate: 400, duration: '25 min', videoUrl: 'https://example.com/rowingmachine.mp4',    image: 'https://example.com/rowingmachine.jpg',    description: 'Low-impact full-body cardio workout for endurance and calorie burn' },
  ];

  const created = [];
  for (const e of defs) {
    let ex = await prisma.exercise.findFirst({ where: { name: e.name } });
    if (!ex) ex = await prisma.exercise.create({ data: e });
    created.push(ex);
    console.log(`  exercise "${ex.name}" → ${ex.id}`);
  }
  return created;
}

// ─── 6. Exercise Details ──────────────────────────────────────────────────────

async function seedExerciseDetails(exerciseIds: string[]) {
  log('6 / Exercise Details');
  const defs = [
    { sets: 3, reps: '15',   calories: 50,  timeRequired: '15 min', instructions: 'Keep elbows at 45°. Lower chest to floor, push through palms.' },
    { sets: 4, reps: '20',   calories: 60,  timeRequired: '20 min', instructions: 'Keep knees behind toes. Drive through heels on ascent.' },
    { sets: 3, reps: '8',    calories: 80,  timeRequired: '25 min', instructions: 'Neutral spine throughout. Hinge at hips, not lower back.' },
    { sets: 4, reps: '10',   calories: 60,  timeRequired: '30 min', instructions: 'Full range of motion. Control the eccentric phase.' },
    { sets: 1, reps: null,   calories: 300, timeRequired: '30 min', instructions: 'Maintain steady aerobic pace. Land mid-foot.' },
    { sets: 3, reps: null,   calories: 40,  timeRequired: '10 min', instructions: 'Engage core and glutes. Straight line from head to heel.' },
    { sets: 3, reps: '10',   calories: 70,  timeRequired: '20 min', instructions: 'Dead hang at bottom. Pull elbows down and back.' },
    { sets: 4, reps: '15',   calories: 120, timeRequired: '20 min', instructions: 'Explosive jump, land softly. Chest to floor each rep.' },
    { sets: 3, reps: '12',   calories: 55,  timeRequired: '20 min', instructions: 'Alternate legs. Keep torso upright, front knee over ankle.' },
    { sets: 3, reps: null,   calories: 90,  timeRequired: '15 min', instructions: 'Drive alternating knees to chest at maximum speed.' },
    { sets: 5, reps: '2 min', calories: 110, timeRequired: '20 min', instructions: 'Keep wrists relaxed and jump lightly on the balls of your feet.' },
    { sets: 4, reps: '10',   calories: 85,  timeRequired: '25 min', instructions: 'Hinge at the hips with a neutral spine and controlled descent.' },
    { sets: 4, reps: '12',   calories: 75,  timeRequired: '20 min', instructions: 'Press straight overhead without arching the lower back.' },
    { sets: 3, reps: '20',   calories: 65,  timeRequired: '15 min', instructions: 'Keep lower back pressed into the floor and rotate slowly.' },
    { sets: 1, reps: null,   calories: 140, timeRequired: '25 min', instructions: 'Drive through legs, hinge at hips, and keep a smooth rowing rhythm.' },
  ];

  for (let i = 0; i < Math.min(exerciseIds.length, defs.length); i++) {
    const existing = await prisma.exerciseDetail.findFirst({ where: { exerciseId: exerciseIds[i] } });
    if (existing) { console.log(`  detail for exercise[${i}] → already exists`); continue; }
    const d = await prisma.exerciseDetail.create({ data: { exerciseId: exerciseIds[i], ...defs[i] } });
    console.log(`  detail for exercise[${i}] → ${d.id}`);
  }
}

// ─── 7. Exercise Plans ────────────────────────────────────────────────────────

async function seedExercisePlans() {
  log('7 / Exercise Plans');
  const defs = [
    { name: 'Beginner Strength Builder',   level: 'beginner',     durationWeeks: 8,  description: '8-week foundational strength program',       image: 'https://example.com/beginner-strength.jpg' },
    { name: 'Advanced Cardio Blast',        level: 'advanced',     durationWeeks: 6,  description: '6-week HIIT and endurance cardio program',   image: 'https://example.com/advanced-cardio.jpg'   },
    { name: 'Full Body Transformation',     level: 'intermediate', durationWeeks: 12, description: '12-week complete body transformation',       image: 'https://example.com/transformation.jpg'    },
    { name: 'Mobility & Recovery Flow',     level: 'beginner',     durationWeeks: 4,  description: '4-week mobility and recovery focused plan',  image: 'https://example.com/mobility-flow.jpg'      },
    { name: 'Fat Loss Accelerator',         level: 'intermediate', durationWeeks: 10, description: '10-week hybrid fat loss and conditioning plan', image: 'https://example.com/fat-loss.jpg'          },
    { name: 'Lean Muscle Builder',          level: 'intermediate', durationWeeks: 10, description: '10-week progressive lean muscle building plan', image: 'https://example.com/lean-muscle.jpg'       },
  ];

  const created = [];
  for (const p of defs) {
    let plan = await prisma.exercisePlan.findFirst({ where: { name: p.name } });
    if (!plan) plan = await prisma.exercisePlan.create({ data: p });
    created.push(plan);
    console.log(`  exercise plan "${plan.name}" → ${plan.id}`);
  }
  return created;
}

// ─── 8. Exercise Plan Weeks ───────────────────────────────────────────────────

async function seedExercisePlanWeeks(planIds: string[]) {
  log('8 / Exercise Plan Weeks');
  const created = [];

  for (const planId of planIds.slice(0, 3)) {
    for (let w = 1; w <= 4; w++) {
      let week = await prisma.exercisePlanWeek.findFirst({ where: { planId, weekNumber: w } });
      if (!week) week = await prisma.exercisePlanWeek.create({ data: { planId, weekNumber: w } });
      created.push(week);
      console.log(`  week ${w} for plan ${planId} → ${week.id}`);
    }
  }
  return created;
}

// ─── 9. Exercise Plan Schedules ───────────────────────────────────────────────

async function seedExercisePlanSchedules(weekIds: string[], exerciseIds: string[]) {
  log('9 / Exercise Plan Schedules');
  const days = ['Monday', 'Wednesday', 'Friday'];
  const setsPerWeek = [3, 3, 4, 4];
  const repsPerWeek = ['12', '10', '10', '8'];
  const durPerWeek = [30, 30, 45, 45];

  for (let w = 0; w < weekIds.length; w++) {
    const weekId = weekIds[w];
    // Rotate exercises so each week starts with a different one
    for (let d = 0; d < days.length; d++) {
      const existing = await prisma.exercisePlanSchedule.findFirst({ where: { weekId, dayOfWeek: days[d] } });
      if (existing) { console.log(`  schedule ${days[d]} for week ${weekId} → already exists`); continue; }
      const exIdx = (d + w) % exerciseIds.length;
      const s = await prisma.exercisePlanSchedule.create({
        data: { weekId, exerciseId: exerciseIds[exIdx], dayOfWeek: days[d], sets: setsPerWeek[w], reps: repsPerWeek[w], duration: `${durPerWeek[w]}`, orderIndex: d + 1, completed: false },
      });
      console.log(`  schedule ${days[d]} for week ${weekId} → ${s.id}`);
    }
  }
}

// ─── 10. Diet Plans ───────────────────────────────────────────────────────────

async function seedDietPlans() {
  log('10 / Diet Plans');
  const defs = [
    { name: 'Weight Loss Plan - Traditional Cuisine (Overweight)', calories: 1500, duration: '30 days', description: 'Caloric deficit diet for sustainable weight loss - Traditional cuisine for overweight BMI category',   image: 'https://example.com/weightloss-traditional.jpg',    cuisineName: 'traditional' },
    { name: 'Weight Loss Plan - Keto (Overweight)',            calories: 1600, duration: '30 days', description: 'Low-carb ketogenic approach for weight loss in overweight category',                               image: 'https://example.com/weightloss-keto.jpg',          cuisineName: 'keto' },
    { name: 'Weight Loss Plan - Mediterranean (Overweight)',   calories: 1700, duration: '30 days', description: 'Mediterranean diet for sustainable weight loss in overweight BMI range',                         image: 'https://example.com/weightloss-mediterranean.jpg', cuisineName: 'mediterranean' },
    { name: 'Weight Loss Plan - Balanced (Normal Weight)',    calories: 1800, duration: '30 days', description: 'Balanced weight loss plan for normal weight BMI category',                                     image: 'https://example.com/weightloss-balanced.jpg',      cuisineName: 'balanced' },
    { name: 'Muscle Gain Plan - High Protein',                calories: 2800, duration: '60 days', description: 'High-protein diet for muscle hypertrophy and muscle gain',                                      image: 'https://example.com/muscle-diet.jpg',              cuisineName: 'high_protein' },
    { name: 'Maintenance Plan - Balanced Nutrition',           calories: 2000, duration: '30 days', description: 'Whole-foods balanced nutrition for maintenance of healthy weight',                             image: 'https://example.com/maintenance-diet.jpg',         cuisineName: 'balanced' },
    { name: 'Weight Loss Plan - Intermittent Fasting',         calories: 1500, duration: '45 days', description: 'Intermittent fasting approach for sustainable weight loss',                                      image: 'https://example.com/weightloss-if.jpg',            cuisineName: 'intermittent_fasting' },
    { name: 'Muscle Gain Plan - Balanced',                     calories: 3000, duration: '60 days', description: 'Balanced muscle gain diet with adequate macro nutrients',                                      image: 'https://example.com/muscle-balanced.jpg',          cuisineName: 'balanced' },
    { name: 'Weight Loss Plan - High Protein (Normal Weight)', calories: 1750, duration: '30 days', description: 'High-protein fat loss plan for normal weight BMI category',                                      image: 'https://example.com/weightloss-high-protein.jpg',  cuisineName: 'high_protein' },
    { name: 'Maintenance Plan - Mediterranean',               calories: 2100, duration: '30 days', description: 'Mediterranean maintenance plan with balanced macros',                                        image: 'https://example.com/maintenance-mediterranean.jpg', cuisineName: 'mediterranean' },
    { name: 'Muscle Gain Plan - Traditional',                 calories: 3100, duration: '60 days', description: 'Traditional cuisine muscle gain plan with calorie surplus',                                  image: 'https://example.com/muscle-traditional.jpg',        cuisineName: 'traditional' },
    { name: 'Weight Loss Plan - Balanced (Overweight)',       calories: 1550, duration: '30 days', description: 'Balanced calorie deficit plan for overweight BMI category',                                  image: 'https://example.com/weightloss-balanced-overweight.jpg', cuisineName: 'balanced' },
  ];

  const created = [];
  for (const p of defs) {
    let plan = await prisma.dietPlan.findFirst({ where: { name: p.name } });
    if (!plan) plan = await prisma.dietPlan.create({ data: p });
    created.push(plan);
    console.log(`  diet plan "${plan.name}" → ${plan.id}`);
  }
  return created;
}

// ─── 11. Diet Plan Days ───────────────────────────────────────────────────────

async function seedDietPlanDays(dietPlanIds: string[]) {
  log('11 / Diet Plan Days');
  const created = [];

  for (const dietId of dietPlanIds.slice(0, 4)) {
    for (let d = 1; d <= 7; d++) {
      let day = await prisma.dietPlanDay.findFirst({ where: { dietId, dayNumber: d } });
      if (!day) day = await prisma.dietPlanDay.create({ data: { dietId, dayNumber: d, notes: `Nutrition plan for day ${d}` } });
      created.push(day);
      console.log(`  day ${d} for diet ${dietId} → ${day.id}`);
    }
  }
  return created;
}

// ─── 12. Diet Plan Meals ──────────────────────────────────────────────────────

async function seedDietPlanMeals(dayIds: string[], mealTypeMap: Record<string, string>) {
  log('12 / Diet Plan Meals');
  const meals = [
    { mealTypeKey: 'Breakfast', name: 'Oatmeal with Berries',           calories: 300, portionSize: '1 bowl',    recipe: 'Cook oats in almond milk. Top with mixed berries, honey, and chia seeds.',                                      image: 'https://example.com/oatmeal.jpg'       },
    { mealTypeKey: 'Lunch',     name: 'Grilled Chicken Salad',          calories: 400, portionSize: '1 plate',   recipe: 'Grill chicken breast. Toss with mixed greens, cherry tomatoes, and olive oil dressing.',                         image: 'https://example.com/chicken-salad.jpg' },
    { mealTypeKey: 'Dinner',    name: 'Salmon with Roasted Vegetables', calories: 450, portionSize: '1 serving', recipe: 'Bake salmon at 200°C for 20 min. Roast broccoli, sweet potato, and peppers with olive oil.',                    image: 'https://example.com/salmon.jpg'        },
    { mealTypeKey: 'Snack',     name: 'Greek Yogurt with Nuts',         calories: 150, portionSize: '1 cup',     recipe: 'Combine Greek yogurt with mixed nuts, a drizzle of honey, and a pinch of cinnamon.',                            image: 'https://example.com/yogurt.jpg'        },
    { mealTypeKey: 'Pre-Workout', name: 'Banana & Peanut Butter',       calories: 200, portionSize: '1 snack',   recipe: 'Slice 1 large banana. Serve with 2 tbsp natural peanut butter.',                                               image: 'https://example.com/banana-pb.jpg'     },
    { mealTypeKey: 'Post-Workout', name: 'Protein Smoothie',            calories: 220, portionSize: '1 glass',   recipe: 'Blend protein powder, banana, oats, spinach, and unsweetened almond milk until smooth.',                        image: 'https://example.com/protein-smoothie.jpg' },
    { mealTypeKey: 'Breakfast', name: 'Veggie Omelette',                calories: 280, portionSize: '1 plate',   recipe: 'Whisk eggs with vegetables and cook in a non-stick pan until set.',                                             image: 'https://example.com/veggie-omelette.jpg' },
  ];

  for (const dayId of dayIds) {
    for (const meal of meals) {
      const mealTypeId = mealTypeMap[meal.mealTypeKey];
      if (!mealTypeId) continue;
      const existing = await prisma.dietPlanMeal.findFirst({ where: { dayId, name: meal.name } });
      if (existing) {
        await prisma.dietPlanMeal.update({ where: { id: existing.id }, data: { calories: meal.calories, portionSize: meal.portionSize, recipe: meal.recipe, image: meal.image } });
        console.log(`  meal "${meal.name}" for day ${dayId} → updated`);
        continue;
      }
      const dm = await prisma.dietPlanMeal.create({ data: { dayId, mealTypeId, name: meal.name, calories: meal.calories, portionSize: meal.portionSize, recipe: meal.recipe, image: meal.image } });
      console.log(`  meal "${dm.name}" for day ${dayId} → ${dm.id}`);
    }
  }
}

// ─── 13. Meditations ──────────────────────────────────────────────────────────

async function seedMeditations() {
  log('13 / Meditations');
  const defs = [
    { name: 'Morning Mindfulness',       type: 'mindfulness',   description: 'Start your day with clarity and focused intention',        image: 'https://example.com/morning.jpg',    soundUrl: 'https://example.com/morning-mindfulness.mp3' },
    { name: 'Deep Sleep Relaxation',     type: 'sleep',         description: 'Drift into a peaceful, restful deep sleep',                image: 'https://example.com/sleep.jpg',      soundUrl: 'https://example.com/deep-sleep.mp3'          },
    { name: '4-7-8 Breathing Technique', type: 'breathing',     description: 'Reduce anxiety and stress via controlled breathing',       image: 'https://example.com/breathing.jpg',  soundUrl: 'https://example.com/478-breathing.mp3'       },
    { name: 'Body Scan Meditation',      type: 'body_scan',     description: 'Full body awareness with progressive muscle relaxation',   image: 'https://example.com/bodyscan.jpg',   soundUrl: 'https://example.com/body-scan.mp3'           },
    { name: 'Stress Relief Meditation',  type: 'stress_relief', description: 'Release daily stress and cultivate lasting inner peace',   image: 'https://example.com/stress.jpg',     soundUrl: 'https://example.com/stress-relief.mp3'       },
    { name: 'Evening Gratitude',          type: 'mindfulness',   description: 'Close the day with gratitude and calm reflection',         image: 'https://example.com/evening-gratitude.jpg', soundUrl: 'https://example.com/evening-gratitude.mp3' },
    { name: 'Focus Reset',                type: 'mindfulness',   description: 'Short reset to improve concentration and mental clarity',  image: 'https://example.com/focus-reset.jpg',      soundUrl: 'https://example.com/focus-reset.mp3'        },
    { name: 'Sleepy Breathing',           type: 'sleep',         description: 'Gentle breathing audio to unwind before bed',              image: 'https://example.com/sleepy-breathing.jpg', soundUrl: 'https://example.com/sleepy-breathing.mp3'   },
  ];

  const created = [];
  for (const m of defs) {
    let med = await prisma.meditation.findFirst({ where: { name: m.name } });
    if (!med) med = await prisma.meditation.create({ data: m });
    created.push(med);
    console.log(`  meditation "${med.name}" → ${med.id}`);
  }
  return created;
}

// ─── 14. Meditation Sessions ──────────────────────────────────────────────────

async function seedMeditationSessions(meditationIds: string[]) {
  log('14 / Meditation Sessions');
  const templates = [
    { durationMinutes: 5,  difficulty: 'beginner',     soundUrl: 'https://example.com/s1.mp3', image: 'https://example.com/s1.jpg' },
    { durationMinutes: 10, difficulty: 'beginner',     soundUrl: 'https://example.com/s2.mp3', image: 'https://example.com/s2.jpg' },
    { durationMinutes: 15, difficulty: 'intermediate', soundUrl: 'https://example.com/s3.mp3', image: 'https://example.com/s3.jpg' },
  ];

  const created = [];
  for (const meditationId of meditationIds) {
    for (const tmpl of templates) {
      const s = await prisma.meditationSession.create({ data: { meditationId, ...tmpl } });
      created.push(s);
      console.log(`  session ${tmpl.durationMinutes}min for meditation ${meditationId} → ${s.id}`);
    }
  }
  return created;
}

// ─── 15. Challenges ───────────────────────────────────────────────────────────

async function seedChallenges() {
  log('15 / Challenges');
  const defs = [
    { name: '30-Day Push-Up Challenge',    purpose: 'strength', description: 'Build upper body strength progressively over 30 days',  status: 'active' },
    { name: '7-Day Hydration Challenge',   purpose: 'wellness', description: 'Drink 2.5L of water every day for 7 days',              status: 'active' },
    { name: 'Plank Progression Challenge', purpose: 'core',     description: 'Increase plank hold duration daily over 14 days',       status: 'active' },
    { name: '15-Day Step Count Challenge', purpose: 'wellness', description: 'Hit a daily step target to improve activity levels',      status: 'active' },
    { name: '21-Day Mobility Challenge',   purpose: 'recovery', description: 'Improve flexibility and reduce stiffness over 21 days',  status: 'active' },
    { name: 'Morning Routine Challenge',   purpose: 'habit',    description: 'Build a consistent healthy morning routine',             status: 'active' },
  ];

  const created = [];
  for (const c of defs) {
    let ch = await prisma.challenge.findFirst({ where: { name: c.name } });
    if (!ch) ch = await prisma.challenge.create({ data: c });
    created.push(ch);
    console.log(`  challenge "${ch.name}" → ${ch.id}`);
  }
  return created;
}

// ─── 16. Challenge Exercises ──────────────────────────────────────────────────

async function seedChallengeExercises(challengeIds: string[], exerciseIds: string[]) {
  log('16 / Challenge Exercises');
  const pairs: [string, string][] = [
    [challengeIds[0], exerciseIds[0]], // Push-up challenge → Push-Ups
    [challengeIds[0], exerciseIds[1]], // Push-up challenge → Squats
    [challengeIds[0], exerciseIds[6]], // Push-up challenge → Pull-Ups
    [challengeIds[2], exerciseIds[5]], // Plank challenge   → Plank
  ];

  for (const [challengeId, exerciseId] of pairs) {
    if (!challengeId || !exerciseId) continue;
    const existing = await prisma.challengeExercise.findUnique({
      where: { challengeId_exerciseId: { challengeId, exerciseId } },
    });
    if (existing) { console.log(`  link ${challengeId}↔${exerciseId} → already exists`); continue; }
    await prisma.challengeExercise.create({ data: { challengeId, exerciseId } });
    console.log(`  linked exercise ${exerciseId} → challenge ${challengeId}`);
  }
}

// ─── 17. Blog Categories & Blogs ──────────────────────────────────────────────

async function seedBlogs(adminUserId: string) {
  log('17 / Blog Categories');
  const categories = [
    { name: 'Nutrition',     slug: 'nutrition'     },
    { name: 'Fitness',       slug: 'fitness'       },
    { name: 'Mental Health', slug: 'mental-health' },
    { name: 'Lifestyle',     slug: 'lifestyle'     },
  ];

  const catMap: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.blogCategory.upsert({ where: { slug: c.slug }, update: {}, create: c });
    catMap[c.name] = cat.id;
    console.log(`  category "${cat.name}" → ${cat.id}`);
  }

  log('17 / Blogs');
  const blogs = [
    {
      title: '10 Foods That Boost Your Metabolism', slug: '10-foods-boost-metabolism', status: 'published',
      categoryId: catMap['Nutrition'], authorId: adminUserId,
      coverImage: 'https://example.com/metabolism-foods.jpg',
      excerpt: 'Discover the top 10 metabolism-boosting foods for optimal health and weight management.',
      content: 'Metabolism plays a crucial role in weight management. Top foods that boost metabolic rate include: 1. Green Tea – catechins + caffeine combination. 2. Chili Peppers – capsaicin raises thermogenesis. 3. Protein-rich foods – higher thermic effect of food. 4. Coffee – stimulates thermogenesis. 5. Ginger – reduces inflammation and boosts metabolic rate. 6. Seaweed – iodine supports thyroid function. 7. Apple Cider Vinegar – may improve fat burning. 8. Coconut Oil – MCTs raise energy expenditure. 9. Cold Water – body burns calories to warm it. 10. Cacao – flavonoids improve metabolic markers. Include these consistently for measurable results.',
    },
    {
      title: 'The Complete Beginner Guide to Strength Training', slug: 'beginner-strength-training-guide', status: 'published',
      categoryId: catMap['Fitness'], authorId: adminUserId,
      coverImage: 'https://example.com/strength-guide.jpg',
      excerpt: 'Everything you need to know to start strength training safely and effectively.',
      content: 'Strength training builds muscle, burns fat, and improves overall health. Key principles: Start with compound movements – squat, deadlift, bench press, overhead press, and rows. Progressive overload – add 2.5kg per week to main lifts. Train 3 days per week full-body for beginners. Rest 48 hours between sessions targeting the same muscle group. Track every session in a journal. Nutrition: consume 1.6–2.2g protein per kg bodyweight daily. Sleep 7–9 hours – this is when recovery occurs. Common mistakes: using too much weight too soon, skipping warm-up, and neglecting mobility work.',
    },
    {
      title: '5 Mindfulness Practices for Busy Professionals', slug: '5-mindfulness-busy-professionals', status: 'published',
      categoryId: catMap['Mental Health'], authorId: adminUserId,
      coverImage: 'https://example.com/mindfulness.jpg',
      excerpt: 'Five quick mindfulness techniques that fit into even the busiest schedule.',
      content: '1. Morning Breathing (2 min) – 4-7-8 technique before checking your phone. 2. Mindful Eating (5 min) – one meal per day without screens or distractions. 3. Walking Meditation (10 min) – focus on each footstep and breath. 4. Body Scan (5 min) – progressive relaxation from head to toe before sleep. 5. Gratitude Journaling (3 min) – write 3 specific things you are grateful for. Even micro-doses of mindfulness significantly reduce cortisol levels and improve cognitive performance within as little as 2 weeks of consistent practice.',
    },
    {
      title: 'How to Build a Powerful Morning Routine', slug: 'powerful-morning-routine', status: 'published',
      categoryId: catMap['Lifestyle'], authorId: adminUserId,
      coverImage: 'https://example.com/morning-routine.jpg',
      excerpt: 'Build a morning routine that sets you up for peak health and productivity every day.',
      content: 'A consistent morning routine is the cornerstone of sustainable high performance. The non-negotiables: 1. Wake at the same time every day — including weekends. Circadian consistency improves sleep quality measurably. 2. Hydrate immediately — drink 500ml water before coffee. Overnight dehydration impairs cognition. 3. 10 minutes of movement or stretching — activates metabolism and reduces joint stiffness. 4. Protein-rich breakfast (30g+) — stabilizes blood sugar and supports muscle retention. 5. Review your top 3 daily priorities before opening email. Avoid your phone for the first 30 minutes. Build one habit at a time — habit formation takes an average of 66 days, not 21.',
    },
    {
      title: 'Hydration Mistakes That Sabotage Your Progress', slug: 'hydration-mistakes-progress', status: 'published',
      categoryId: catMap['Nutrition'], authorId: adminUserId,
      coverImage: 'https://example.com/hydration-mistakes.jpg',
      excerpt: 'Small hydration mistakes can make your daily water goals harder to reach than they need to be.',
      content: 'Hydration is more than just hitting a number. Common mistakes include drinking too much at once, waiting until you feel thirsty, and ignoring electrolytes after long workouts. Spread intake across the day, pair water with meals, and track your intake against a consistent goal. If you train heavily or live in a hot climate, your needs may be higher than the default target.',
    },
    {
      title: 'A Practical Guide to Meal Prep for Busy Weeks', slug: 'meal-prep-busy-weeks', status: 'published',
      categoryId: catMap['Fitness'], authorId: adminUserId,
      coverImage: 'https://example.com/meal-prep.jpg',
      excerpt: 'Meal prep can make healthy eating much easier during busy weeks.',
      content: 'Start with one protein, one carb, and two vegetables for each prep session. Batch-cook sauces and use simple seasonings so meals stay interesting. Keep a few flexible snack options ready for low-energy days. Consistency beats complexity when the goal is to stay aligned with a diet plan.',
    },
    {
      title: 'Why Recovery Matters as Much as Training', slug: 'why-recovery-matters', status: 'published',
      categoryId: catMap['Fitness'], authorId: adminUserId,
      coverImage: 'https://example.com/recovery.jpg',
      excerpt: 'Recovery is where adaptation happens, not just in the workout itself.',
      content: 'Training creates the stimulus, but recovery builds the result. Sleep, hydration, nutrition, and mobility work all contribute to better adaptation. If progress stalls, look first at recovery quality before increasing workout volume.',
    },
  ];

  const blogIds: string[] = [];
  for (const b of blogs) {
    let blog = await prisma.blog.findFirst({ where: { slug: b.slug } });
    if (!blog) blog = await prisma.blog.create({ data: b });
    blogIds.push(blog.id);
    console.log(`  blog "${blog.title.slice(0, 40)}…" → ${blog.id}`);
  }

  // Comments
  if (blogIds[0]) {
    const comment = await prisma.blogComment.create({
      data: { blogId: blogIds[0], userId: adminUserId, content: 'This article is a game-changer. Green tea and protein-rich meals have made a real difference for me.' },
    });
    await prisma.blogComment.create({
      data: { blogId: blogIds[0], userId: adminUserId, content: 'Consistency really is key — stick with it for at least 4 weeks!', parentId: comment.id },
    });
    console.log(`  blog comments added → ${comment.id}`);
  }
}

// ─── 18. User Diet Plans ──────────────────────────────────────────────────────

async function seedUserDietPlans(userIds: string[], dietPlanIds: string[]) {
  log('18 / User Diet Plans');
  for (let i = 0; i < Math.min(userIds.length, dietPlanIds.length); i++) {
    if (!userIds[i] || !dietPlanIds[i]) continue;
    const existing = await prisma.userDietPlan.findFirst({ where: { userId: userIds[i], dietId: dietPlanIds[i] } });
    if (existing) { console.log(`  user diet plan for ${userIds[i]} → already exists`); continue; }
    const udp = await prisma.userDietPlan.create({ data: { userId: userIds[i], dietId: dietPlanIds[i], startedAt: new Date('2026-03-01') } });
    console.log(`  user diet plan → ${udp.id}`);
  }
}

// ─── 19. User Exercises ───────────────────────────────────────────────────────

async function seedUserExercises(userIds: string[], exerciseIds: string[]) {
  log('19 / User Exercises');
  for (let u = 0; u < Math.min(userIds.length, 3); u++) {
    for (let e = 0; e < 3; e++) {
      if (!userIds[u] || !exerciseIds[e]) continue;
      const existing = await prisma.userExercise.findFirst({ where: { userId: userIds[u], exerciseId: exerciseIds[e] } });
      if (existing) continue;
      const ue = await prisma.userExercise.create({ data: { userId: userIds[u], exerciseId: exerciseIds[e], addedAt: new Date(), favorite: e === 0 } });
      console.log(`  user exercise → ${ue.id}`);
    }
  }
}

// ─── 20. Active Diet Plans ────────────────────────────────────────────────────

async function seedActiveDietPlans(userIds: string[], dietPlanIds: string[]) {
  log('20 / Active Diet Plans');
  const created = [];
  for (let i = 0; i < Math.min(userIds.length, dietPlanIds.length, 3); i++) {
    if (!userIds[i] || !dietPlanIds[i]) continue;
    let adp = await prisma.userActiveDietPlan.findFirst({ where: { userId: userIds[i], endedAt: null } });
    if (!adp) adp = await prisma.userActiveDietPlan.create({ data: { userId: userIds[i], dietId: dietPlanIds[i], currentDay: 1, startedAt: new Date('2026-03-01') } });
    created.push(adp);
    console.log(`  active diet plan for ${userIds[i]} → ${adp.id}`);
  }
  return created;
}

// ─── 21. Active Exercise Plans ────────────────────────────────────────────────

async function seedActiveExercisePlans(userIds: string[], planIds: string[]) {
  log('21 / Active Exercise Plans');
  for (let i = 0; i < Math.min(userIds.length, planIds.length, 3); i++) {
    if (!userIds[i] || !planIds[i]) continue;
    let aep = await prisma.userActiveExercisePlan.findFirst({ where: { userId: userIds[i] } });
    if (!aep) aep = await prisma.userActiveExercisePlan.create({ data: { userId: userIds[i], planId: planIds[i], currentWeek: 1, startedAt: new Date('2026-03-01') } });
    console.log(`  active exercise plan for ${userIds[i]} → ${aep.id}`);
  }
}

// ─── 22. Favorite Meditations ─────────────────────────────────────────────────

async function seedFavoriteMeditations(userIds: string[], sessionIds: string[]) {
  log('22 / Favorite Meditations');
  for (let i = 0; i < Math.min(userIds.length, sessionIds.length); i++) {
    if (!userIds[i] || !sessionIds[i]) continue;
    const existing = await prisma.userFavoriteMeditation.findFirst({ where: { userId: userIds[i], sessionId: sessionIds[i] } });
    if (existing) { console.log(`  favorite meditation for ${userIds[i]} → already exists`); continue; }
    const fav = await prisma.userFavoriteMeditation.create({ data: { userId: userIds[i], sessionId: sessionIds[i], favoritedAt: new Date() } });
    console.log(`  favorite meditation → ${fav.id}`);
  }
}

// ─── 23. Water Goals ──────────────────────────────────────────────────────────

async function seedWaterGoals(userIds: string[]) {
  log('23 / Water Goals');
  const goals = [2500, 3000, 2000, 2800, 2200];
  for (let i = 0; i < Math.min(userIds.length, goals.length); i++) {
    if (!userIds[i]) continue;
    let wg = await prisma.userWaterGoal.findFirst({ where: { userId: userIds[i] } });
    if (!wg) wg = await prisma.userWaterGoal.create({ data: { userId: userIds[i], goalAmount: goals[i], unit: 'ml', updatedAt: new Date() } });
    console.log(`  water goal ${goals[i]}ml for ${userIds[i]} → ${wg.id}`);
  }
}

// ─── 24. Water Intake Logs ────────────────────────────────────────────────────

async function seedWaterIntakeLogs(userId: string) {
  log('24 / Water Intake Logs');
  const entries = [
    { amount: 500, drinkType: 'water',      timeStart: '07:00', timeEnd: '07:30', notes: 'Morning glass on wake-up'    },
    { amount: 300, drinkType: 'water',      timeStart: '10:00', timeEnd: '10:10', notes: 'Mid-morning hydration'       },
    { amount: 600, drinkType: 'water',      timeStart: '12:30', timeEnd: '13:00', notes: 'With lunch'                  },
    { amount: 400, drinkType: 'herbal_tea', timeStart: '15:00', timeEnd: '15:10', notes: 'Afternoon herbal tea'        },
    { amount: 700, drinkType: 'water',      timeStart: '18:00', timeEnd: '19:00', notes: 'Post-workout rehydration'    },
    { amount: 300, drinkType: 'water',      timeStart: '21:00', timeEnd: '21:10', notes: 'Evening glass before sleep'  },
    { amount: 450, drinkType: 'water',      timeStart: '08:30', timeEnd: '08:40', notes: 'Between breakfast and work'   },
    { amount: 350, drinkType: 'electrolyte', timeStart: '14:15', timeEnd: '14:25', notes: 'Hydration after walking'      },
  ];

  const date = new Date('2026-03-01');
  const created = [];
  for (const e of entries) {
    const wl = await prisma.waterIntakeLog.create({
      data: { userId, date, timeStart: timeOf(e.timeStart), timeEnd: timeOf(e.timeEnd), amount: e.amount, unit: 'ml', drinkType: e.drinkType, notes: e.notes, loggedAt: new Date() },
    });
    created.push(wl);
    console.log(`  water intake ${e.amount}ml → ${wl.id}`);
  }
  return created;
}

// ─── 25. Fasting Logs ─────────────────────────────────────────────────────────

async function seedFastingLogs(userId: string) {
  log('25 / Fasting Logs');
  const entries = [
    { date: '2026-03-01', timeStart: '20:00', timeEnd: '12:00', durationMinutes: 960 },
    { date: '2026-03-02', timeStart: '20:00', timeEnd: '12:00', durationMinutes: 960 },
    { date: '2026-03-03', timeStart: '20:00', timeEnd: '11:00', durationMinutes: 900 },
    { date: '2026-03-04', timeStart: '20:30', timeEnd: '12:30', durationMinutes: 960 },
    { date: '2026-03-05', timeStart: '21:00', timeEnd: '13:00', durationMinutes: 960 },
    { date: '2026-03-06', timeStart: '20:15', timeEnd: '12:15', durationMinutes: 960 },
    { date: '2026-03-07', timeStart: '19:45', timeEnd: '11:45', durationMinutes: 960 },
  ];

  const created = [];
  for (const e of entries) {
    const fl = await prisma.fastingLog.create({
      data: { userId, date: new Date(e.date), timeStart: timeOf(e.timeStart), timeEnd: timeOf(e.timeEnd), durationMinutes: e.durationMinutes },
    });
    created.push(fl);
    console.log(`  fasting log ${e.date} → ${fl.id}`);
  }
  return created;
}

// ─── 26. Sleep Logs ───────────────────────────────────────────────────────────

async function seedSleepLogs(userId: string) {
  log('26 / Sleep Logs');
  const entries = [
    { date: '2026-03-01', timeStart: '22:30', timeEnd: '06:30', durationMinutes: 480, sleepQuality: 'good'      },
    { date: '2026-03-02', timeStart: '23:00', timeEnd: '06:00', durationMinutes: 420, sleepQuality: 'fair'      },
    { date: '2026-03-03', timeStart: '22:00', timeEnd: '07:00', durationMinutes: 540, sleepQuality: 'excellent' },
    { date: '2026-03-04', timeStart: '01:00', timeEnd: '06:30', durationMinutes: 330, sleepQuality: 'poor'      },
    { date: '2026-03-05', timeStart: '22:15', timeEnd: '06:45', durationMinutes: 510, sleepQuality: 'good'      },
    { date: '2026-03-06', timeStart: '22:00', timeEnd: '07:00', durationMinutes: 540, sleepQuality: 'excellent' },
    { date: '2026-03-07', timeStart: '23:30', timeEnd: '07:30', durationMinutes: 480, sleepQuality: 'good'      },
    { date: '2026-03-08', timeStart: '22:45', timeEnd: '06:45', durationMinutes: 480, sleepQuality: 'good'      },
    { date: '2026-03-09', timeStart: '23:15', timeEnd: '06:15', durationMinutes: 420, sleepQuality: 'fair'      },
  ];

  const created = [];
  for (const e of entries) {
    const sl = await prisma.sleepLog.create({
      data: { userId, date: new Date(e.date), timeStart: timeOf(e.timeStart), timeEnd: timeOf(e.timeEnd), durationMinutes: e.durationMinutes, sleepQuality: e.sleepQuality },
    });
    created.push(sl);
    console.log(`  sleep log ${e.date} (${e.sleepQuality}) → ${sl.id}`);
  }
  return created;
}

// ─── 27. Medications ──────────────────────────────────────────────────────────

async function seedMedications(userId: string) {
  log('27 / Medications');
  const defs = [
    { name: 'Vitamin D3',          quantity: 1, dose: '1000 IU', frequency: 'daily', reminderTime: timeOf('08:00'), icon: '💊', appearanceColor: '#FFD700', appearanceIcon: 'capsule' },
    { name: 'Omega-3 Fish Oil',    quantity: 2, dose: '1000mg',  frequency: 'daily', reminderTime: timeOf('21:00'), icon: '💊', appearanceColor: '#FFA500', appearanceIcon: 'capsule' },
    { name: 'Magnesium Glycinate', quantity: 1, dose: '400mg',   frequency: 'daily', reminderTime: timeOf('22:00'), icon: '💊', appearanceColor: '#9B59B6', appearanceIcon: 'tablet'  },
    { name: 'Vitamin B12',         quantity: 1, dose: '500mcg',  frequency: 'daily', reminderTime: timeOf('08:00'), icon: '💊', appearanceColor: '#E74C3C', appearanceIcon: 'tablet'  },
    { name: 'Probiotic Complex',   quantity: 1, dose: '1 capsule',frequency: 'daily', reminderTime: timeOf('07:30'), icon: '💊', appearanceColor: '#2ECC71', appearanceIcon: 'capsule' },
    { name: 'Iron Supplement',     quantity: 1, dose: '65mg',     frequency: 'daily', reminderTime: timeOf('13:00'), icon: '💊', appearanceColor: '#34495E', appearanceIcon: 'tablet'  },
  ];

  const created = [];
  for (const d of defs) {
    let med = await prisma.medication.findFirst({ where: { userId, name: d.name } });
    if (!med) med = await prisma.medication.create({ data: { userId, ...d, addedAt: new Date() } });
    created.push(med);
    console.log(`  medication "${med.name}" → ${med.id}`);
  }
  return created;
}

// ─── 28. Medication Reminders ─────────────────────────────────────────────────

async function seedMedicationReminders(medications: Array<{ id: string; name: string | null }>, userId: string) {
  log('28 / Medication Reminders');
  // Make it realistic: first 3 enabled (active), last 1 disabled (inactive)
  const enabledFlags = [true, true, true, false];
  for (let i = 0; i < medications.length; i++) {
    const medicationId = medications[i].id;
    const enabled = enabledFlags[i] ?? true;
    const existing = await prisma.medicationReminder.findFirst({ where: { medicationId, userId } });
    if (existing) {
      await prisma.medicationReminder.update({ where: { id: existing.id }, data: { enabled } });
      console.log(`  reminder for "${medications[i].name}" → updated (enabled=${enabled})`);
      continue;
    }
    const mr = await prisma.medicationReminder.create({
      data: { medicationId, userId, reminderTime: timeOf(i % 2 === 0 ? '08:00' : '21:00'), repeatType: 'daily', enabled },
    });
    console.log(`  reminder for "${medications[i].name}" → ${mr.id} (enabled=${enabled})`);
  }
}

// ─── 29. Cheat Days ───────────────────────────────────────────────────────────

async function seedCheatDays(userId: string) {
  log('29 / Cheat Days');

  // Delete existing cheat days for this user to avoid duplicates
  await prisma.cheatDay.deleteMany({ where: { userId } });

  const defs = [
    { foodName: 'Pepperoni Pizza',                image: 'https://example.com/pizza.jpg',   mealType: 'Dinner',  portionSize: '2 slices', loggedAt: new Date('2026-03-07T19:00:00Z') },
    { foodName: 'Chocolate Birthday Cake',        image: 'https://example.com/cake.jpg',    mealType: 'Dessert', portionSize: '1 slice',  loggedAt: new Date('2026-03-14T15:00:00Z') },
    { foodName: 'Double Cheeseburger with Fries', image: 'https://example.com/burger.jpg',  mealType: 'Lunch',   portionSize: '1 meal',   loggedAt: new Date('2026-03-21T13:00:00Z') },
    { foodName: 'Ice Cream Sundae',               image: 'https://example.com/icecream.jpg',mealType: 'Snack',   portionSize: '1 cup',    loggedAt: new Date('2026-03-28T16:00:00Z') },
  ];

  for (const d of defs) {
    const cd = await prisma.cheatDay.create({ data: { userId, ...d } });
    console.log(`  cheat day "${cd.foodName}" → ${cd.id}`);
  }
}

// ─── 30. Subscription Payments ────────────────────────────────────────────────

async function seedSubscriptionPayments(userId: string) {
  log('30 / Subscription Payments');
  const defs = [
    { planName: 'premium_monthly', amount: 9.99,  method: 'card', status: 'succeeded', createdAt: new Date('2026-01-01') },
    { planName: 'premium_monthly', amount: 9.99,  method: 'card', status: 'succeeded', createdAt: new Date('2026-02-01') },
    { planName: 'premium_annual',  amount: 99.99, method: 'card', status: 'succeeded', createdAt: new Date('2026-03-01') },
  ];

  for (const d of defs) {
    const sp = await prisma.subscriptionPayment.create({ data: { userId, ...d } });
    console.log(`  payment "${sp.planName}" $${sp.amount} → ${sp.id}`);
  }
}

// ─── 31. Questionnaires ───────────────────────────────────────────────────────

async function seedQuestionnaires(users: Array<{ id: string }>) {
  log('31 / Questionnaires');
  const templates = [
    { gender: 'male',       goal: 'weight_loss', dietType: ['balanced'],     isDiabetic: false, allergenFood: [],        fitnessLevel: 'intermediate', typicalDayType: 'moderately_active', physicalLimitations: 'none',       bodyFocusArea: ['belly', 'arms'],  dateOfBirth: new Date('1990-05-15'), height: 178, heightUnit: 'cm', weight: 80, weightUnit: 'kg', goalWeight: 72, motivationFor: 'health'     },
    { gender: 'female',     goal: 'muscle_gain', dietType: ['high_protein'], isDiabetic: false, allergenFood: ['gluten'],fitnessLevel: 'beginner',     typicalDayType: 'lightly_active',    physicalLimitations: 'none',       bodyFocusArea: ['legs', 'glutes'], dateOfBirth: new Date('1992-08-22'), height: 165, heightUnit: 'cm', weight: 62, weightUnit: 'kg', goalWeight: 65, motivationFor: 'aesthetics' },
    { gender: 'non_binary', goal: 'maintenance', dietType: ['vegetarian'],   isDiabetic: false, allergenFood: ['nuts'],  fitnessLevel: 'intermediate', typicalDayType: 'very_active',       physicalLimitations: 'knee pain',  bodyFocusArea: ['core', 'back'],   dateOfBirth: new Date('1988-11-03'), height: 172, heightUnit: 'cm', weight: 71, weightUnit: 'kg', goalWeight: 71, motivationFor: 'wellbeing'  },
    { gender: 'male',       goal: 'weight_loss', dietType: ['keto'],         isDiabetic: false, allergenFood: [],        fitnessLevel: 'advanced',       typicalDayType: 'very_active',       physicalLimitations: 'none',       bodyFocusArea: ['chest', 'back'],  dateOfBirth: new Date('1985-02-11'), height: 182, heightUnit: 'cm', weight: 95, weightUnit: 'kg', goalWeight: 82, motivationFor: 'performance' },
    { gender: 'female',     goal: 'maintenance', dietType: ['mediterranean'], isDiabetic: false, allergenFood: ['dairy'],fitnessLevel: 'beginner',       typicalDayType: 'moderately_active', physicalLimitations: 'none',       bodyFocusArea: ['legs', 'core'],   dateOfBirth: new Date('1995-12-05'), height: 168, heightUnit: 'cm', weight: 66, weightUnit: 'kg', goalWeight: 66, motivationFor: 'energy' },
  ];

  for (let i = 0; i < Math.min(users.length, templates.length); i++) {
    const userId = users[i].id;
    let q = await prisma.questionnaire.findFirst({ where: { userId } });
    if (!q) q = await prisma.questionnaire.create({ data: { userId, ...templates[i] } });
    console.log(`  questionnaire for ${userId} → ${q.id}`);
  }
}

// ─── 32. User Daily Routines ──────────────────────────────────────────────────

async function seedUserDailyRoutines(
  userId: string,
  fastingId: string,
  sleepId: string,
  medicationId: string,
  meditationId: string,
  waterId: string,
) {
  log('32 / User Daily Routines');
  const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'];

  for (const date of dates) {
    const routinesDate = new Date(date);
    const existing = await prisma.userDailyRoutine.findFirst({ where: { userId, routinesDate } });
    if (existing) { console.log(`  daily routine ${date} → already exists`); continue; }
    const dr = await prisma.userDailyRoutine.create({
      data: { userId, fastingId, sleepId, medicationId, meditationId, waterId, routinesDate },
    });
    console.log(`  daily routine ${date} → ${dr.id}`);
  }
}

async function seedProgressDashboardDataForUser(userId: string, exercisePlanIds: string[], dietPlanIds: string[]) {
  log('33 / Target Progress Dashboard Data');

  // Use UTC-based dates to match the progress controller's query approach
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfToday = new Date(todayStr);
  const endOfToday = new Date(new Date(startOfToday.getTime() + 86400000).toISOString().split('T')[0]);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const questionnairePayload = {
    gender: 'male',
    goal: 'weight_loss',
    dietType: ['balanced'],
    isDiabetic: false,
    allergenFood: [],
    fitnessLevel: 'intermediate',
    typicalDayType: 'moderately_active',
    physicalLimitations: 'none',
    bodyFocusArea: ['core', 'arms'],
    dateOfBirth: new Date('2000-06-14'),
    height: 178,
    heightUnit: 'cm',
    weight: 90,
    weightUnit: 'kg',
    goalWeight: 74,
    motivationFor: 'health',
  };

  const existingQuestionnaire = await prisma.questionnaire.findFirst({ where: { userId } });
  if (existingQuestionnaire) {
    await prisma.questionnaire.update({
      where: { id: existingQuestionnaire.id },
      data: questionnairePayload,
    });
  } else {
    await prisma.questionnaire.create({ data: { userId, ...questionnairePayload } });
  }
  console.log('  questionnaire → ready');

  const existingWaterGoal = await prisma.userWaterGoal.findFirst({ where: { userId } });
  if (!existingWaterGoal) {
    await prisma.userWaterGoal.create({ data: { userId, goalAmount: 2600, unit: 'ml', updatedAt: new Date() } });
  } else {
    await prisma.userWaterGoal.update({
      where: { id: existingWaterGoal.id },
      data: { goalAmount: 2600, unit: 'ml', updatedAt: new Date() },
    });
  }
  console.log('  water goal → ready');

  await prisma.waterIntakeLog.deleteMany({
    where: {
      userId,
      date: {
        gte: startOfToday,
        lt: endOfToday,
      },
    },
  });

  const waterEntries = [
    { amount: 600, timeStart: '07:30', timeEnd: '07:40', drinkType: 'water', notes: 'Morning hydration' },
    { amount: 550, timeStart: '11:00', timeEnd: '11:10', drinkType: 'water', notes: 'Midday hydration' },
    { amount: 700, timeStart: '15:30', timeEnd: '15:45', drinkType: 'water', notes: 'Afternoon bottle' },
    { amount: 500, timeStart: '20:30', timeEnd: '20:40', drinkType: 'water', notes: 'Evening hydration' },
    { amount: 450, timeStart: '09:15', timeEnd: '09:25', drinkType: 'water', notes: 'Between meetings' },
    { amount: 400, timeStart: '17:45', timeEnd: '17:55', drinkType: 'electrolyte', notes: 'After walk' },
  ];

  for (const entry of waterEntries) {
    await prisma.waterIntakeLog.create({
      data: {
        userId,
        date: startOfToday,
        timeStart: timeOf(entry.timeStart),
        timeEnd: timeOf(entry.timeEnd),
        amount: entry.amount,
        unit: 'ml',
        drinkType: entry.drinkType,
        notes: entry.notes,
        loggedAt: new Date(),
      },
    });
  }
  console.log('  water intake logs (today) → seeded');

  await prisma.sleepLog.deleteMany({
    where: {
      userId,
      date: {
        gte: startOfToday,
        lt: endOfToday,
      },
    },
  });

  await prisma.sleepLog.create({
    data: {
      userId,
      date: startOfToday,
      timeStart: timeOf('23:00'),
      timeEnd: timeOf('06:30'),
      durationMinutes: 450,
      sleepQuality: 'good',
    },
  });
  console.log('  sleep log (today) → seeded');

  const medications = await seedMedications(userId);
  await seedMedicationReminders(medications, userId);

  const dietPlanId = dietPlanIds[0];
  if (dietPlanId) {
    const activeDiet = await prisma.userActiveDietPlan.findFirst({ where: { userId, endedAt: null } });
    if (!activeDiet) {
      await prisma.userActiveDietPlan.create({
        data: {
          userId,
          dietId: dietPlanId,
          currentDay: 1,
          startedAt: new Date(startOfToday.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
      });
    } else {
      await prisma.userActiveDietPlan.update({
        where: { id: activeDiet.id },
        data: {
          dietId: dietPlanId,
          currentDay: 1,
          startedAt: new Date(startOfToday.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
      });
    }
    console.log('  active diet plan → ready');
  }

  const exercisePlanId = exercisePlanIds[0];
  if (exercisePlanId) {
    const activeExercisePlan = await prisma.userActiveExercisePlan.findFirst({ where: { userId } });
    if (!activeExercisePlan) {
      await prisma.userActiveExercisePlan.create({
        data: {
          userId,
          planId: exercisePlanId,
          currentWeek: 1,
          startedAt: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      });
    } else {
      await prisma.userActiveExercisePlan.update({
        where: { id: activeExercisePlan.id },
        data: {
          planId: exercisePlanId,
          currentWeek: 1,
          startedAt: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await prisma.userExerciseProgress.deleteMany({
      where: {
        userId,
        completedAt: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
    });

    const schedules = await prisma.exercisePlanSchedule.findMany({
      where: { week: { planId: exercisePlanId } },
      orderBy: [{ weekId: 'asc' }, { orderIndex: 'asc' }],
    });

    if (schedules.length > 0) {
      const completionOffsets = [0, 1, 3, 5];
      for (let i = 0; i < completionOffsets.length; i++) {
        const completedAt = new Date(startOfWeek);
        completedAt.setDate(startOfWeek.getDate() + completionOffsets[i]);
        completedAt.setHours(18, 0, 0, 0);

        await prisma.userExerciseProgress.create({
          data: {
            userId,
            exerciseScheduleId: schedules[i % schedules.length].id,
            progressPercent: 100,
            completed: true,
            completedAt,
            note: 'Completed scheduled workout',
          },
        });
      }
      console.log('  weekly exercise progress → seeded');
    }
  }

  let completedChallenge = await prisma.challenge.findFirst({
    where: {
      name: 'Weekly Consistency Sprint',
      status: 'COMPLETED',
    },
  });

  if (!completedChallenge) {
    completedChallenge = await prisma.challenge.create({
      data: {
        name: 'Weekly Consistency Sprint',
        purpose: 'Build consistent weekly workout habit',
        description: 'Complete your planned sessions through the week.',
        status: 'COMPLETED',
        startDate: startOfToday,
      },
    });
  }

  const existingUserChallenge = await prisma.userChallenge.findFirst({
    where: {
      userId,
      challengeId: completedChallenge.id,
    },
  });

  if (!existingUserChallenge) {
    await prisma.userChallenge.create({
      data: {
        userId,
        challengeId: completedChallenge.id,
        date: startOfToday,
        time: timeOf('09:00'),
        joinedAt: new Date(startOfToday.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log('  challenge progress → ready');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Lifeline — Prisma Mock Data Seeder');
  console.log('📦  Writing directly to database (no HTTP server needed)\n');

  try {
    // ── Phase 1: Foundation ───────────────────────────────────────────────
    const roles     = await seedRoles();
    const adminRole = roles.find(r => r.name === 'admin')!;
    const userRole  = roles.find(r => r.name === 'user')!;

    const users      = await seedUsers(adminRole.id, userRole.id);
    const adminUser  = users[0];
    const regUsers   = users.slice(1);

    await seedAppSettings();

    const mealTypeMap    = await seedMealTypes();
    const exercises      = await seedExercises();
    const exerciseIds    = exercises.map(e => e.id);

    await seedExerciseDetails(exerciseIds);

    const exercisePlans  = await seedExercisePlans();
    const exercisePlanIds= exercisePlans.map(p => p.id);
    const weeks          = await seedExercisePlanWeeks(exercisePlanIds);
    const weekIds        = weeks.map(w => w.id);
    await seedExercisePlanSchedules(weekIds, exerciseIds);

    const dietPlans      = await seedDietPlans();
    const dietPlanIds    = dietPlans.map(p => p.id);
    const days           = await seedDietPlanDays(dietPlanIds);
    const dayIds         = days.map(d => d.id);
    await seedDietPlanMeals(dayIds, mealTypeMap);

    const meditations    = await seedMeditations();
    const meditationIds  = meditations.map(m => m.id);
    const sessions       = await seedMeditationSessions(meditationIds);
    const sessionIds     = sessions.map(s => s.id);

    const challenges     = await seedChallenges();
    const challengeIds   = challenges.map(c => c.id);
    await seedChallengeExercises(challengeIds, exerciseIds);

    await seedBlogs(adminUser.id);

    // ── Phase 2: User-linked data ──────────────────────────────────────────
    const userIds = regUsers.map(u => u.id);

    await seedUserDietPlans(userIds, dietPlanIds);
    await seedUserExercises(userIds, exerciseIds);
    await seedActiveDietPlans(userIds, dietPlanIds);
    await seedActiveExercisePlans(userIds, exercisePlanIds);
    await seedFavoriteMeditations(userIds, sessionIds);
    await seedWaterGoals(userIds);

    // Detailed logs for the first regular user
    const primary = regUsers[0];

    const waterLogs  = await seedWaterIntakeLogs(primary.id);
    const fastLogs   = await seedFastingLogs(primary.id);
    const sleepLogs  = await seedSleepLogs(primary.id);
    const meds       = await seedMedications(primary.id);
    await seedMedicationReminders(meds, primary.id);
    await seedCheatDays(primary.id);
    await seedSubscriptionPayments(primary.id);
    await seedQuestionnaires(regUsers);

    // Daily routine links the first record of each log type
    const meditation = meditations[0];
    if (waterLogs[0] && fastLogs[0] && sleepLogs[0] && meds[0] && meditation) {
      await seedUserDailyRoutines(
        primary.id,
        fastLogs[0].id,
        sleepLogs[0].id,
        meds[0].id,
        meditation.id,
        waterLogs[0].id,
      );
    }

    const targetProgressUser = users.find((u) => u.email === 'sarmad.razaq4@gmail.com');
    if (targetProgressUser) {
      await seedProgressDashboardDataForUser(targetProgressUser.id, exercisePlanIds, dietPlanIds);
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n\n✅  Mock seeding complete!\n');
    console.log('📊  Database summary:');
    const counts = await Promise.all([
      prisma.role.count(),
      prisma.user.count(),
      prisma.exercise.count(),
      prisma.exercisePlan.count(),
      prisma.dietPlan.count(),
      prisma.meditation.count(),
      prisma.meditationSession.count(),
      prisma.challenge.count(),
      prisma.blog.count(),
      prisma.sleepLog.count(),
      prisma.fastingLog.count(),
      prisma.waterIntakeLog.count(),
      prisma.medication.count(),
      prisma.cheatDay.count(),
      prisma.questionnaire.count(),
    ]);
    const labels = ['Roles','Users','Exercises','Exercise Plans','Diet Plans','Meditations','Meditation Sessions','Challenges','Blogs','Sleep Logs','Fasting Logs','Water Intake Logs','Medications','Cheat Days','Questionnaires'];
    labels.forEach((l, i) => console.log(`    ${l.padEnd(25)} ${counts[i]}`));
    console.log('');

  } catch (err) {
    console.error('\n❌  Seeding failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
