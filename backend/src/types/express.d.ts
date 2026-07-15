import "express";
import { TabKey } from "@gss/shared";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        outletId: string;
        role: string;
        tabs: TabKey[];
        name: string;
      };
    }
  }
}
