import { Schema, model, Document, Types } from "mongoose";

export type EventStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "SOLD_OUT";

export interface IEventSchedule {
  time: string;
  title: string;
  description?: string;
}

export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: Types.ObjectId;
  organizer: Types.ObjectId;
  venue: Types.ObjectId;
  city: string;
  country: string;
  coverImage: string;
  images: string[];
  startDate: Date;
  endDate: Date;
  timezone: string;
  status: EventStatus;
  featured: boolean;
  trending: boolean;
  recommended: boolean;
  totalTickets: number;
  soldTickets: number;
  minPrice: number;
  maxPrice: number;
  views: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  schedule: IEventSchedule[];
  highlights: string[];
  ageRestriction?: string;
  dressCode?: string;
  visibility: string;
  accessibility: string[];
  eventType: string;
  moderationReason?: string;
  faq: Array<{ question: string; answer: string }>;
  termsAndConditions?: string;
  cancellationPolicy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, required: true },
    shortDescription: { type: String, required: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    venue: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    city: { type: String, required: true, index: true },
    country: { type: String, default: "India" },
    coverImage: { type: String, required: true },
    images: [{ type: String }],
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING_REVIEW",
        "PUBLISHED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
        "SOLD_OUT",
      ],
      default: "DRAFT",
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },
    trending: { type: Boolean, default: false, index: true },
    recommended: { type: Boolean, default: false, index: true },
    totalTickets: { type: Number, default: 0 },
    soldTickets: { type: Number, default: 0 },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    tags: [{ type: String }],
    schedule: [
      {
        time: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
      },
    ],
    highlights: [{ type: String }],
    ageRestriction: { type: String, default: "All Ages" },
    dressCode: { type: String, default: "Smart Casual" },
    visibility: {
      type: String,
      enum: ["PUBLIC", "UNLISTED"],
      default: "PUBLIC",
    },
    accessibility: [String],
    eventType: {
      type: String,
      enum: ["IN_PERSON", "ONLINE", "HYBRID"],
      default: "IN_PERSON",
    },
    moderationReason: String,
    faq: [{ question: String, answer: String }],
    termsAndConditions: {
      type: String,
      default: "Standard event booking terms apply.",
    },
    cancellationPolicy: {
      type: String,
      default: "Non-refundable within 24 hours of event start.",
    },
  },
  { timestamps: true },
);

// Compound indexes for event search and discovery
EventSchema.index({ status: 1, startDate: 1 });
EventSchema.index({ category: 1, status: 1 });
EventSchema.index({ city: 1, status: 1 });

export const Event = model<IEvent>("Event", EventSchema);
