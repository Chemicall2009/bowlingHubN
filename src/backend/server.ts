import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './apiRouter';
import { runAllScoringTests } from './tests/scoring.test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());

  // Run test verification on startup
  const testResults = runAllScoringTests();
  console.log(`[BowlingHub] USBC Scoring Engine Tests: ${testResults.passed}/${testResults.total} passed.`);
  if (testResults.failedCases.length > 0) {
    console.error('[BowlingHub] Failed tests:', testResults.failedCases);
  }

  // REST API Routes
  app.use('/api', apiRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      WS: 'ok',
      store: 'ok',
      tests_passed: `${testResults.passed}/${testResults.total}`,
      uptime: process.uptime(),
    });
  });

  return { app, server };
}
