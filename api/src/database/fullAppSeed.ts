import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
const audio = (name: string) => `https://example.com/audio/${name}.mp3`;
const video = (name: string) => `https://example.com/video/${name}.mp4`;

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'];
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dietPlans = [
  {
    name: '30 Day Lean Weight Loss Plan',
    calories: 1750,
    cuisineName: 'balanced',
    gender: 'all',
    description: 'A 30-day calorie-controlled plan with high protein, colorful vegetables, and steady energy.',
    image: image('photo-1490645935967-10de6ba17061'),
  },
  {
    name: '30 Day Muscle Gain High Protein Plan',
    calories: 2850,
    cuisineName: 'high_protein',
    gender: 'all',
    description: 'A 30-day muscle-building plan with larger portions, protein at each meal, and workout fuel.',
    image: image('photo-1546069901-ba9599a7e63c'),
  },
  {
    name: '30 Day Mediterranean Wellness Plan',
    calories: 2150,
    cuisineName: 'mediterranean',
    gender: 'all',
    description: 'A 30-day Mediterranean-style plan with fish, legumes, whole grains, olive oil, and fruit.',
    image: image('photo-1512621776951-a57141f2eefd'),
  },
];

const breakfastBases = [
  'Greek yogurt parfait', 'Spinach mushroom omelette', 'Apple cinnamon oats', 'Avocado egg toast',
  'Berry protein smoothie bowl', 'Cottage cheese fruit plate', 'Chickpea flour pancakes', 'Turkey egg scramble',
  'Peanut butter banana oats', 'Smoked salmon rye toast', 'Quinoa breakfast bowl', 'Veggie egg muffins',
  'Mango chia pudding', 'Tofu breakfast scramble', 'High protein cereal bowl', 'Breakfast burrito',
  'Pumpkin seed muesli', 'Ricotta berry toast', 'Lentil savory porridge', 'Sweet potato egg hash',
  'Protein pancakes', 'Almond butter toast', 'Mediterranean egg plate', 'Coconut overnight oats',
  'Chicken sausage scramble', 'Blueberry kefir bowl', 'Tomato basil frittata', 'Date walnut oats',
  'Green smoothie bowl', 'Turkey avocado wrap',
];

const proteins = [
  'grilled chicken', 'baked salmon', 'turkey meatballs', 'lean beef strips', 'shrimp skewers',
  'tuna steak', 'lentil patties', 'tofu cubes', 'chickpea falafel', 'egg salad',
  'cod fillet', 'chicken kofta', 'tempeh strips', 'turkey patties', 'sardine bowl',
  'black bean cakes', 'cottage cheese', 'beef kebab', 'seared trout', 'herbed chicken',
  'white bean stew', 'paneer tikka', 'grilled prawns', 'chicken shawarma', 'turkey chili',
  'baked haddock', 'edamame tofu mix', 'spiced lentils', 'roast beef slices', 'salmon cakes',
];

const carbs = [
  'brown rice', 'quinoa', 'sweet potato', 'whole wheat pasta', 'barley',
  'wild rice', 'buckwheat noodles', 'couscous', 'roasted potatoes', 'bulgur',
  'corn tortillas', 'farro', 'oat pilaf', 'whole grain pita', 'red rice',
  'millet', 'chickpea pasta', 'rye bread', 'basmati rice', 'freekeh',
  'black rice', 'mashed pumpkin', 'sourdough toast', 'rice noodles', 'whole wheat wrap',
  'lentil rice', 'polenta', 'sprouted grain bread', 'potato wedges', 'peas and rice',
];

const vegetables = [
  'broccoli', 'zucchini', 'spinach', 'asparagus', 'bell peppers',
  'green beans', 'kale', 'carrots', 'cauliflower', 'eggplant',
  'cucumber salad', 'roasted beets', 'brussels sprouts', 'arugula', 'tomatoes',
  'snap peas', 'cabbage slaw', 'mushrooms', 'okra', 'mixed greens',
  'radish salad', 'pumpkin cubes', 'fennel', 'celery salad', 'watercress',
  'turnip greens', 'bok choy', 'charred onions', 'swiss chard', 'romaine',
];

