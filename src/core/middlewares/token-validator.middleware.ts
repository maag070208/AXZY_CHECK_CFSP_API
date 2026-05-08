import express from "express";
import { verifyToken } from "@src/core/utils/security";
import { OPERATIONAL_ROLES } from "@src/core/config/constants";
import { isInShift } from "@src/core/utils/date-time.utils";
import { checkUserShift } from "../utils/shift.utils";

export default async function (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    let token = req.header("Authorization") || (req.query.token as string);

    if (!token) return res.status(401).json({ msg: "No token provided" });

    if (token.startsWith("Bearer ")) {
      token = token.slice(7, token.length);
    }

    const decoded = await verifyToken(token);
    res.locals.user = decoded;
    (req as any).user = decoded;

    // Shift Validation for Guards
    const user = decoded as any;
    const shiftCheck = checkUserShift({
      role: user.role,
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd,
    });

    if (!shiftCheck.canAccess) {
      return res
        .status(403)
        .json({ msg: shiftCheck.message || "Fuera de horario de turno" });
    }

    next();
  } catch (error) {
    return res.status(401).json(error);
  }
}
