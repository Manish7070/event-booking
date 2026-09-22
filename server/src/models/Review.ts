import { Schema, model, Document, Types } from 'mongoose';

export interface IReview extends Document {
  user: Types.ObjectId;
  event: Types.ObjectId;
  booking?: Types.ObjectId;
  rating: number;
  title?: string;
  content: string;
  images: string[];
  helpful: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: '' },
    content: { type: String, required: true },
    images: [{ type: String }],
    helpful: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ user: 1, event: 1 }, { unique: true });

export const Review = model<IReview>('Review', ReviewSchema);
