import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "src", "lib", "auth.tsx");

if (!fs.existsSync(filePath)) {
  console.error(`Missing ${filePath}`);
  process.exit(1);
}

let source = fs.readFileSync(filePath, "utf8");
let changed = false;

const oldBlock = `    const firstSegment = segments[0];
    const secondSegment = segments[1];
    const isAuthScreen = firstSegment === "auth";
    const isSettingsPasswordScreen = firstSegment === "settings" && secondSegment === "change-password";`;
const newBlock = `    const firstSegment = segments[0];
    const segmentPath = segments.join("/");
    const isAuthScreen = firstSegment === "auth";
    const isSettingsPasswordScreen = segmentPath === "settings/change-password";`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) {
    console.error("Could not prepare browser auth route typing. The source file has changed.");
    process.exit(1);
  }
  source = source.replace(oldBlock, newBlock);
  changed = true;
}

const oldContactAdminCheck =
  '        if (firstSegment !== "clinic" || secondSegment !== "contact-admin") {';
const newContactAdminCheck =
  '        if (segmentPath !== "clinic/contact-admin") {';

if (!source.includes(newContactAdminCheck)) {
  if (!source.includes(oldContactAdminCheck)) {
    console.error("Could not prepare contact-admin route typing. The source file has changed.");
    process.exit(1);
  }
  source = source.replace(oldContactAdminCheck, newContactAdminCheck);
  changed = true;
}

if (changed) {
  fs.writeFileSync(filePath, source, "utf8");
  console.log("Prepared browser auth route typing.");
} else {
  console.log("Browser auth route typing is already prepared.");
}
