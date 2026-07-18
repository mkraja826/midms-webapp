import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, ".env");
const template = path.join(root, ".env.example");
const explicitSource = process.env.CAPDENT_ENV_SOURCE
  ? path.resolve(process.env.CAPDENT_ENV_SOURCE)
  : null;
const siblingMobileEnv = path.resolve(root, "..", "dms", ".env");

function readEnv(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function hasRealConfig(content) {
  const hasUrl = /EXPO_PUBLIC_SUPABASE_URL=https:\/\/[a-zA-Z0-9-]+\.supabase\.co/.test(content);
  const keyMatch = content.match(/EXPO_PUBLIC_SUPABASE_(?:ANON|PUBLISHABLE)_KEY=(.+)/);
  const key = keyMatch?.[1]?.trim() ?? "";
  return hasUrl && key.length > 30 && !key.includes("your-");
}

if (!fs.existsSync(target)) {
  const source = [explicitSource, siblingMobileEnv].find(
    (candidate) => candidate && fs.existsSync(candidate)
  );

  if (source) {
    fs.copyFileSync(source, target);
    console.log(`Created .env from ${source}`);
  } else if (fs.existsSync(template)) {
    fs.copyFileSync(template, target);
    console.log("Created .env from .env.example");
  } else {
    console.error("No .env source or .env.example was found.");
    process.exit(1);
  }
} else {
  console.log("Existing .env preserved.");
}

const content = readEnv(target);
if (!hasRealConfig(content)) {
  console.error("\nCapDent web is not configured yet.");
  console.error("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.");
  console.error("You can also run with CAPDENT_ENV_SOURCE pointing to the working mobile .env file.\n");
  process.exit(1);
}

console.log("CapDent web environment is configured.");
