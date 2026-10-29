import './config/logging.js';
import app from './app.js';
import { config } from './config/index.js';
import {connectDatabase, disconnectDatabase} from './config/database.js';
import { processDueTrialCharges } from './controllers/paymentController.js';

let trialChargeJobRunning = false;

const runTrialChargeJob = async () => {
  if (trialChargeJobRunning) return;
  trialChargeJobRunning = true;
  try {
    await processDueTrialCharges();
  } catch (error) {
    console.error('Trial charge job failed:', error);
  } finally {
    trialChargeJobRunning = false;
  }
};

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Start server
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📊 Health check available at http://localhost:${config.port}/health`);
    });

    void runTrialChargeJob();
    const trialChargeTimer = setInterval(() => void runTrialChargeJob(), 60_000);
    trialChargeTimer.unref();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await disconnectDatabase()
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await disconnectDatabase()
  process.exit(0);
});

startServer();

