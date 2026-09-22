import { Schema, model, Document, Types } from 'mongoose';

export interface IWishlist extends Document {
  user: Types.ObjectId;
  event: Types.ObjectId;
  createdAt: Date;
}

const WishlistSchema = new Schema<IWishlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate saves
WishlistSchema.index({ user: 1, event: 1 }, { unique: true });

export const Wishlist = model<IWishlist>('Wishlist', WishlistSchema);
