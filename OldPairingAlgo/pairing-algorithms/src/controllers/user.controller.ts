import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { ApiError } from '../../tournament-api/src/utils/error';
import { UserRole } from '../models/user.model';

// Create user service instance
const userService = new UserService();

/**
 * Get all users
 * @route GET /api/users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error: any) {
    console.error('Error getting users:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to get users' });
    }
  }
};

/**
 * Get user by ID
 * @route GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    // Check if user is requesting their own profile or is an admin
    if (req.user?.id !== req.params.id && req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Not authorized to access this user' });
    }
    
    const user = await userService.getUserById(req.params.id);
    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error getting user:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to get user' });
    }
  }
};

/**
 * Update user
 * @route PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    // Check if user is updating their own profile or is an admin
    if (req.user?.id !== req.params.id && req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }
    
    // If not admin, prevent role change
    if (req.user?.role !== UserRole.ADMIN && req.body.role) {
      delete req.body.role;
    }
    
    const user = await userService.updateUser(req.params.id, req.body);
    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to update user' });
    }
  }
};

/**
 * Delete user
 * @route DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to delete user' });
    }
  }
};

/**
 * Get users by role
 * @route GET /api/users/role/:role
 */
export const getUsersByRole = async (req: Request, res: Response) => {
  try {
    const role = req.params.role as UserRole;
    
    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    const users = await userService.getUsersByRole(role);
    res.status(200).json(users);
  } catch (error: any) {
    console.error('Error getting users by role:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to get users by role' });
    }
  }
};

/**
 * Change user role
 * @route PUT /api/users/:id/role
 */
export const changeUserRole = async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    
    // Validate role
    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    const user = await userService.changeUserRole(req.params.id, role);
    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error changing user role:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to change user role' });
    }
  }
};