const snacks = [
  'almonds and orange', 'hummus cucumber cups', 'protein cocoa shake', 'apple with peanut butter',
  'boiled eggs and grapes', 'roasted chickpeas', 'kefir and berries', 'tuna cucumber boats',
  'trail mix portion', 'edamame with lime', 'cottage cheese pineapple', 'carrot sticks and tahini',
  'protein bar and kiwi', 'chia pudding cup', 'turkey roll-ups', 'banana oat bites',
  'yogurt flax bowl', 'air-popped popcorn', 'date almond bites', 'protein latte',
  'mozzarella tomato cup', 'walnuts and pear', 'bean dip crackers', 'avocado rice cakes',
  'pumpkin seeds and apple', 'smoothie shooter', 'egg white bites', 'fig yogurt cup',
  'peanut date shake', 'cucumber labneh bowl',
];

const exerciseDefs = [
  ['Push-Ups', 'strength', 'Upper body pressing movement for chest, shoulders, and triceps.'],
  ['Goblet Squats', 'strength', 'Lower body squat pattern with core control.'],
  ['Romanian Deadlifts', 'strength', 'Hip hinge for hamstrings, glutes, and posterior chain.'],
  ['Walking Lunges', 'strength', 'Single-leg strength drill for legs and balance.'],
  ['Mountain Climbers', 'cardio', 'Fast core and cardio drill.'],
  ['Plank Shoulder Taps', 'core', 'Anti-rotation plank variation for core stability.'],
  ['Jump Rope Intervals', 'cardio', 'Rhythmic conditioning for stamina and coordination.'],
  ['Dumbbell Rows', 'strength', 'Horizontal pull for upper back strength.'],
  ['Glute Bridges', 'strength', 'Glute activation and hip extension exercise.'],
  ['Burpees', 'cardio', 'Full-body conditioning drill.'],
  ['Bicycle Crunches', 'core', 'Rotational core endurance movement.'],
  ['Step-Ups', 'strength', 'Leg strength and balance exercise.'],
  ['High Knees', 'cardio', 'Upright running drill for conditioning.'],
  ['Overhead Press', 'strength', 'Shoulder and upper-body pressing movement.'],
  ['Side Plank', 'core', 'Lateral core stability hold.'],
  ['Kettlebell Swings', 'cardio', 'Explosive hip hinge conditioning.'],
  ['Lat Pulldowns', 'strength', 'Vertical pull for back and arms.'],
  ['Wall Sit', 'strength', 'Isometric lower-body endurance hold.'],
  ['Skater Hops', 'cardio', 'Lateral power and agility movement.'],
  ['Dead Bug', 'core', 'Controlled core stability drill.'],
  ['Incline Push-Ups', 'strength', 'Beginner-friendly pressing variation.'],
  ['Split Squats', 'strength', 'Unilateral leg strength exercise.'],
  ['Rowing Machine', 'cardio', 'Low-impact full-body endurance work.'],
  ['Russian Twists', 'core', 'Rotational abdominal exercise.'],
  ['Bear Crawls', 'cardio', 'Full-body crawl for shoulders, core, and conditioning.'],
  ['Hip Thrusts', 'strength', 'Glute-focused hip extension exercise.'],
  ['Jumping Jacks', 'cardio', 'Simple total-body warm-up and cardio move.'],
  ['Hollow Hold', 'core', 'Static core compression hold.'],
  ['Chest Press', 'strength', 'Horizontal press for chest and triceps.'],
  ['Farmer Carry', 'strength', 'Loaded carry for grip, core, and posture.'],
  ['Box Jumps', 'cardio', 'Explosive lower-body power movement.'],
  ['Bird Dog', 'core', 'Spinal stability and controlled balance drill.'],
  ['Reverse Lunges', 'strength', 'Knee-friendly single-leg strength move.'],
  ['Battle Ropes', 'cardio', 'Upper-body conditioning intervals.'],
  ['Calf Raises', 'strength', 'Lower-leg strength and ankle support drill.'],
  ['Yoga Flow Recovery', 'recovery', 'Mobility sequence for hips, spine, and shoulders.'],
] as const;

