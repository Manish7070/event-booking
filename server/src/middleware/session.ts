import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, IUser, UserRole } from "../models/User.js";
import { OrganizerProfile } from "../models/OrganizerProfile.js";
import { asyncRoute, HttpError } from "../utils/http.js";
declare module "express-serve-static-core" {
  interface Request {
    user?: IUser;
  }
}
export const requireAuth = asyncRoute(async (req, _res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : "";
  let data: jwt.JwtPayload;
  try {
    data = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "eventra",
      audience: "eventra-client",
    }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, "Please sign in again", "UNAUTHORIZED");
  }
  const user = await User.findById(data.id);
  if (!user?.isActive || user.tokenVersion !== data.version)
    throw new HttpError(401, "Session expired", "UNAUTHORIZED");
  req.user = user;
  next();
});
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return next(
        new HttpError(403, "You do not have access to this resource"),
      );
    next();
  };
export const requireAdmin = requireRole("ADMIN");
export const requireOrganizer = requireRole("ORGANIZER", "ADMIN");
export const requireUser = requireRole("USER");
export const requireApproved = asyncRoute(async (req, _res, next) => {
  if (
    req.user!.role !== "ADMIN" &&
    !(await OrganizerProfile.exists({
      user: req.user!._id,
      status: "APPROVED",
    }))
  )
    throw new HttpError(403, "Your organizer profile must be approved first");
  next();
});
export const requireVerified: RequestHandler = (req, _res, next) => {
  if (!req.user?.isVerified)
    return next(new HttpError(403, "Verify your email before continuing"));
  next();
};
