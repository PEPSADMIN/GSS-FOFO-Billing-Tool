import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Tests must never touch the real dev.db — point Prisma at a throwaway file before anything
// else (including app.ts's `import "dotenv/config"`) gets a chance to load DATABASE_URL.
const TEST_DB_FILE = path.join(__dirname, "test.db");
process.env.DATABASE_URL = `file:${TEST_DB_FILE}`;

if (fs.existsSync(TEST_DB_FILE)) fs.unlinkSync(TEST_DB_FILE);

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: path.join(__dirname, "..", ".."),
  env: process.env,
  stdio: "ignore",
});