const exercisePlans = [
  {
    name: '30 Day Fat Burn and Strength Plan',
    level: 'intermediate',
    description: 'Five weeks with 30 varied workout days covering strength, cardio, core, and recovery.',
    image: image('photo-1517836357463-d25dfeac3438'),
  },
  {
    name: '30 Day Lean Muscle Builder Plan',
    level: 'intermediate',
    description: 'Five weeks of progressive hypertrophy, conditioning, and mobility for full-body strength.',
    image: image('photo-1534438327276-14e5300c3a48'),
  },
];

const challengeDefs = [
  {
    name: '30 Day Total Wellness Challenge',
    purpose: 'wellness',
    description: 'Complete daily movement, hydration, and balanced meals for 30 days.',
    image: image('photo-1498837167922-ddd27525d352'),
  },
  {
    name: '30 Day Strength Builder Challenge',
    purpose: 'strength',
    description: 'Follow progressive strength workouts and protein-focused nutrition for one month.',
    image: image('photo-1571019613454-1cb2f99b2d8b'),
  },
  {
    name: '30 Day Weight Loss Reset Challenge',
    purpose: 'weight_loss',
    description: 'A structured month of calorie-aware meals, cardio, and habit tracking.',
    image: image('photo-1518611012118-696072aa579a'),
  },
  {
    name: '30 Day Mobility and Mindfulness Challenge',
    purpose: 'recovery',
    description: 'Daily mobility, breathing, sleep hygiene, and gentle nutrition targets.',
    image: image('photo-1506126613408-eca07ce68773'),
  },
];

