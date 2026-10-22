import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/backend/apiRouter';
import { runAllScoringTests } from './src/backend/tests/scoring.test';
import { UdpServer } from './src/backend/services/udpServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Run tests on startup
  const testResults = runAllScoringTests();
  console.log(`[BowlingHub] USBC Scoring Engine: ${testResults.passed}/${testResults.total} tests passing.`);

  // Mount REST API
  app.use('/api', apiRouter);

  // Serve IAdea XMP-320 Scoring Display static files
  app.use('/scoring_display', express.static(path.resolve(__dirname, 'frontend/scoring_display')));

  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      WS: 'ok',
      store: 'ok',
      tests: `${testResults.passed}/${testResults.total}`,
      node_env: process.env.NODE_ENV || 'development',
      port: PORT,
    });
  });

  if (!isProd) {
    // Vite Dev Server middleware with HMR disabled (as required by AI Studio environment constraints)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[BowlingHub] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[BowlingHub] Operator dashboard: http://0.0.0.0:${PORT}/operator`);
    console.log(`[BowlingHub] Kiosk Lane 1: http://0.0.0.0:${PORT}/kiosk/1`);
  });

  const udpServer = new UdpServer(8888);
  udpServer.start();
}

startServer().catch(err => {
  console.error('[BowlingHub] Failed to start server:', err);
  process.exit(1);
});
