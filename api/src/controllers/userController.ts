import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getMediaCategory } from '../middleware/upload.js';
import { config } from '../config/index.js';
import { deleteUserAndData } from '../services/accountDeletionService.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';
import { isSuspended } from '../utils/accountAccess.js';
import { generateTokens } from './authController.js';
import { isValidTimeZone } from '../services/missedActivityReminders.js';
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '../utils/passwordPolicy.js';

const USER_SETTINGS_DEFAULTS = {
  theme: 'system',
  notificationsEnabled: true,
  waterReminderEnabled: true,
  language: 'en',
  unitSystem: 'metric',
} as const;

const USER_SETTING_KEY_MAP = {
  theme: 'theme',
  notificationsEnabled: 'notifications_enabled',
  waterReminderEnabled: 'water_reminder_enabled',
  language: 'language',
  unitSystem: 'unit_system',
} as const;

type UserSettingsPayload = {
  theme?: string;
  notificationsEnabled?: boolean;
  waterReminderEnabled?: boolean;
  language?: string;
  unitSystem?: string;
};

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  googleId: true,
  profileImage: true,
  phone: true,
  isEmailVerified: true,
  subject: true,
  status: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
} as const;

const getUserIdFromAuth = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, config.jwt.secret) as {
    userId: string;
  };

  return decoded.userId;
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        ...USER_PUBLIC_SELECT,
        password: true,
        questionnaires: {
          select: {
            id: true,
            gender: true,
            goal: true,
            dietType: true,
            isDiabetic: true,
            allergenFood: true,
            fitnessLevel: true,
            typicalDayType: true,
            physicalLimitations: true,
            bodyFocusArea: true,
            dateOfBirth: true,
            height: true,
            heightUnit: true,
            weight: true,
            weightUnit: true,
            goalWeight: true,
            motivationFor: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only whether a password exists (it decides how account deletion is confirmed).
    const { password, ...profile } = user;
    res.status(200).json({
      success: true,
      data: { user: { ...profile, hasPassword: !!password } },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

export const getUserSettings = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const scope = `user:${userId}`;
    const settings = await prisma.appSetting.findMany({
      where: {
        scope,
        key: {
          in: Object.values(USER_SETTING_KEY_MAP),
        },
      },
    });

    const valueByKey = new Map<string, string>(
      settings
        .filter(setting => typeof setting.key === 'string' && typeof setting.value === 'string')
        .map(setting => [setting.key as string, setting.value as string])
    );

    return res.status(200).json({
      success: true,
      data: {
        theme: valueByKey.get(USER_SETTING_KEY_MAP.theme) || USER_SETTINGS_DEFAULTS.theme,
        notificationsEnabled:
          valueByKey.get(USER_SETTING_KEY_MAP.notificationsEnabled) !== undefined
            ? valueByKey.get(USER_SETTING_KEY_MAP.notificationsEnabled) === 'true'
            : USER_SETTINGS_DEFAULTS.notificationsEnabled,
        waterReminderEnabled:
          valueByKey.get(USER_SETTING_KEY_MAP.waterReminderEnabled) !== undefined
            ? valueByKey.get(USER_SETTING_KEY_MAP.waterReminderEnabled) === 'true'
            : USER_SETTINGS_DEFAULTS.waterReminderEnabled,
        language: valueByKey.get(USER_SETTING_KEY_MAP.language) || USER_SETTINGS_DEFAULTS.language,
        unitSystem: valueByKey.get(USER_SETTING_KEY_MAP.unitSystem) || USER_SETTINGS_DEFAULTS.unitSystem,
      },
    });
  } catch (error) {
    console.error('Get user settings error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

export const updateUserSettings = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const payload = req.body as UserSettingsPayload;
    const upsertEntries: Array<{ key: string; value: string }> = [];

    if (typeof payload.theme === 'string') {
      upsertEntries.push({ key: USER_SETTING_KEY_MAP.theme, value: payload.theme });
    }

    if (typeof payload.notificationsEnabled === 'boolean') {
      upsertEntries.push({
        key: USER_SETTING_KEY_MAP.notificationsEnabled,
        value: String(payload.notificationsEnabled),
      });
    }

    if (typeof payload.waterReminderEnabled === 'boolean') {
      upsertEntries.push({
        key: USER_SETTING_KEY_MAP.waterReminderEnabled,
        value: String(payload.waterReminderEnabled),
      });
    }

    if (typeof payload.language === 'string') {
      upsertEntries.push({ key: USER_SETTING_KEY_MAP.language, value: payload.language });
    }

    if (typeof payload.unitSystem === 'string' && (payload.unitSystem === 'metric' || payload.unitSystem === 'imperial')) {
      upsertEntries.push({ key: USER_SETTING_KEY_MAP.unitSystem, value: payload.unitSystem });
    }

    if (upsertEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid settings were provided',
      });
    }

    const scope = `user:${userId}`;

    await prisma.$transaction(
      upsertEntries.map(({ key, value }) =>
        prisma.appSetting.upsert({
          where: {
            id: `${scope}:${key}`,
          },
          update: {
            value,
            scope,
            key,
          },
          create: {
            id: `${scope}:${key}`,
            key,
            value,
            scope,
          },
        })
      )
    );

    const settingsResponse = await prisma.appSetting.findMany({
      where: {
        scope,
        key: {
          in: Object.values(USER_SETTING_KEY_MAP),
        },
      },
    });

    const valueByKey = new Map<string, string>(
      settingsResponse
        .filter(setting => typeof setting.key === 'string' && typeof setting.value === 'string')
        .map(setting => [setting.key as string, setting.value as string])
    );

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        theme: valueByKey.get(USER_SETTING_KEY_MAP.theme) || USER_SETTINGS_DEFAULTS.theme,
        notificationsEnabled:
          valueByKey.get(USER_SETTING_KEY_MAP.notificationsEnabled) !== undefined
            ? valueByKey.get(USER_SETTING_KEY_MAP.notificationsEnabled) === 'true'
            : USER_SETTINGS_DEFAULTS.notificationsEnabled,
        waterReminderEnabled:
          valueByKey.get(USER_SETTING_KEY_MAP.waterReminderEnabled) !== undefined
            ? valueByKey.get(USER_SETTING_KEY_MAP.waterReminderEnabled) === 'true'
            : USER_SETTINGS_DEFAULTS.waterReminderEnabled,
        language: valueByKey.get(USER_SETTING_KEY_MAP.language) || USER_SETTINGS_DEFAULTS.language,
        unitSystem: valueByKey.get(USER_SETTING_KEY_MAP.unitSystem) || USER_SETTINGS_DEFAULTS.unitSystem,
      },
    });
  } catch (error) {
    console.error('Update user settings error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

export const registerPushToken = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    // `pushToken` is an FCM token; app builds from before FCM send an Expo token as `expoPushToken`.
    const { pushToken: fcmOrExpoToken, expoPushToken, platform, timezone } = req.body as {
      pushToken?: unknown;
      expoPushToken?: unknown;
      platform?: string;
      /** IANA zone of the device, so evening reminders arrive at the user's 9 PM. */
      timezone?: unknown;
    };
    const pushToken = fcmOrExpoToken ?? expoPushToken;

    if (typeof pushToken !== 'string' || !pushToken.trim() || pushToken.length > 4096) {
      return res.status(400).json({
        success: false,
        message: 'pushToken is required',
      });
    }

    const scope = `user:${userId}`;

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { id: `${scope}:push_token` },
        update: {
          key: 'push_token',
          value: pushToken,
          scope,
        },
        create: {
          id: `${scope}:push_token`,
          key: 'push_token',
          value: pushToken,
          scope,
        },
      }),
      prisma.appSetting.upsert({
        where: { id: `${scope}:push_platform` },
        update: {
          key: 'push_platform',
          value: platform || 'unknown',
          scope,
        },
        create: {
          id: `${scope}:push_platform`,
          key: 'push_platform',
          value: platform || 'unknown',
          scope,
        },
      }),
      ...(typeof timezone === 'string' && timezone.length <= 64 && isValidTimeZone(timezone)
        ? [prisma.appSetting.upsert({
            where: { id: `${scope}:timezone` },
            update: { value: timezone },
            create: { id: `${scope}:timezone`, key: 'timezone', value: timezone, scope },
          })]
        : []),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Register push token error:', error);
    // Not 401: the app reads that as an expired session and signs the user out.
    return res.status(500).json({
      success: false,
      message: 'Could not register this device for notifications',
    });
  }
};

