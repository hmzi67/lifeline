import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getMediaCategory } from '../middleware/upload.js';
import { config } from '../config/index.js';
import { deleteUserAndData } from '../services/accountDeletionService.js';

const prisma = new PrismaClient();

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

    res.status(200).json({
      success: true,
      data: { user },
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

    const { expoPushToken, platform } = req.body as {
      expoPushToken?: string;
      platform?: string;
    };

    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'expoPushToken is required',
      });
    }

    const scope = `user:${userId}`;

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { id: `${scope}:push_token` },
        update: {
          key: 'push_token',
          value: expoPushToken,
          scope,
        },
        create: {
          id: `${scope}:push_token`,
          key: 'push_token',
          value: expoPushToken,
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
    ]);

    return res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Register push token error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
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

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
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
      data.password = await bcrypt.hash(data.password, 10);
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
      data.password = await bcrypt.hash(data.password, 10);
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

// delete the authenticated user's own account after email + password confirmation
export const deleteOwnAccount = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required to delete your account',
      });
    }

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

    if (user.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          'This account signs in with Google and has no password. Please contact support to delete it.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
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

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get user with relations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data',
    });
  }
};
