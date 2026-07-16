import "dotenv/config";
import express from "express";
import { authRouter } from "./routes/auth";
import { customersRouter } from "./routes/customers";
import { itemsRouter } from "./routes/items";
import { invoicesRouter } from "./routes/invoices";
import { reportsRouter } from "./routes/reports";
import { usersRouter } from "./routes/users";
import { rolesRouter } from "./routes/roles";
import { meRouter } from "./routes/me";
import { stockRouter } from "./routes/stock";
import { dispatchRouter } from "./routes/dispatch";
import { dashboardRouter } from "./routes/dashboard";
import { auditLogRouter } from "./routes/auditLog";
import { outletRouter } from "./routes/outlet";
import { announcementsRouter } from "./routes/announcements";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

// Trust Railway's / Vercel's proxy so req.ip is correct for rate-limiting
app.set("trust proxy", 1);

app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/customers", customersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/me", meRouter);
app.use("/api/stock", stockRouter);
app.use("/api/dispatch", dispatchRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit-log", auditLogRouter);
app.use("/api/outlet", outletRouter);
app.use("/api/announcements", announcementsRouter);

app.use(errorHandler);
