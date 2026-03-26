import { body } from 'express-validator';
import { UserRole } from '../models/user.model';

/**
 * Validation rules for user registration
 */
export const registerValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isString()
    .withMessage('Name must be a string')
    .trim(),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),

  // Player details validation
  body('playerDetails.rating')
    .optional()
    .isInt({ min: 0, max: 3000 })
    .withMessage('Rating must be between 0 and 3000'),

  body('playerDetails.preferredTimeControl')
    .optional()
    .isString()
    .withMessage('Preferred time control must be a string'),

  body('playerDetails.federation')
    .optional()
    .isString()
    .withMessage('Federation must be a string'),

  body('playerDetails.title')
    .optional()
    .isString()
    .withMessage('Title must be a string'),

  body('playerDetails.bio')
    .optional()
    .isString()
    .withMessage('Bio must be a string'),

  // Director details validation
  body('directorDetails.organization')
    .optional()
    .isString()
    .withMessage('Organization must be a string'),

  body('directorDetails.licenseNumber')
    .optional()
    .isString()
    .withMessage('License number must be a string'),

  body('directorDetails.experience')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Experience must be a positive integer'),

  body('directorDetails.specialties')
    .optional()
    .isArray()
    .withMessage('Specialties must be an array'),

  // Admin details validation
  body('adminDetails.permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),

  body('adminDetails.isSuperAdmin')
    .optional()
    .isBoolean()
    .withMessage('isSuperAdmin must be a boolean')
];

/**
 * Validation rules for user login
 */
export const loginValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];
