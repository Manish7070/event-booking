import { Schema, model, Document, Types } from 'mongoose';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';

export interface IBookingTicketItem {
  ticketType: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface IBooking extends Document {
  bookingId: string;
  idempotencyKey: string;
  requestHash: string;
  expiresAt: Date;
  reservationReleased: boolean;
  coupon?: Types.ObjectId;
  user: Types.ObjectId;
  event: Types.ObjectId;
  tickets: IBookingTicketItem[];
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  subtotal: number;
  discount: number;
  tax: number;
  platformFee: number;
  total: number;
  couponCode?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentOrderId?: string;
  paymentId?: string;
  qrCodeData: string;
  ticketStatus: TicketStatus;
  checkedIn: boolean;
  checkedInAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    idempotencyKey: String,
    requestHash: String,
    expiresAt: { type: Date, index: true },
    reservationReleased: { type: Boolean, default: false },
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    tickets: [
      {
        ticketType: { type: Schema.Types.ObjectId, ref: 'TicketType', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    attendeeName: { type: String, required: true },
    attendeeEmail: { type: String, required: true },
    attendeePhone: { type: String, required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    couponCode: { type: String, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentOrderId: { type: String, default: null },
    paymentId: { type: String, default: null },
    qrCodeData: { type: String, required: true },
    ticketStatus: {
      type: String,
      enum: ['VALID', 'USED', 'CANCELLED', 'EXPIRED'],
      default: 'VALID',
    },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

BookingSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
BookingSchema.index({ paymentOrderId: 1 }, { unique: true, partialFilterExpression: { paymentOrderId: { $type: 'string' } } });
export const Booking = model<IBooking>('Booking', BookingSchema);
