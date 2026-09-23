import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/session.js";
import { asyncRoute as run, HttpError, ok } from "../utils/http.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
      cb(new HttpError(400, "Upload a JPEG, PNG or WebP image"));
    else cb(null, true);
  },
});
export const uploads = Router();
uploads.post(
  "/image",
  requireAuth,
  upload.single("image"),
  run(async (req, res) => {
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    )
      throw new HttpError(503, "Image storage is not configured");
    const file = req.file;
    if (!file) throw new HttpError(400, "Choose an image");
    const header = file.buffer.subarray(0, 12);
    const isPng = header
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
    const isWebp =
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isWebp)
      throw new HttpError(400, "File content is not a supported image");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = `eventra/${req.user!._id}`;
    const signature = crypto
      .createHash("sha256")
      .update(
        `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`,
      )
      .digest("hex");
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    form.set("timestamp", timestamp);
    form.set("folder", folder);
    form.set("api_key", env.CLOUDINARY_API_KEY);
    form.set("signature", signature);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`,
      { method: "POST", body: form, signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok)
      throw new HttpError(502, "Image storage rejected the upload");
    const data = (await response.json()) as any;
    ok(
      res,
      {
        url: data.secure_url,
        width: data.width,
        height: data.height,
        publicId: data.public_id,
      },
      "Image uploaded",
    );
  }),
);
