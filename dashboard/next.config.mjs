import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this folder — it sits inside the ployed-atlas
  // repo (which has its own package-lock.json) but deploys as its own app.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
