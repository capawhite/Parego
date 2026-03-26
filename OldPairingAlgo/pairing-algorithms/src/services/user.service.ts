import User, { UserDocument, UserRole } from '../models/user.model';
import { ApiError, badRequest, notFound } from '../utils/error';

/**
 * User service
 */
export class UserService {
  /**
   * Get all users
   */
  async getAllUsers(): Promise<UserDocument[]> {
    try {
      return await User.find().select('-password');
    } catch (error) {
      throw new Error(`Error getting users: ${error}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findById(userId).select('-password');
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
   * Update user
   */
  async updateUser(userId: string, userData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      // Remove password from update data for security
      if (userData.password) {
        delete userData.password;
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: userData },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        throw notFound('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Error updating user: ${error}`);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const result = await User.findByIdAndDelete(userId);
      if (!result) {
        throw notFound('User not found');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Error deleting user: ${error}`);
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<UserDocument[]> {
    try {
      return await User.find({ role }).select('-password');
    } catch (error) {
      throw new Error(`Error getting users by role: ${error}`);
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(userId: string, role: UserRole): Promise<UserDocument> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { role } },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        throw notFound('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Error changing user role: ${error}`);
    }
  }
}
