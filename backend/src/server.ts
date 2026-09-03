import fs from "fs";
import https from "https";
import { migrate } from "./dbMigrate";
import { app } from "./app";

// Railway routes HTTP traffic to the EXPOSE port in the Dockerfile (4000).
// Ignore the PORT env var Railway injects (8080) to avoid the mismatch.
const PORT = 4000;

// Local-only: when a mkcert cert/key are configured (backend/.env, gitignored), serve HTTPS
// directly so browsers don't flag downloads/etc. as insecure on the LAN. Production is
// unaffected -- Railway terminates TLS at its own edge and never sets these env vars.
const certPath = process.env.LOCAL_HTTPS_CERT;
const keyPath = process.env.LOCAL_HTTPS_KEY;

migrate()
  .then(() => {
    if (certPath && keyPath) {
      const options = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
      https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
        console.log(`Dealer Distributor Portal backend listening on https://0.0.0.0:${PORT}`);
      });
    } else {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Dealer Distributor Portal backend listening on http://0.0.0.0:${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error("[migrate] Failed:", err);
    process.exit(1);
  });
