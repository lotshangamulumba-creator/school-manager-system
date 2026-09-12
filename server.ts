import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares de base
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // En-têtes CORS et sécurité de base
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Ne pas restreindre X-Frame-Options pour permettre le rendu dans l'iframe AI Studio
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      platform: 'MonPilot School ERP',
      version: '2.0.0',
      establishment: 'Complexe Scolaire Privé CEMINACE (Brazzaville)',
      timestamp: new Date().toISOString()
    });
  });

  // Servir les fichiers statiques de public/
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Monter les routes API REST
  app.use('/api', apiRouter);

  // Vite middleware pour développement ou fichiers statiques en production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MonPilot Server] Plateforme scolaire opérationnelle sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[MonPilot Server] Erreur fatale au démarrage du serveur:', err);
});
