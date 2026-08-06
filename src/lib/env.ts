import 'dotenv/config';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function getEnv(name: string): string | undefined {
  return process.env[name];
}
