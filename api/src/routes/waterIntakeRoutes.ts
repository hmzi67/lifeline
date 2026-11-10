import express, { NextFunction, Request, Response, Router } from "express";
import waterIntakeController from "../controllers/waterIntakeController.js";
import authenticate from "../middleware/authenticate.js";
import { validateBody } from '../middleware/validateRequest.js';
import { waterIntakeBody } from '../validators/trackingSchemas.js';

const waterIntakeRoutes: Router = express.Router();

interface WaterIntakeBody {
  timeStart?: string;
  timeEnd?: string;
  date?: string;
}

// Basic validation middleware
const validateTimeFormat = (
  req: Request<unknown, unknown, WaterIntakeBody>,
  res: Response,
  next: NextFunction
): void => {
  const { timeStart, timeEnd } = req.body;

  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (timeStart && !timeRegex.test(timeStart)) {
    res.status(400).json({
      success: false,
      message: "Invalid timeStart format. Use HH:MM format",
    });
    return;
  }

  if (timeEnd && !timeRegex.test(timeEnd)) {
    res.status(400).json({
      success: false,
      message: "Invalid timeEnd format. Use HH:MM format",
    });
    return;
  }

  if (timeStart && timeEnd) {
    const startTime = timeStart.split(":");
    const endTime = timeEnd.split(":");
    const startMinutes = parseInt(startTime[0], 10) * 60 + parseInt(startTime[1], 10);
    const endMinutes = parseInt(endTime[0], 10) * 60 + parseInt(endTime[1], 10);

    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
      res.status(400).json({
        success: false,
        message: "Invalid time values provided",
      });
      return;
    }

    if (endMinutes <= startMinutes) {
      res.status(400).json({
        success: false,
        message: "timeEnd must be after timeStart",
      });
      return;
    }
  }

  next();
};

const validateDateFormat = (
  req: Request<unknown, unknown, WaterIntakeBody>,
  res: Response,
  next: NextFunction
): void => {
  const { date } = req.body;

  if (date && Number.isNaN(Date.parse(date))) {
    res.status(400).json({
      success: false,
      message: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)",
    });
    return;
  }

  next();
};

// Create new water intake log
waterIntakeRoutes.post("/", authenticate, validateTimeFormat, validateDateFormat, validateBody(waterIntakeBody), waterIntakeController.createWaterIntake);

// Get all water intake logs (with optional filtering)
waterIntakeRoutes.get("/", authenticate, waterIntakeController.getAllWaterIntakes);

// Get water intake logs by user ID
waterIntakeRoutes.get("/user/:userId", authenticate, waterIntakeController.getWaterIntakesByUserId);

// Get water intake log by ID
waterIntakeRoutes.get("/:id", authenticate, waterIntakeController.getWaterIntakeById);

// Update water intake log
waterIntakeRoutes.put("/:id", authenticate, validateTimeFormat, validateDateFormat, validateBody(waterIntakeBody), waterIntakeController.updateWaterIntake);

// Delete water intake log
waterIntakeRoutes.delete("/:id", authenticate, waterIntakeController.deleteWaterIntake);

export default waterIntakeRoutes;
