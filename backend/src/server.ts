import { migrate } from "./dbMigrate";
import { app } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

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
