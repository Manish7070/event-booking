import { Schema, model, Document, Types } from "mongoose";

export interface IOrder extends Document {
  orderNumber: string;
  user: Types.ObjectId;
  booking: Types.ObjectId;
  event: Types.ObjectId;
  amount: number;
  currency: string;
  discount: number;
  tax: number;
  platformFee: number;
  finalAmount: number;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  bookingStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    bookingStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"],
      default: "PENDING",
    },
  },
  { timestamps: true },
);

export const Order = model<IOrder>("Order", OrderSchema);
