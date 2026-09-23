import { Schema, model, Document, Types } from "mongoose";

export type DiscountType = "PERCENTAGE" | "FIXED";

export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minimumOrder: number;
  maximumDiscount?: number;
  organizer?: Types.ObjectId;
  event?: Types.ObjectId;
  usageLimit?: number;
  usedCount: number;
  reservedCount: number;
  perUserLimit: number;
  startsAt?: Date;
  expiryDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    minimumOrder: { type: Number, default: 0 },
    maximumDiscount: { type: Number, default: null },
    organizer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    event: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    reservedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    startsAt: Date,
    expiryDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Coupon = model<ICoupon>("Coupon", CouponSchema);