function dayDate(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

async function ensureMealTypes() {
  const map: Record<string, string> = {};

  for (const name of mealTypes) {
    const existing = await prisma.mealType.findFirst({ where: { name } });
    const mealType = existing ?? await prisma.mealType.create({ data: { name } });
    map[name] = mealType.id;
  }

  return map;
}

function mealsForDay(day: number, planIndex: number, mealTypeMap: Record<string, string>) {
  const i = day - 1;
  const calorieShift = planIndex === 0 ? -80 : planIndex === 1 ? 180 : 20;
  const style = planIndex === 2 ? 'with olive oil and herbs' : planIndex === 1 ? 'with extra protein' : 'with light dressing';

  return [
    {
      mealTypeId: mealTypeMap.Breakfast,
      name: `Day ${day} ${breakfastBases[i]}`,
      calories: 390 + calorieShift,
      portionSize: planIndex === 1 ? '1 large bowl' : '1 bowl',
      recipe: `Prepare ${breakfastBases[i].toLowerCase()} and serve ${style}.`,
      image: image('photo-1484723091739-30a097e8f929'),
    },
    {
      mealTypeId: mealTypeMap.Lunch,
      name: `Day ${day} ${proteins[i]} lunch bowl`,
      calories: 520 + calorieShift,
      portionSize: planIndex === 1 ? '1 large plate' : '1 plate',
      recipe: `Combine ${proteins[i]}, ${carbs[i]}, and ${vegetables[i]} ${style}.`,
      image: image('photo-1543353071-087092ec393a'),
    },
    {
      mealTypeId: mealTypeMap.Dinner,
      name: `Day ${day} ${proteins[(i + 10) % 30]} dinner plate`,
      calories: 610 + calorieShift,
      portionSize: planIndex === 1 ? '1 large serving' : '1 serving',
      recipe: `Cook ${proteins[(i + 10) % 30]} with ${vegetables[(i + 8) % 30]} and serve beside ${carbs[(i + 6) % 30]}.`,
      image: image('photo-1547592180-85f173990554'),
    },
    {
      mealTypeId: mealTypeMap.Snack,
      name: `Day ${day} ${snacks[i]}`,
      calories: 210 + Math.round(calorieShift / 2),
      portionSize: '1 snack',
      recipe: `Portion ${snacks[i]} for a steady-energy snack.`,
      image: image('photo-1505253716362-afaea1d3d1af'),
    },
    {
      mealTypeId: mealTypeMap['Pre-Workout'],
      name: `Day ${day} pre-workout ${carbs[(i + 12) % 30]}`,
      calories: 230 + Math.round(calorieShift / 2),
      portionSize: '1 small serving',
      recipe: `Use ${carbs[(i + 12) % 30]} as a light training fuel portion 45 minutes before exercise.`,
      image: image('photo-1505576399279-565b52d4ac71'),
    },
    {
      mealTypeId: mealTypeMap['Post-Workout'],
      name: `Day ${day} recovery ${proteins[(i + 18) % 30]}`,
      calories: 290 + calorieShift,
      portionSize: '1 recovery serving',
      recipe: `Pair ${proteins[(i + 18) % 30]} with fruit or yogurt after training.`,
      image: image('photo-1553530666-ba11a7da3888'),
    },
  ];
}

async function seedDietPlans(mealTypeMap: Record<string, string>) {
  const plans = [];

  for (let planIndex = 0; planIndex < dietPlans.length; planIndex++) {
    const data = { ...dietPlans[planIndex], duration: '30 days' };
    const existing = await prisma.dietPlan.findFirst({ where: { name: data.name } });
    const plan = existing
      ? await prisma.dietPlan.update({ where: { id: existing.id }, data })
      : await prisma.dietPlan.create({ data });

    await prisma.dietPlanMeal.deleteMany({ where: { day: { dietId: plan.id } } });
    await prisma.dietPlanDay.deleteMany({ where: { dietId: plan.id } });

    for (let day = 1; day <= 30; day++) {
      const dietDay = await prisma.dietPlanDay.create({
        data: {
          dietId: plan.id,
          dayNumber: day,
          notes: `Day ${day}: unique meals, hydration target, and balanced portions for ${plan.name}.`,
        },
      });

      for (const meal of mealsForDay(day, planIndex, mealTypeMap)) {
        await prisma.dietPlanMeal.create({
          data: {
            dayId: dietDay.id,
            mealTypeId: meal.mealTypeId,
            name: meal.name,
            calories: meal.calories,
            portionSize: meal.portionSize,
            recipe: meal.recipe,
            image: meal.image,
          },
        });
      }
    }

    plans.push(plan);
  }

  return plans;
}

async function seedExercises() {
  const exercises = [];

  for (let i = 0; i < exerciseDefs.length; i++) {
    const [name, purpose, description] = exerciseDefs[i];
    const data = {
      name,
      purpose,
      description,
      image: image(i % 2 === 0 ? 'photo-1599058917212-d750089bc07e' : 'photo-1517963879433-6ad2b056d712'),
      duration: `${18 + (i % 5) * 6} min`,
      displayDuration: `${18 + (i % 5) * 6} minutes`,
      videoUrl: video(name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
      difficulty: i % 4 === 0 ? 'beginner' : i % 4 === 1 ? 'intermediate' : i % 4 === 2 ? 'advanced' : 'beginner',
      caloriesBurnEstimate: 120 + (i % 10) * 28,
    };

    const existing = await prisma.exercise.findFirst({ where: { name } });
    const exercise = existing
      ? await prisma.exercise.update({ where: { id: existing.id }, data })
      : await prisma.exercise.create({ data });

    const detailData = {
      sets: 3 + (i % 3),
      reps: purpose === 'cardio' || purpose === 'recovery' ? `${30 + (i % 4) * 15} sec` : `${8 + (i % 5) * 2}`,
      calories: 40 + (i % 8) * 12,
      timeRequired: data.duration,
      mediaUrl: data.videoUrl,
      instructions: `${description} Warm up first, keep form controlled, and stop if pain occurs.`,
    };
    const detail = await prisma.exerciseDetail.findFirst({ where: { exerciseId: exercise.id } });
    if (detail) {
      await prisma.exerciseDetail.update({ where: { id: detail.id }, data: detailData });
    } else {
      await prisma.exerciseDetail.create({ data: { exerciseId: exercise.id, ...detailData } });
    }

    exercises.push(exercise);
  }

  return exercises;
}

async function seedExercisePlans(exerciseIds: string[]) {
  const plans = [];

  for (let planIndex = 0; planIndex < exercisePlans.length; planIndex++) {
    const data = { ...exercisePlans[planIndex], durationWeeks: 5 };
    const existing = await prisma.exercisePlan.findFirst({ where: { name: data.name } });
    const plan = existing
      ? await prisma.exercisePlan.update({ where: { id: existing.id }, data })
      : await prisma.exercisePlan.create({ data });

    await prisma.exercisePlanSchedule.deleteMany({ where: { week: { planId: plan.id } } });
    await prisma.exercisePlanWeek.deleteMany({ where: { planId: plan.id } });

    for (let week = 1; week <= 5; week++) {
      const planWeek = await prisma.exercisePlanWeek.create({ data: { planId: plan.id, weekNumber: week } });

      for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex++) {
        const absoluteDay = (week - 1) * 6 + dayIndex;
        for (let block = 0; block < 4; block++) {
          const exerciseId = exerciseIds[(absoluteDay * 4 + block + planIndex * 3) % exerciseIds.length];
          await prisma.exercisePlanSchedule.create({
            data: {
              weekId: planWeek.id,
              exerciseId,
              dayOfWeek: weekDays[dayIndex],
              sets: 3 + ((week + block) % 3),
              reps: block === 0 ? '12' : block === 1 ? '10' : block === 2 ? '45 sec' : '8',
              duration: `${22 + week * 3 + block * 4} min`,
              orderIndex: block + 1,
              completed: false,
            },
          });
        }
      }
    }

    plans.push(plan);
  }

  return plans;
}

async function seedChallenges(dietPlanIds: string[], exerciseIds: string[]) {
  const challenges = [];

  for (let i = 0; i < challengeDefs.length; i++) {
    const data = {
      ...challengeDefs[i],
      status: 'active',
      approvalStatus: 'APPROVED',
      videoUrl: video(challengeDefs[i].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
      startDate: dayDate(0),
      endDate: dayDate(30),
    };

    const existing = await prisma.challenge.findFirst({ where: { name: data.name } });
    const challenge = existing
      ? await prisma.challenge.update({ where: { id: existing.id }, data })
      : await prisma.challenge.create({ data });

    await prisma.challengeExercise.deleteMany({ where: { challengeId: challenge.id } });
    await prisma.challengeDiet.deleteMany({ where: { challengeId: challenge.id } });
    await prisma.challengeFee.deleteMany({ where: { challengeId: challenge.id, userId: null } });

    for (let j = 0; j < 6; j++) {
      await prisma.challengeExercise.create({
        data: {
          challengeId: challenge.id,
          exerciseId: exerciseIds[(i * 6 + j) % exerciseIds.length],
        },
      });
    }

    await prisma.challengeDiet.create({
      data: {
        challengeId: challenge.id,
        dietId: dietPlanIds[i % dietPlanIds.length],
      },
    });

    await prisma.challengeFee.create({
      data: {
        challengeId: challenge.id,
        amount: i === 0 ? 0 : 9.99 + i * 5,
        method: i === 0 ? 'free' : 'stripe',
        status: 'active',
      },
    });

    challenges.push(challenge);
  }

  return challenges;
}

async function seedMeditationAndSleep() {
  const meditations = [
    ['Morning Focus Reset', 'mindfulness', 'A crisp 8-minute practice for starting the day with clarity.'],
    ['Post Workout Breath Down', 'breathing', 'Slow breathing to bring heart rate down after training.'],
    ['Evening Body Scan', 'sleep', 'A calm guided scan for releasing tension before bed.'],
    ['Confidence Visualization', 'mindfulness', 'A short visualization session for consistency and motivation.'],
    ['Stress Release Pause', 'stress_relief', 'A practical midday reset for anxious or overloaded moments.'],
  ] as const;

  for (let i = 0; i < meditations.length; i++) {
    const [name, type, description] = meditations[i];
    const data = {
      name,
      type,
      description,
      image: image(i % 2 === 0 ? 'photo-1506126613408-eca07ce68773' : 'photo-1499209974431-9dddcece7f88'),
      soundUrl: audio(name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    };
    const existing = await prisma.meditation.findFirst({ where: { name } });
    const meditation = existing
      ? await prisma.meditation.update({ where: { id: existing.id }, data })
      : await prisma.meditation.create({ data });

    await prisma.meditationSession.deleteMany({ where: { meditationId: meditation.id } });
    for (const durationMinutes of [5, 10, 15, 20]) {
      await prisma.meditationSession.create({
        data: {
          meditationId: meditation.id,
          durationMinutes,
          difficulty: durationMinutes <= 10 ? 'beginner' : 'intermediate',
          image: data.image,
          soundUrl: audio(`${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${durationMinutes}`),
        },
      });
    }
  }

  const sleepStories = [
    ['The Quiet Mountain Trail', 'Mina Hale', 'nature', 24],
    ['Ocean Lanterns', 'Ray Donovan', 'ocean', 28],
    ['The Library After Rain', 'Sara Noor', 'calm', 22],
    ['Desert Stars at Midnight', 'Hassan Reed', 'travel', 30],
  ] as const;

  for (const [title, author, category, duration] of sleepStories) {
    const data = {
      title,
      author,
      category,
      duration,
      isActive: true,
      description: `A ${duration}-minute sleep story designed for a calm nighttime routine.`,
      image: image('photo-1500530855697-b586d89ba3ee'),
      audioUrl: audio(title.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    };
    const existing = await prisma.sleepStory.findFirst({ where: { title } });
    if (existing) await prisma.sleepStory.update({ where: { id: existing.id }, data });
    else await prisma.sleepStory.create({ data });
  }

  const sleepSounds = [
    ['Soft Rain Window', 'rain', 60],
    ['Deep Forest Night', 'nature', 90],
    ['Brown Noise Calm', 'noise', 120],
    ['Slow Ocean Tide', 'ocean', 75],
  ] as const;

  for (const [name, category, duration] of sleepSounds) {
    const data = {
      name,
      category,
      duration,
      isActive: true,
      description: `${duration} minutes of ${category} audio for sleep support.`,
      image: image('photo-1470770903676-69b98201ea1c'),
      soundUrl: audio(name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    };
    const existing = await prisma.sleepSound.findFirst({ where: { name } });
    if (existing) await prisma.sleepSound.update({ where: { id: existing.id }, data });
    else await prisma.sleepSound.create({ data });
  }
}

async function seedBlogs(adminUserId: string | null) {
  const categories = [
    { name: 'Nutrition', slug: 'nutrition' },
    { name: 'Fitness', slug: 'fitness' },
    { name: 'Recovery', slug: 'recovery' },
  ];

  const categoryMap: Record<string, string> = {};
  for (const category of categories) {
    const saved = await prisma.blogCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
    categoryMap[category.slug] = saved.id;
  }

  const blogs = [
    ['How to Use a 30 Day Diet Plan Without Getting Bored', 'nutrition'],
    ['Why Strength and Cardio Belong in the Same Month', 'fitness'],
    ['Sleep, Hydration, and Recovery for Better Progress', 'recovery'],
    ['Simple Meal Prep Rules for Busy Weeks', 'nutrition'],
  ] as const;

  for (const [title, categorySlug] of blogs) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await prisma.blog.upsert({
      where: { slug },
      update: {
        title,
        status: 'published',
        categoryId: categoryMap[categorySlug],
        authorId: adminUserId,
      },
      create: {
        title,
        slug,
        status: 'published',
        categoryId: categoryMap[categorySlug],
        authorId: adminUserId,
        coverImage: image('photo-1498837167922-ddd27525d352'),
        excerpt: 'Practical guidance for using Lifeline content consistently.',
        content: [
          `${title}.`,
          'This article gives practical, app-friendly guidance for building consistent wellness habits.',
          'Use the daily plan as a structure, adapt portions to your needs, and track patterns over time.',
        ].join('\n\n'),
      },
    });
  }
}

async function ensureDemoAndExistingUsers(dietPlanId: string, exercisePlanId: string) {
  let userRole = await prisma.role.findFirst({ where: { name: 'user' } });
  if (!userRole) {
    userRole = await prisma.role.create({
      data: { name: 'user', description: 'Regular mobile app user' },
    });
  }

  let adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: 'admin', description: 'Application administrator' },
    });
  }

  let admin = await prisma.user.findFirst({ where: { roleId: adminRole.id } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@lifeline.test',
        username: 'lifeline_admin',
        password: await bcrypt.hash('Password123!', 10),
        isEmailVerified: true,
        status: 'active',
        roleId: adminRole.id,
      },
    });
  }

  const demo = await prisma.user.upsert({
    where: { email: 'demo@lifeline.test' },
    update: {
      username: 'lifeline_demo',
      isEmailVerified: true,
      status: 'active',
      roleId: userRole.id,
    },
    create: {
      email: 'demo@lifeline.test',
      username: 'lifeline_demo',
      password: await bcrypt.hash('Password123!', 10),
      isEmailVerified: true,
      status: 'active',
      roleId: userRole.id,
      profileImage: image('photo-1500648767791-00dcc994a43e'),
    },
  });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { roleId: userRole.id },
        { id: demo.id },
      ],
    },
  });

  for (const user of users) {
    const activeDiet = await prisma.userActiveDietPlan.findFirst({ where: { userId: user.id, endedAt: null } });
    if (!activeDiet) {
      await prisma.userActiveDietPlan.create({
        data: { userId: user.id, dietId: dietPlanId, currentDay: 1, startedAt: dayDate(-1) },
      });
    }

    const activeExercise = await prisma.userActiveExercisePlan.findFirst({ where: { userId: user.id } });
    if (!activeExercise) {
      await prisma.userActiveExercisePlan.create({
        data: { userId: user.id, planId: exercisePlanId, currentWeek: 1, startedAt: dayDate(-1) },
      });
    }

    const waterGoal = await prisma.userWaterGoal.findFirst({ where: { userId: user.id } });
    if (waterGoal) {
      await prisma.userWaterGoal.update({
        where: { id: waterGoal.id },
        data: { goalAmount: 2600, unit: 'ml', updatedAt: new Date() },
      });
    } else {
      await prisma.userWaterGoal.create({
        data: { userId: user.id, goalAmount: 2600, unit: 'ml', updatedAt: new Date() },
      });
    }

    const medication = await prisma.medication.findFirst({ where: { userId: user.id, name: 'Daily Multivitamin' } });
    if (!medication) {
      await prisma.medication.create({
        data: {
          userId: user.id,
          name: 'Daily Multivitamin',
          quantity: 30,
          dose: '1 tablet',
          frequency: 'Daily',
          appearanceColor: '#44c7c7',
          addedAt: new Date(),
        },
      });
    }
  }

  return { adminUserId: admin.id, demoUserId: demo.id, seededUsers: users.length };
}

