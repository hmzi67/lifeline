import { prisma } from '../config/database.js';

async function main() {
  const result = await prisma.exercisePlanSchedule.deleteMany({});
  console.log('Deleted schedules:', result.count);

  // Also clear any active exercise plans to fix the "multiple activated" issue
  const activePlans = await prisma.userActiveExercisePlan.deleteMany({});
  console.log('Deleted active plans:', activePlans.count);

  await prisma.$disconnect();
}

main();
