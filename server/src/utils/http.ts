import { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export const asyncRoute =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export const ok = (
  res: Response,
  data: unknown = {},
  message = "Success",
  status = 200,
) => res.status(status).json({ success: true, message, data });
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
export const text = z.string().trim().min(1).max(500);
export const email = z.string().trim().toLowerCase().email().max(254);
export const pagination = (req: Request) =>
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .parse(req.query);
export const pageInfo = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  pages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrevious: page > 1,
});
export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