// Admin function to get all users with pagination and filtering
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      status = '',
      role = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Clamp so a request cannot ask for an unbounded page.
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { username: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status as string;
    }

    if (role) {
      where.role = {
        name: { contains: role as string, mode: 'insensitive' },
      };
    }

    // Get total count for pagination
    const totalUsers = await prisma.user.count({ where });

    // Get users with pagination
    const users = await prisma.user.findMany({
      where,
      select: {
        ...USER_PUBLIC_SELECT,
        _count: {
          select: {
            questionnaires: true,
            subscriptionPayments: true,
            userLicenses: true,
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      },
      skip,
      take: limitNum,
    });

    const totalPages = Math.ceil(totalUsers / limitNum);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalUsers,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
};

// Admin function to get user statistics
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();

    const usersByStatus = await prisma.user.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const usersByRole = await prisma.user.groupBy({
      by: ['roleId'],
      _count: {
        roleId: true,
      },
      // include: {
      //   role: {
      //     select: {
      //       name: true,
      //     },
      //   },
      // },
    });

    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const verifiedUsers = await prisma.user.count({
      where: {
        isEmailVerified: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        usersByStatus,
        usersByRole,
        recentUsers,
        verifiedUsers,
        verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
    });
  }
};

// update user
export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // ID is a string (cuid) according to schema, no need for BigInt conversion
    const userId = id;

    const allowedFields = [
      'email',
      'username',
      'profileImage',
      'subject',
      'password',
      'status',
      'roleId',
    ];

    let data: any = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== null && req.body[key] !== '') {
        data[key] = req.body[key];
      }
    }

    // Handle file upload - construct URL from uploaded file
    if (req.file) {
      const category = getMediaCategory(req.file.mimetype);
      const relativePath = `/uploads/${category}/${req.file.filename}`;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      data.profileImage = `${baseUrl}${relativePath}`;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      });
    }

    // Hash password if provided
    if (data.password) {
      if (String(data.password).length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ success: false, message: PASSWORD_TOO_SHORT });
      }
      data.password = await bcrypt.hash(data.password, 12);
    }

    // roleId is a string according to schema, no need for BigInt conversion
    // Just validate that the role exists if roleId is provided
    if (data.roleId) {
      const roleExists = await prisma.role.findUnique({
        where: { id: data.roleId },
      });

      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID provided',
        });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        googleId: true,
        profileImage: true,
        isEmailVerified: true,
        subject: true,
        status: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // A password reset or suspension by an admin ends the user's sessions.
    if (data.password || isSuspended(data.status)) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (e: any) {
    console.error('Update error:', e);
    if (e.code === 'P2002') {
      // Handle unique constraint violation
      const target = e.meta?.target;
      if (target?.includes('email')) {
        res.status(400).json({
          success: false,
          message: 'Email already exists',
        });
      } else if (target?.includes('username')) {
        res.status(400).json({
          success: false,
          message: 'Username already exists',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Username or email already exists',
        });
      }
    } else if (e.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to update user',
      });
    }
  }
};

