import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';
import { unauthorized, forbidden } from '../../tournament-api/src/utils/error';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

const authService = new AuthService();

/**
 * Authentication middleware
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(unauthorized('No token provided'));
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = authService.verifyToken(token);
    
    // Add user to request
    req.user = decoded as Express.Request['user'];
    
    next();
  } catch (error) {
    next(unauthorized('Invalid token'));
  }
};

/**
 * Authorization middleware for specific roles
 */
export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(unauthorized('User not authenticated'));
    }
    
    if (!roles.includes(req.authUser.role as UserRole)) {
      return next(forbidden('User not authorized'));
    }
    
    next();
  };
};

/**
 * Check if user is the owner of a resource or an admin
 */
export const isOwnerOrAdmin = (getOwnerId: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(unauthorized('User not authenticated'));
    }
    
    const ownerId = getOwnerId(req);
    
    if (req.authUser.id !== ownerId && req.authUser.role !== UserRole.ADMIN) {
      return next(forbidden('User not authorized'));
    }
    
    next();
  };
};
