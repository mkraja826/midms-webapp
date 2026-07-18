import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");

if (!fs.existsSync(packagePath) || !fs.existsSync(lockPath)) {
  console.log("package.json or package-lock.json is missing; nothing to normalize.");
  process.exit(0);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

lock.name = packageJson.name;
lock.version = packageJson.version;
lock.packages ??= {};
lock.packages[""] ??= {};
lock.packages[""].name = packageJson.name;
lock.packages[""].version = packageJson.version;
lock.packages[""].dependencies = packageJson.dependencies ?? {};
lock.packages[""].devDependencies = packageJson.devDependencies ?? {};

delete lock.packages[""].optionalDependencies;

fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
console.log(`Normalized package-lock.json for ${packageJson.name}@${packageJson.version}.`);
