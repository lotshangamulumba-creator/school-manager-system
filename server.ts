import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { getHelmetOptions } from './src/server/securityHeaders.js';

function getAllowedOrigins(port: number): Set<string> {
  const configuredOrigins = process.env.ALLOWED_ORIGINS;
  if (configuredOrigins !== undefined) {
    return new Set(configuredOrigins.split(',').map(origin => origin.trim()).filter(Boolean));
  }
  if (process.env.NODE_ENV === 'production') return new Set();
  return new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
}

export async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  if (isProduction && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET doit être défini en production et contenir au moins 32 caractères.');
  }

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT doit être un entier compris entre 1 et 65535.');
  }
  const host = process.env.HOST || '127.0.0.1';
  const allowedOrigins = getAllowedOrigins(port);
  const app = express();

  app.use(helmet(getHelmetOptions(isProduction)));
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Origine non autorisée.' });
    }
    return next();
  });
  app.use(cors({
    origin: (origin, callback) => callback(null, origin && allowedOrigins.has(origin) ? origin : false),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  }));

  app.use('/api/backup/restore', express.json({ limit: '20mb' }));
  app.use('/api/school-profile', express.json({ limit: '20mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'MonPilot School ERP',
      version: '2.0.0',
      establishment: 'Complexe Scolaire Privé CEMINACE (Brazzaville)',
      timestamp: new Date().toISOString()
    });
  });

  app.use(express.static(path.join(process.cwd(), 'public')));
  const { db } = await import('./src/server/db.js');
  await db.ready;
  const { apiRouter } = await import('./src/server/routes.js');
  app.use('/api', apiRouter);

  if (isProduction) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, host, () => {
    console.log(`[MonPilot Server] Plateforme scolaire opérationnelle sur http://${host}:${port}`);
  });
}

startServer().catch(error => {
  console.error('[MonPilot Server] Erreur fatale au démarrage du serveur:', error);
  process.exitCode = 1;
});
