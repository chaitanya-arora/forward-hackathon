import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createFileReportProvider } from "./report-provider.js";
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });
const port = Number(process.env.PORT ?? 4000);
// The saved-file provider serves the fixed demo id (company 2 / run 11, see
// src/frontend/src/lib/demo.ts) from storage/reports/; any run actually
// started through this server is tracked in `liveRuns` inside createApp and
// always reads live from SQLite instead, regardless of this default.
createApp({ reportProvider: createFileReportProvider() }).listen(port, () => console.log(`[server] listening on :${port}`));
