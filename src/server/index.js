import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });
const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => console.log(`[server] listening on :${port}`));
