import { readFileSync } from "node:fs";

const checks = [
  {
    name: "Customer Hunter sync must not rewrite people records",
    file: "src/components/customers/customer-management.tsx",
    failWhen: [
      /savePerson,\s*\n/,
      /await\s+savePerson\s*\(/,
    ],
    require: [
      /savePersonCustomerTargets/,
      /syncCustomerHunterAssignmentAndTarget/,
    ],
  },
  {
    name: "New customer form must not reuse initial URL customer values",
    file: "src/components/customers/customer-management.tsx",
    failWhen: [
      /const linkedEditing = editing \?\? \(!dismissInitialOpen \? initialCustomer \?\? null : null\)/,
    ],
    require: [
      /const linkedEditing = editing \?\? \(!manualOpen && !dismissInitialOpen \? initialCustomer \?\? null : null\)/,
      /setDismissInitialOpen\(!item\)/,
      /<form key=\{linkedEditing\?\.id \?\? "new-customer"\}/,
    ],
  },
  {
    name: "Target form must not auto-select the first customer or person",
    file: "src/components/targets/target-management.tsx",
    failWhen: [
      /customers\[0\]\?\.id/,
      /targetAssignablePeople\[0\]\?\.id/,
    ],
    require: [
      /<option value="">Selecione<\/option>/,
    ],
  },
];

let failed = false;

for (const check of checks) {
  const source = readFileSync(check.file, "utf8");
  for (const pattern of check.failWhen) {
    if (pattern.test(source)) {
      console.error(`FAIL ${check.name}: forbidden pattern ${pattern} found in ${check.file}`);
      failed = true;
    }
  }
  for (const pattern of check.require) {
    if (!pattern.test(source)) {
      console.error(`FAIL ${check.name}: required pattern ${pattern} missing in ${check.file}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("Critical smoke checks passed.");
