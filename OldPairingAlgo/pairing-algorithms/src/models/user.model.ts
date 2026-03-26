import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export enum UserRole {
  ADMIN = 'admin',
  DIRECTOR = 'director',
  PLAYER = 'player'
}

// User schema
const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.PLAYER
  },
  // Player-specific fields
  playerProfile: {
    type: Schema.Types.ObjectId,
    ref: 'Player'
  },
  playerDetails: {
    rating: { type: Number, default: 1500 },
    preferredTimeControl: { type: String },
    federation: { type: String },
    title: { type: String },
    bio: { type: String }
  },
  // Director-specific fields
  directorDetails: {
    organization: { type: String },
    licenseNumber: { type: String },
    experience: { type: Number }, // Years of experience
    specialties: [{ type: String }] // e.g., "Swiss", "Arena", etc.
  },
  // Admin-specific fields
  adminDetails: {
    permissions: [{ type: String }],
    lastLogin: { type: Date },
    isSuperAdmin: { type: Boolean, default: false }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password; // Don't expose password
      return ret;
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  const user = this;

  // Only hash the password if it's modified or new
  if (!user.isModified('password')) return next();

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);

    // Hash password
    const hash = await bcrypt.hash(user.password, salt);

    // Replace plain text password with hash
    user.password = hash;
    next();
  } catch (error) {
    return next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Player details interface
export interface PlayerDetails {
  rating?: number;
  preferredTimeControl?: string;
  federation?: string;
  title?: string;
  bio?: string;
}

// Director details interface
export interface DirectorDetails {
  organization?: string;
  licenseNumber?: string;
  experience?: number;
  specialties?: string[];
}

// Admin details interface
export interface AdminDetails {
  permissions?: string[];
  lastLogin?: Date;
  isSuperAdmin?: boolean;
}

// Create and export the User model
export interface UserDocument extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  playerProfile?: mongoose.Types.ObjectId;
  playerDetails?: PlayerDetails;
  directorDetails?: DirectorDetails;
  adminDetails?: AdminDetails;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export default mongoose.model<UserDocument>('User', UserSchema);
