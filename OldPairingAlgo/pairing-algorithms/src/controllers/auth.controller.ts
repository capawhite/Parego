import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../../tournament-api/src/utils/error';

// Create auth service instance
const authService = new AuthService();

/**
 * Register a new user
 * @route POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    
    const { user, token } = await authService.register({
      email,
      password,
      name,
      role
    });
    
    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to register user' });
    }
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const { user, token } = await authService.login(email, password);
    
    res.status(200).json({
      message: 'Login successful',
      user,
      token
    });
  } catch (error: any) {
    console.error('Error logging in:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to login' });
    }
  }
};

/**
 * Get current user
 * @route GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = await authService.getUserById(req.user.id);
    
    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error getting current user:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to get current user' });
    }
  }
};
