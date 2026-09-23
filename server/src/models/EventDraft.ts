import { Schema, model } from "mongoose";
export const EventDraft = model(
  "EventDraft",
  new Schema(
    {
      organizer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
      },
      form: { type: Schema.Types.Mixed, required: true },
      step: { type: Number, min: 0, max: 7, default: 0 },
    },
    { timestamps: true },
  ),
);
