import { migrate } from "./dbMigrate";
import { app } from "./app";

// Railway routes HTTP traffic to the EXPOSE port in the Dockerfile (4000).
// Ignore the PORT env var Railway injects (8080) to avoid the mismatch.
const PORT = 4000;

migrate()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`GSS Billing backend listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[migrate] Failed:", err);
    process.exit(1);
  });
