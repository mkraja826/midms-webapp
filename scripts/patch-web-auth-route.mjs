import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "src", "lib", "auth.tsx");

if (!fs.existsSync(filePath)) {
  console.error(`Missing ${filePath}`);
  process.exit(1);
}

let source = fs.readFileSync(filePath, "utf8");
const oldBlock = `    const firstSegment = segments[0];
    const secondSegment = segments[1];
    const isAuthScreen = firstSegment === "auth";
    const isSettingsPasswordScreen = firstSegment === "settings" && secondSegment === "change-password";`;
const newBlock = `    const firstSegment = segments[0];
    const segmentPath = segments.join("/");
    const isAuthScreen = firstSegment === "auth";
    const isSettingsPasswordScreen = segmentPath === "settings/change-password";`;

if (source.includes(newBlock)) {
  console.log("Browser auth route typing is already prepared.");
} else if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, source, "utf8");
  console.log("Prepared browser auth route typing.");
} else {
  console.error("Could not prepare browser auth route typing. The source file has changed.");
  process.exit(1);
}
