import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "src", "app", "patient", "[id].tsx");

if (!fs.existsSync(filePath)) {
  console.error(`Missing patient profile: ${filePath}`);
  process.exit(1);
}

let source = fs.readFileSync(filePath, "utf8");
let changed = false;

const importAnchor = 'import { EmptyState } from "@/components/EmptyState";';
const aiImport = 'import { PatientAiSummary } from "@/components/PatientAiSummary";';

if (!source.includes(aiImport)) {
  if (!source.includes(importAnchor)) {
    console.error("Could not mount patient AI import. The patient profile source has changed.");
    process.exit(1);
  }
  source = source.replace(importAnchor, `${importAnchor}\n${aiImport}`);
  changed = true;
}

const sectionAnchor = '      <SectionCard title="Patient Actions"';
const aiMount = '      <PatientAiSummary patientId={patient.id} patientName={patient.name} />';

if (!source.includes(aiMount)) {
  if (!source.includes(sectionAnchor)) {
    console.error("Could not mount patient AI summary. The patient actions section has changed.");
    process.exit(1);
  }
  source = source.replace(sectionAnchor, `${aiMount}\n\n${sectionAnchor}`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(filePath, source, "utf8");
  console.log("Mounted doctor-only CapDent AI on the patient profile.");
} else {
  console.log("Patient AI summary is already mounted.");
}