async function main() {
  console.log('\nLifeline full app seed starting...\n');

  const mealTypeMap = await ensureMealTypes();
  console.log('Meal types ready');

  const diets = await seedDietPlans(mealTypeMap);
  console.log(`Diet plans ready: ${diets.length} plans, ${diets.length * 30} days, ${diets.length * 30 * mealTypes.length} meals`);

  const exercises = await seedExercises();
  console.log(`Exercises ready: ${exercises.length}`);

  const exercisePlansSeeded = await seedExercisePlans(exercises.map((exercise) => exercise.id));
  console.log(`Exercise plans ready: ${exercisePlansSeeded.length} plans with 30 workout days each`);

  const challenges = await seedChallenges(
    diets.map((diet) => diet.id),
    exercises.map((exercise) => exercise.id),
  );
  console.log(`Challenges ready: ${challenges.length}`);

  await seedMeditationAndSleep();
  console.log('Meditation and sleep content ready');

  const userSeed = await ensureDemoAndExistingUsers(diets[0].id, exercisePlansSeeded[0].id);
  await seedBlogs(userSeed.adminUserId);
  console.log(`User-linked starter data ready for ${userSeed.seededUsers} users`);

  const counts = await Promise.all([
    prisma.dietPlan.count(),
    prisma.dietPlanDay.count(),
    prisma.dietPlanMeal.count(),
    prisma.exercise.count(),
    prisma.exercisePlan.count(),
    prisma.exercisePlanSchedule.count(),
    prisma.challenge.count(),
    prisma.meditation.count(),
    prisma.sleepStory.count(),
    prisma.sleepSound.count(),
    prisma.blog.count(),
  ]);
  const labels = [
    'Diet plans',
    'Diet days',
    'Diet meals',
    'Exercises',
    'Exercise plans',
    'Exercise schedules',
    'Challenges',
    'Meditations',
    'Sleep stories',
    'Sleep sounds',
    'Blogs',
  ];

  console.log('\nSeed complete. Database totals:');
  labels.forEach((label, index) => console.log(`  ${label.padEnd(20)} ${counts[index]}`));
  console.log('\nDemo login: demo@lifeline.test / Password123!\n');
}

main()
  .catch((error) => {
    console.error('Full app seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