// Fields a user may change on their own profile. Role, status, subject and email
// stay admin-only; unknown fields are ignored so older app builds keep working.
const SELF_EDITABLE_FIELDS = ['displayName', 'username', 'profileImage', 'phone'] as const;

// update the authenticated user's own profile
export const updateOwnProfile = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const data: Record<string, string> = {};
    for (const key of SELF_EDITABLE_FIELDS) {
      const value = req.body[key];
      if (typeof value === 'string' && value.trim() !== '') {
        data[key] = value.trim();
      }
    }

    if (req.file) {
      const category = getMediaCategory(req.file.mimetype);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      data.profileImage = `${baseUrl}/uploads/${category}/${req.file.filename}`;
    }

    const { password: newPassword, currentPassword } = req.body as {
      password?: unknown;
      currentPassword?: unknown;
    };
    if (typeof newPassword === 'string' && newPassword !== '') {
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({
          success: false,
          message: PASSWORD_TOO_SHORT,
        });
      }

      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });
      // Accounts created through Google/Apple have no password yet and may set one.
      if (existing?.password) {
        const matches =
          typeof currentPassword === 'string' &&
          (await bcrypt.compare(currentPassword, existing.password));
        if (!matches) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect',
          });
        }
      }
      data.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_PUBLIC_SELECT,
    });

    if (!data.password) {
      return res.status(200).json({ success: true, data: { user } });
    }

    // A new password signs out every other session; this device gets a fresh one.
    const session = generateTokens(user.id, user.email, user.roleId || undefined);
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.refreshToken.create({
        data: { token: session.refreshToken, userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { user, session } });
  } catch (e: any) {
    console.error('Update own profile error:', e);
    if (e.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Username already exists' });
    } else if (e.code === 'P2025') {
      res.status(404).json({ success: false, message: 'User not found' });
    } else {
      res.status(400).json({ success: false, message: 'Failed to update profile' });
    }
  }
};

