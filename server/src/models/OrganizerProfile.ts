import { Schema, model, Document, Types } from "mongoose";

export type OrganizerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface IOrganizerProfile extends Document {
  user: Types.ObjectId;
  organizationName: string;
  bio?: string;
  website?: string;
  logo?: string;
  banner?: string;
  status: OrganizerStatus;
  totalEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  rating: number;
  reviewCount: number;
  followers: number;
  payoutRevision: number;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    facebook?: string;
  };
  payoutDetails?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizerProfileSchema = new Schema<IOrganizerProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    organizationName: { type: String, required: true, trim: true },
    bio: { type: String, default: "" },
    website: { type: String, default: "" },
    logo: { type: String, default: "" },
    banner: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
      default: "PENDING",
    },
    totalEvents: { type: Number, default: 0 },
    totalTicketsSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    followers: { type: Number, default: 0 },
    payoutRevision: { type: Number, default: 0 },
    socialLinks: {
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      facebook: { type: String, default: "" },
    },
    payoutDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export const OrganizerProfile = model<IOrganizerProfile>(
  "OrganizerProfile",
  OrganizerProfileSchema,
);
