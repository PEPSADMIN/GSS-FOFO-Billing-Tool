import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { TabKey } from "@gss/shared";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in the environment");
}

export interface JwtPayload {
  userId: string;
  outletId: string;
  role: string;
  tabs: TabKey[];
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "30d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "OWNER") {
    return res.status(403).json({ error: "Only the outlet owner can perform this action" });
  }
  next();
}

export function requireTab(tab: TabKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.tabs?.includes(tab)) {
      return res.status(403).json({ error: `You do not have access to the "${tab}" section` });
    }
    next();
  };
}
