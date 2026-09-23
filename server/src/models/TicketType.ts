import { Schema, model, Document, Types } from "mongoose";

export interface ITicketType extends Document {
  event: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  maxPerBooking: number;
  benefits: string[];
  saleStartDate?: Date;
  saleEndDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TicketTypeSchema = new Schema<ITicketType>(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    totalQuantity: { type: Number, required: true, min: 1 },
    soldQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    maxPerBooking: { type: Number, default: 10, min: 1 },
    benefits: [{ type: String }],
    saleStartDate: { type: Date },
    saleEndDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const TicketType = model<ITicketType>("TicketType", TicketTypeSchema);
