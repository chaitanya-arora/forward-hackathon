import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two lockfiles exist in this repo (root, for the backend; this one, for
  // the frontend) — pin the trace root explicitly rather than let Next guess.
  outputFileTracingRoot: resolve(here),
};

export default nextConfig;
