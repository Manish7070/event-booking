import { Schema, model, Document, Types } from 'mongoose';

export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'FAILED';

export interface IRefund extends Document {
  booking: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  reason: string;
  status: RefundStatus;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  notes?: string;
  providerRefundId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED', 'FAILED'],
      default: 'REQUESTED',
      index: true,
    },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    providerRefundId: String,
  },
  { timestamps: true }
);

RefundSchema.index({ booking: 1 }, { unique: true });
export const Refund = model<IRefund>('Refund', RefundSchema);
