import { Schema, model, Document, Types } from 'mongoose';

export interface ITicket extends Document {
  ticketNumber: string;
  qrVerificationId: string;
  booking: Types.ObjectId;
  event: Types.ObjectId;
  ticketType: Types.ObjectId;
  user: Types.ObjectId;
  attendeeName: string;
  attendeeEmail: string;
  price: number;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';
  checkedInAt?: Date;
  checkedInBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    qrVerificationId: { type: String, required: true, unique: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    ticketType: { type: Schema.Types.ObjectId, ref: 'TicketType', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    attendeeName: { type: String, required: true },
    attendeeEmail: { type: String, required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['VALID', 'USED', 'CANCELLED', 'EXPIRED'],
      default: 'VALID',
      index: true,
    },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Ticket = model<ITicket>('Ticket', TicketSchema);