// Admin: create user
export const createUser = async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      'email',
      'username',
      'profileImage',
      'phone',
      'subject',
      'password',
      'status',
      'roleId',
    ];

    let data: any = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== null && req.body[key] !== '') {
        data[key] = req.body[key];
      }
    }

    // Hash password if provided
    if (data.password) {
      if (String(data.password).length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ success: false, message: PASSWORD_TOO_SHORT });
      }
      data.password = await bcrypt.hash(data.password, 12);
    }

    // Validate roleId if provided
    if (data.roleId) {
      const roleExists = await prisma.role.findUnique({
        where: { id: data.roleId },
      });
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID provided',
        });
      }
    }

    const user = await prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        username: true,
        googleId: true,
        profileImage: true,
        phone: true,
        isEmailVerified: true,
        subject: true,
        status: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: { user },
      message: 'User created successfully',
    });
  } catch (e: any) {
    console.error('Create user error:', e);
    if (e.code === 'P2002') {
      // Handle unique constraint violation
      const target = e.meta?.target;
      if (target?.includes('email')) {
        res.status(400).json({
          success: false,
          message: 'Email already exists',
        });
      } else if (target?.includes('username')) {
        res.status(400).json({
          success: false,
          message: 'Username already exists',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Username or email already exists',
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to create user',
      });
    }
  }
};

// delete user
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // ID is a string (cuid) according to schema, no need for BigInt conversion
    const userId = id;

    const user = await deleteUserAndData(prisma, userId);

    res.status(200).json({
      success: true,
      data: { user },
      message: 'User deleted successfully',
    });
  } catch (e: any) {
    console.error('Delete user error:', e);
    if (e.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete user',
      });
    }
  }
};

