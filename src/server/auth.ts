import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, DbUser } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET doit être défini en production.'); })()
    : crypto.randomBytes(32).toString('hex')
);
const TOKEN_EXPIRY = '24h';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    nom: string;
    prenom: string;
  };
}

export function generateToken(user: DbUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès refusé. Jeton d’authentification manquant.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (typeof decoded.id !== 'string') {
      return res.status(401).json({ error: 'Jeton invalide.' });
    }
    const user = db.getData().users.find(candidate => candidate.id === decoded.id);
    if (!user || !user.actif || (decoded.role && decoded.role !== user.role)) {
      return res.status(401).json({ error: 'Utilisateur inactif ou rôle modifié. Veuillez vous reconnecter.' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
  }
}

export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Accès non autorisé pour le rôle [${req.user.role}]. Seuls les rôles [${allowedRoles.join(', ')}] y ont accès.`
      });
    }
    next();
  };
}
