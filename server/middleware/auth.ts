import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../../db.js";
import { JWT_SECRET } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        displayName: string;
        role: string;
        mustChangePassword: boolean;
      };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verify user still exists in database and get latest role
    const user = db
      .prepare(
        "SELECT id, username, display_name as displayName, role, must_change_password as mustChangePassword FROM users WHERE id = ?"
      )
      .get(decoded.id) as any;

    if (!user) {
      res.clearCookie("token");
      return res
        .status(401)
        .json({ error: "Session expired or user not found" });
    }

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
    };
    next();
  } catch (e) {
    res.clearCookie("token");
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Insufficient permissions" });
    }
    next();
  };
}
