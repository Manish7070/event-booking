import { Schema, model, Document, Types } from "mongoose";

export type PayoutStatus =
  "REQUESTED" | "PROCESSING" | "COMPLETED" | "REJECTED";

export interface IPayout extends Document {
  organizer: Types.ObjectId;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: string;
  referenceId?: string;
  notes?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<IPayout>(
  {
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["REQUESTED", "PROCESSING", "COMPLETED", "REJECTED"],
      default: "REQUESTED",
      index: true,
    },
    payoutMethod: { type: String, default: "bank_transfer" },
    referenceId: { type: String, default: "" },
    notes: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PayoutSchema.index(
  { referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $gt: "" } } },
);
export const Payout = model<IPayout>("Payout", PayoutSchema);
