import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { validate } from '../middleware/validation.middleware';
import { updateUserValidation, userIdValidation } from '../validations/user.validation';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get('/',
  authenticate,
  authorize([UserRole.ADMIN]),
  userController.getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin or own user)
 */
router.get('/:id',
  authenticate,
  validate(userIdValidation),
  userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin or own user)
 */
router.put('/:id',
  authenticate,
  validate(updateUserValidation),
  userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete('/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  validate(userIdValidation),
  userController.deleteUser);

/**
 * @route   GET /api/users/role/:role
 * @desc    Get users by role
 * @access  Private (Admin only)
 */
router.get('/role/:role',
  authenticate,
  authorize([UserRole.ADMIN]),
  userController.getUsersByRole);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Change user role
 * @access  Private (Admin only)
 */
router.put('/:id/role',
  authenticate,
  authorize([UserRole.ADMIN]),
  userController.changeUserRole);

export default router;