// GET /api/user/export - everything stored about the caller, as JSON (no passwords, codes or tokens)
export const exportOwnData = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const own = { where: { userId } };
    const [
      profile, questionnaire, waterIntake, waterGoals, sleepLogs, fastingLogs, medications,
      cheatDays, foodLogs, dietMealLogs, weightLogs, dailyRoutines, activeDietPlans,
      activeExercisePlans, exerciseProgress, challenges, payments, favoriteMeditations, favoriteExercisePlans,
      favoriteSleepItems, notifications,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: USER_PUBLIC_SELECT }),
      prisma.questionnaire.findMany(own),
      prisma.waterIntakeLog.findMany(own),
      prisma.userWaterGoal.findMany(own),
      prisma.sleepLog.findMany(own),
      prisma.fastingLog.findMany(own),
      prisma.medication.findMany({ ...own, include: { medicationReminders: true, intakes: true } }),
      prisma.cheatDay.findMany(own),
      prisma.foodLog.findMany(own),
      prisma.dietMealLog.findMany(own),
      prisma.weightLog.findMany(own),
      prisma.userDailyRoutine.findMany(own),
      prisma.userActiveDietPlan.findMany({ ...own, include: { diet: { select: { name: true } } } }),
      prisma.userActiveExercisePlan.findMany({ ...own, include: { plan: { select: { name: true } } } }),
      prisma.userExerciseProgress.findMany(own),
      prisma.userChallenge.findMany({ ...own, include: { challenge: { select: { name: true } } } }),
      prisma.subscriptionPayment.findMany({
        ...own,
        select: { id: true, planName: true, amount: true, method: true, status: true, createdAt: true, currentPeriodEnd: true },
      }),
      prisma.userFavoriteMeditation.findMany(own),
      prisma.userFavoriteExercisePlan.findMany({ ...own, include: { plan: { select: { name: true } } } }),
      prisma.userFavoriteSleepItem.findMany({
        ...own,
        include: { sound: { select: { name: true } }, story: { select: { title: true } } },
      }),
      prisma.notification.findMany(own),
    ]);

    res.status(200).json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        profile, questionnaire, waterIntake, waterGoals, sleepLogs, fastingLogs, medications,
        cheatDays, foodLogs, dietMealLogs, weightLogs, dailyRoutines, activeDietPlans,
        activeExercisePlans, exerciseProgress, challenges, payments, favoriteMeditations, favoriteExercisePlans,
        favoriteSleepItems, notifications,
      },
    });
  } catch (error) {
    console.error('Export own data error:', error);
    res.status(500).json({ success: false, message: 'Failed to export your data' });
  }
};

/** Typed by accounts that sign in with Google/Apple and so have no password to re-enter. */
export const ACCOUNT_DELETION_PHRASE = 'DELETE';

// Delete the caller's own account (DELETE /account and DELETE /profile/:id).
// A valid token alone is not enough: password accounts re-enter their
// password; Google/Apple accounts type ACCOUNT_DELETION_PHRASE.
export const deleteOwnAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const { email, password, confirmation } = (req.body ?? {}) as {
      email?: unknown;
      password?: unknown;
      confirmation?: unknown;
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.password) {
      if (typeof password !== 'string' || !password) {
        return res.status(400).json({
          success: false,
          message: 'Enter your password to delete your account',
          code: 'PASSWORD_REQUIRED',
        });
      }
      const emailMatches = email === undefined
        || (typeof email === 'string' && user.email.toLowerCase() === email.trim().toLowerCase());
      // 403, not 401: the user is signed in and the confirmation was wrong. A 401 makes the
      // app treat the session as expired and sign the user out.
      if (!emailMatches || !(await bcrypt.compare(password, user.password))) {
        return res.status(403).json({
          success: false,
          message: 'Incorrect password. Your account was not deleted.',
          code: 'INVALID_PASSWORD',
        });
      }
    } else if (confirmation !== ACCOUNT_DELETION_PHRASE) {
      return res.status(400).json({
        success: false,
        message: `Type ${ACCOUNT_DELETION_PHRASE} to confirm deleting your account`,
        code: 'CONFIRMATION_REQUIRED',
      });
    }

    await deleteUserAndData(prisma, user.id);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (e: any) {
    console.error('Delete own account error:', e);
    res.status(400).json({
      success: false,
      message: 'Failed to delete account',
    });
  }
};

// Additional helper function to get user with all relations
export const getUserWithRelations = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        questionnaires: true,
        authTokens: {
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
          },
        },
        subscriptionPayments: {
          select: {
            id: true,
            planName: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
        userLicenses: {
          include: {
            payment: {
              select: {
                planName: true,
                amount: true,
                status: true,
              },
            },
          },
        },
        userDietPlans: {
          include: {
            diet: true,
          },
        },
        userExercises: {
          include: {
            exercise: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Admins see the profile, never credentials or stored provider tokens.
    const { password, otp, otpPurpose, otpExpiresAt, otpAttempts, appleRefreshToken, appleClientId, ...safeUser } = user;
    res.status(200).json({
      success: true,
      data: { user: { ...safeUser, hasPassword: !!password } },
    });
  } catch (error) {
    console.error('Get user with relations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data',
    });
  }
};
