import { Schema, model } from "mongoose";
export const PlatformSetting = model(
  "PlatformSetting",
  new Schema(
    {
      key: { type: String, required: true, unique: true },
      value: { type: Schema.Types.Mixed, required: true },
      updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
);
