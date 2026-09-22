import { Schema, model, Document, Types } from 'mongoose';

export interface ICheckIn extends Document {
  event: Types.ObjectId;
  ticket: Types.ObjectId;
  checkedInAt: Date;
  organizer: Types.ObjectId;
  createdAt: Date;
}

const CheckInSchema = new Schema<ICheckIn>(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    checkedInAt: { type: Date, default: Date.now },
    organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const CheckIn = model<ICheckIn>('CheckIn', CheckInSchema);
