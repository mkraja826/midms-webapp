import fs from "node:fs";
import path from "node:path";

const dashboardFiles = [
  path.join(process.cwd(), "src", "app", "(head)", "dashboard.tsx"),
  path.join(process.cwd(), "src", "app", "(doctor)", "dashboard.tsx"),
  path.join(process.cwd(), "src", "app", "(reception)", "dashboard.tsx"),
];

for (const filePath of dashboardFiles) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing CapDent dashboard: ${filePath}`);
    process.exit(1);
  }

  let source = fs.readFileSync(filePath, "utf8");
  let changed = false;

  const headerImport = 'import { ClinicBrandHeader } from "@/components/ClinicBrandHeader";';
  const aiImport = 'import { CapDentAiLauncher } from "@/components/CapDentAiLauncher";';

  if (!source.includes(aiImport)) {
    if (!source.includes(headerImport)) {
      console.error(`Could not mount CapDent AI import in ${filePath}`);
      process.exit(1);
    }
    source = source.replace(headerImport, `${headerImport}\n${aiImport}`);
    changed = true;
  }

  if (!source.includes("<CapDentAiLauncher />")) {
    const headerMatch = source.match(/<ClinicBrandHeader[\s\S]*?\/>/);
    if (!headerMatch) {
      console.error(`Could not find ClinicBrandHeader in ${filePath}`);
      process.exit(1);
    }
    source = source.replace(headerMatch[0], `${headerMatch[0]}\n\n      <CapDentAiLauncher />`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, source, "utf8");
    console.log(`Mounted CapDent AI in ${path.relative(process.cwd(), filePath)}.`);
  } else {
    console.log(`CapDent AI already mounted in ${path.relative(process.cwd(), filePath)}.`);
  }
}
