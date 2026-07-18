import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "src", "lib", "supabase.ts");

if (!fs.existsSync(filePath)) {
  console.error(`Missing ${filePath}`);
  process.exit(1);
}

let source = fs.readFileSync(filePath, "utf8");
let changed = false;

function replaceOnce(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) {
    console.error(`Could not apply ${label}. The source file has changed.`);
    process.exit(1);
  }
  source = source.replace(search, replacement);
  changed = true;
}

replaceOnce(
  'import { createClient } from "@supabase/supabase-js";',
  'import { createClient, processLock } from "@supabase/supabase-js";\nimport { Platform } from "react-native";',
  "Supabase process lock and platform import"
);

replaceOnce(
  'const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";',
  'const supabaseAnonKey =\n  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??\n  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??\n  "";',
  "publishable key support"
);

replaceOnce(
  '    storage: AsyncStorage,\n    autoRefreshToken: true,\n    persistSession: true,\n    detectSessionInUrl: false,',
  '    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),\n    autoRefreshToken: true,\n    persistSession: true,\n    detectSessionInUrl: Platform.OS === "web",\n    lock: processLock,',
  "browser authentication storage"
);

if (changed) {
  fs.writeFileSync(filePath, source, "utf8");
  console.log("Prepared src/lib/supabase.ts for browser use.");
} else {
  console.log("Browser Supabase source is already prepared.");
}
