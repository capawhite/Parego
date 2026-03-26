import jwt from 'jsonwebtoken';
import User, { UserDocument, UserRole } from '../models/user.model';
import { ApiError, badRequest, notFound, unauthorized } from '../utils/error';
import config from '../config';

/**
 * Authentication service
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register(userData: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    playerDetails?: {
      rating?: number;
      preferredTimeControl?: string;
      federation?: string;
      title?: string;
      bio?: string;
    };
    directorDetails?: {
      organization?: string;
      licenseNumber?: string;
      experience?: number;
      specialties?: string[];
    };
    adminDetails?: {
      permissions?: string[];
      isSuperAdmin?: boolean;
    };
  }): Promise<{ user: UserDocument; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw badRequest('Email already in use');
      }

      const role = userData.role || UserRole.PLAYER;

      // Create new user with role-specific details
      const userObj: any = {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role
      };

      // Add role-specific details if provided
      if (role === UserRole.PLAYER && userData.playerDetails) {
        userObj.playerDetails = userData.playerDetails;
      } else if (role === UserRole.DIRECTOR && userData.directorDetails) {
        userObj.directorDetails = userData.directorDetails;
      } else if (role === UserRole.ADMIN && userData.adminDetails) {
        userObj.adminDetails = userData.adminDetails;
      }

      const user = new User(userObj);

      // Save user
      await user.save();

      // Generate JWT token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Error registering user: ${error}`);
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: UserDocument; token: string }> {
    try {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        throw unauthorized('Invalid email or password');
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw unauthorized('Invalid email or password');
      }

      // Generate JWT token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Error logging in: ${error}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw notFound('User not found');
      }
      return user;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Error getting user: ${error}`);
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: UserDocument): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      throw unauthorized('Invalid token');
    }
  }
}
