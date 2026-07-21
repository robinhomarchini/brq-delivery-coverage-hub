import { readFileSync } from "node:fs";

const checks = [
  {
    name: "Customer Hunter sync must not rewrite people records",
    file: "src/components/customers/customer-management.tsx",
    failWhen: [
      /savePerson,\s*\n/,
      /await\s+savePerson\s*\(/,
      /hunterAmount:\s*formHunterAmount/,
      /hunterAmount:\s*shouldTransferTargets && transferredHunterAmount > 0 \? transferredHunterAmount : formHunterAmount/,
      /Meta Hunter sincronizada pela tela Clientes/,
      /Ao salvar, o vínculo e a meta Hunter da pessoa\/ano são sincronizados automaticamente/,
    ],
    require: [
      /savePersonCustomerTargets/,
      /syncCustomerHunterAssignmentAndTarget/,
      /getHunterAllocationForCustomerPerson/,
      /Metas já lançadas para a pessoa não são alteradas pela meta geral do cliente/,
      /Vínculo Hunter sincronizado pela tela Clientes sem alterar metas lançadas/,
    ],
  },
  {
    name: "Customer status colors must keep matched, above, below and Specialist Hunter distinct",
    file: "src/lib/customers/customer-coverage-view-model.ts",
    failWhen: [
      /if \(status === "ok"\) return "bg-emerald-50 text-emerald-700"/,
      /Math\.abs\(Math\.round\(value\)\) >= 1/,
    ],
    require: [
      /CustomerCoverageStatus = "ok" \| "issue" \| "mismatch" \| "specialist" \| "outOfTarget" \| "empty"/,
      /hasOnlySpecialistHunterCoverage/,
      /if \(status === "ok"\) return "bg-sky-50 text-sky-700"/,
      /if \(status === "specialist"\) return "bg-purple-50 text-purple-700"/,
      /return Math\.abs\(value\) >= 1/,
    ],
  },
  {
    name: "Executive customer chart must compare people allocation against Board baseline",
    file: "src/components/dashboard/executive-dashboard.tsx",
    failWhen: [
      /revenueCurrent:\s*customer\.revenue/,
      /name="Receita Atual"/,
      /name="Meta Prevista"/,
    ],
    require: [
      /getCustomerCoverageAllocatedTotal/,
      /getBoardTargetBaselineRows/,
      /name="Alocado em Pessoas"/,
      /name="Baseline Board"/,
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
    name: "Person target screen must allow cleanup removal for Specialist Hunter",
    file: "src/components/targets/person-target-assignment.tsx",
    failWhen: [],
    require: [
      /disabled=\{savingCustomerId === row\.customerId \|\| removingCustomerId === row\.customerId\}/,
      /disabled=\{selectedPersonIsSpecialistHunter \|\| savingCustomerId === row\.customerId \|\| removingCustomerId === row\.customerId\}/,
    ],
  },
  {
    name: "New Studio target form must start empty instead of reusing filters or prior allocation",
    file: "src/components/targets/studio-target-assignment.tsx",
    failWhen: [
      /actions=\{<Button onClick=\{\(\) => openForm\(\)\}>/,
      /openForm\(undefined, targetCustomerId\);/,
    ],
    require: [
      /function openForm\(allocation\?: StudioTargetAllocation, presetCustomerId = "", forceNew = false\)/,
      /if \(forceNew\) \{/,
      /setFormHunterAmount\("0"\)/,
      /setFormMaintenanceAmount\("0"\)/,
      /openForm\(undefined, "", true\)/,
      /<form key=\{editing\?\.id \?\? `new-studio-target-\$\{formCustomerId \|\| "blank"\}`\}/,
      /openForm\(undefined, targetCustomerId, true\)/,
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
