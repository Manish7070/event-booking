import { Schema, model, Document } from 'mongoose';

export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  isActive: boolean;
  tokenVersion: number;
  verificationToken?: string;
  verificationExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  preferences?: {
    notifications?: boolean;
    newsletter?: boolean;
    favoriteCategories?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
    verificationToken: { type: String, select: false },
    verificationExpiry: { type: Date, select: false },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['USER', 'ORGANIZER', 'ADMIN'], default: 'USER' },
    avatar: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    resetToken: { type: String, default: null, select: false },
    resetTokenExpiry: { type: Date, default: null, select: false },
    preferences: {
      notifications: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true },
      favoriteCategories: [{ type: String }],
    },
  },
  { timestamps: true }
);

UserSchema.set('toJSON', { virtuals: true, transform: (_doc, ret) => { delete ret.password; delete ret.resetToken; delete ret.resetTokenExpiry; delete ret.verificationToken; delete ret.verificationExpiry; return ret; } });
export const User = model<IUser>('User', UserSchema);
