import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { pageSize } from '../utils/pagination.js';

export class AppSettingController {
  // Create a new app setting
  static async createAppSetting(req: Request, res: Response): Promise<void> {
    try {
      const { key, value, scope } = req.body;

      if (!key) {
        res.status(400).json({
          success: false,
          message: 'Key is required'
        });
        return;
      }

      // Check if setting with same key and scope already exists
      const existingSetting = await prisma.appSetting.findFirst({
        where: {
          key,
          scope: scope || null
        }
      });

      if (existingSetting) {
        res.status(409).json({
          success: false,
          message: 'App setting with this key and scope already exists'
        });
        return;
      }

      const appSetting = await prisma.appSetting.create({
        data: {
          key,
          value,
          scope
        }
      });

      res.status(201).json({
        success: true,
        message: 'App setting created successfully',
        data: appSetting
      });
    } catch (error) {
      console.error('Error creating app setting:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get all app settings
  static async getAllAppSettings(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit: rawLimit, scope, key } = req.query;
      const limit = pageSize(rawLimit, 10);
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (scope) where.scope = String(scope);
      if (key) where.key = { contains: String(key), mode: 'insensitive' };

      const [appSettings, total] = await Promise.all([
        prisma.appSetting.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: {
            key: 'asc'
          }
        }),
        prisma.appSetting.count({ where })
      ]);

      res.status(200).json({
        success: true,
        message: 'App settings retrieved successfully',
        data: appSettings,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      });
    } catch (error) {
      console.error('Error getting app settings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get app setting by ID
  static async getAppSettingById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const appSetting = await prisma.appSetting.findUnique({
        where: { id }
      });

      if (!appSetting) {
        res.status(404).json({
          success: false,
          message: 'App setting not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'App setting retrieved successfully',
        data: appSetting
      });
    } catch (error) {
      console.error('Error getting app setting:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get app setting by key and scope
  static async getAppSettingByKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { scope } = req.query;

      const appSetting = await prisma.appSetting.findFirst({
        where: {
          key,
          scope: scope ? String(scope) : undefined
        }
      });

      if (!appSetting) {
        res.status(404).json({
          success: false,
          message: 'App setting not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'App setting retrieved successfully',
        data: appSetting
      });
    } catch (error) {
      console.error('Error getting app setting by key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update app setting
  static async updateAppSetting(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { key, value, scope } = req.body;

      const existingSetting = await prisma.appSetting.findUnique({
        where: { id }
      });

      if (!existingSetting) {
        res.status(404).json({
          success: false,
          message: 'App setting not found'
        });
        return;
      }

      // If key is being updated, check for duplicates
      if (key && key !== existingSetting.key) {
        const duplicateSetting = await prisma.appSetting.findFirst({
          where: {
            key,
            scope: scope || null,
            id: { not: id }
          }
        });

        if (duplicateSetting) {
          res.status(409).json({
            success: false,
            message: 'App setting with this key and scope already exists'
          });
          return;
        }
      }

      const updatedAppSetting = await prisma.appSetting.update({
        where: { id },
        data: {
          key,
          value,
          scope
        }
      });

      res.status(200).json({
        success: true,
        message: 'App setting updated successfully',
        data: updatedAppSetting
      });
    } catch (error) {
      console.error('Error updating app setting:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete app setting
  static async deleteAppSetting(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existingSetting = await prisma.appSetting.findUnique({
        where: { id }
      });

      if (!existingSetting) {
        res.status(404).json({
          success: false,
          message: 'App setting not found'
        });
        return;
      }

      await prisma.appSetting.delete({
        where: { id }
      });

      res.status(200).json({
        success: true,
        message: 'App setting deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting app setting:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get settings by scope
  static async getAppSettingsByScope(req: Request, res: Response): Promise<void> {
    try {
      const { scope } = req.params;
      const { page = 1, limit: rawLimit } = req.query;
      const limit = pageSize(rawLimit, 10);
      const skip = (Number(page) - 1) * Number(limit);

      const [appSettings, total] = await Promise.all([
        prisma.appSetting.findMany({
          where: { scope },
          skip,
          take: Number(limit),
          orderBy: {
            key: 'asc'
          }
        }),
        prisma.appSetting.count({ where: { scope } })
      ]);

      res.status(200).json({
        success: true,
        message: 'App settings retrieved successfully',
        data: appSettings,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      });
    } catch (error) {
      console.error('Error getting app settings by scope:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Bulk update or create settings
  static async bulkUpsertAppSettings(req: Request, res: Response): Promise<void> {
    try {
      const { settings } = req.body;

      if (!Array.isArray(settings) || settings.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Settings array is required and must not be empty'
        });
        return;
      }

      const results = [];

      for (const setting of settings) {
        const { key, value, scope } = setting;

        if (!key) {
          results.push({
            key,
            success: false,
            message: 'Key is required'
          });
          continue;
        }

        try {
          const upsertedSetting = await prisma.appSetting.upsert({
            where: {
              id: setting.id || 'non-existent-id'
            },
            update: {
              key,
              value,
              scope
            },
            create: {
              key,
              value,
              scope
            }
          });

          results.push({
            key,
            success: true,
            data: upsertedSetting
          });
        } catch (error) {
          results.push({
            key,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Bulk upsert completed',
        results
      });
    } catch (error) {
      console.error('Error bulk upserting app settings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}