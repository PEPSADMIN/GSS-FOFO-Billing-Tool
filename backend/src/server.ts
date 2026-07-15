import http from "http";
import { migrate } from "./dbMigrate";
import { app } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

// Handle CORS at the raw HTTP level before Express sees the request
const server = http.createServer((req, res) => {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    console.log(`[cors] preflight ${req.url}`);
    res.writeHead(204);
    res.end();
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app(req as any, res as any);
});

migrate()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`GSS Billing backend listening on http://0.0.0.0:${PORT}`);
      console.log("[cors] raw-HTTP CORS active");
    });
  })
  .catch((err) => {
    console.error("[migrate] Failed:", err);
    process.exit(1);
  });
