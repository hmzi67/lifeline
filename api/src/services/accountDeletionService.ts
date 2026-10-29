import { PrismaClient } from '@prisma/client';

/**
 * Deletes a user and the personal data they own, in one transaction.
 *
 * `prisma.user.delete` on its own fails for almost every account: required
 * relations (refresh tokens, meal logs, reminders, ...) default to
 * `onDelete: Restrict`. Children are removed first, in dependency order.
 *
 * Payment, license and challenge-fee records are kept for accounting; their
 * optional user relation is set to null when the user row is deleted.
 * Content shared with others (challenges, blogs, coupon codes) is kept the same way.
 */
export const deleteUserAndData = async (prisma: PrismaClient, userId: string) => {
  const byUser = { where: { userId } };

  return prisma.$transaction(async tx => {
    // Rows that reference other user-owned rows go first
    await tx.userDailyRoutine.deleteMany(byUser);
    await tx.medicationReminder.deleteMany({
      where: { OR: [{ userId }, { medication: { userId } }] },
    });
    await tx.dietMealLog.deleteMany(byUser);
    await tx.referralUsage.deleteMany({
      where: { OR: [{ userId }, { referralCode: { referrerId: userId } }] },
    });
    await tx.referralCode.deleteMany({ where: { referrerId: userId } });

    await tx.medication.deleteMany(byUser);
    await tx.userActiveDietPlan.deleteMany(byUser);
    await tx.userDietPlan.deleteMany(byUser);
    await tx.userExerciseProgress.deleteMany(byUser);
    await tx.userActiveExercisePlan.deleteMany(byUser);
    await tx.userExercise.deleteMany(byUser);
    await tx.userChallenge.deleteMany(byUser);
    await tx.cheatDay.deleteMany(byUser);
    await tx.fastingLog.deleteMany(byUser);
    await tx.sleepLog.deleteMany(byUser);
    await tx.userWaterGoal.deleteMany(byUser);
    await tx.waterIntakeLog.deleteMany(byUser);
    await tx.userFavoriteMeditation.deleteMany(byUser);
    await tx.userMeditationLog.deleteMany(byUser);
    await tx.blogComment.deleteMany(byUser);
    await tx.couponUsage.deleteMany(byUser);
    await tx.questionnaire.deleteMany(byUser);
    await tx.authToken.deleteMany(byUser);
    await tx.refreshToken.deleteMany(byUser);

    return tx.user.delete({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        profileImage: true,
        createdAt: true,
      },
    });
  });
};
