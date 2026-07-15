import { app } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`GSS Billing backend listening on http://0.0.0.0:${PORT}`);
});
