"use client";

import { Save, Target, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { Customer, TargetAllocation, TargetAllocationType } from "@/data/mockData";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { formatCurrency } from "@/lib/utils";
import { getFinancialCustomerMetric } from "@/lib/financial-customers";

const currentYear = 2026;

type DraftAmounts = Record<string, { hunter: string; farmerRenewal: string }>;

export function PersonTargetAssignment() {
  const { people, customers, targetAllocations, saveTargetAllocation, deleteTargetAllocation } = useDeliveryStore();
  const activePeople = useMemo(() => people.filter((person) => person.active), [people]);
  const years = useMemo(
    () => Array.from(new Set([currentYear, ...targetAllocations.map((allocation) => allocation.year)])).sort((a, b) => b - a),
    [targetAllocations],
  );
  const [personId, setPersonId] = useState(activePeople[0]?.id ?? "");
  const [year, setYear] = useState(currentYear);
  const [drafts, setDrafts] = useState<DraftAmounts>({});
  const [savingCustomerId, setSavingCustomerId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedPerson = activePeople.find((person) => person.id === personId);
  const rows = useMemo(
    () => customers.map((customer) => buildRow(customer, personId, year, targetAllocations, drafts[customer.id])),
    [customers, drafts, personId, targetAllocations, year],
  );
  const totals = useMemo(() => rows.reduce((summary, row) => ({
    hunter: summary.hunter + row.hunterAmount,
    farmerRenewal: summary.farmerRenewal + row.farmerRenewalAmount,
  }), { hunter: 0, farmerRenewal: 0 }), [rows]);

  function updateDraft(customerId: string, field: "hunter" | "farmerRenewal", value: string) {
    setDrafts((current) => ({
      ...current,
      [customerId]: {
        hunter: current[customerId]?.hunter ?? getInputValue(rows.find((row) => row.customerId === customerId)?.hunterAmount ?? 0),
        farmerRenewal: current[customerId]?.farmerRenewal ?? getInputValue(rows.find((row) => row.customerId === customerId)?.farmerRenewalAmount ?? 0),
        [field]: value,
      },
    }));
  }

  async function saveCustomerTargets(row: PersonTargetRow) {
    if (!personId) {
      setErrorMessage("Selecione uma pessoa antes de salvar.");
      return;
    }

    const nextHunterAmount = parseAmount(drafts[row.customerId]?.hunter ?? row.hunterInput);
    const nextFarmerRenewalAmount = parseAmount(drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput);
    const currentOtherPeopleTotal = sumOtherPeopleAllocations(targetAllocations, row.customerId, personId, year);
    const nextCustomerTotal = currentOtherPeopleTotal + nextHunterAmount + nextFarmerRenewalAmount;

    if (nextCustomerTotal > row.customerTarget + 0.01) {
      setErrorMessage(`Não foi possível salvar. A soma das metas das pessoas para ${row.customerName} ficaria acima da meta do cliente (${formatCurrency(row.customerTarget)}).`);
      return;
    }

    try {
      setSavingCustomerId(row.customerId);
      setErrorMessage("");
      await persistRowTargets({
        targets: [
          {
            existing: row.hunterAllocation,
            amount: nextHunterAmount,
            customerId: row.customerId,
            personId,
            year,
            type: "hunter",
          },
          {
            existing: row.farmerRenewalAllocation,
            amount: nextFarmerRenewalAmount,
            customerId: row.customerId,
            personId,
            year,
            type: "farmer_renewal",
          },
        ],
        saveTargetAllocation,
        deleteTargetAllocation,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.customerId];
        return next;
      });
      setSuccessMessage(`Metas de ${selectedPerson?.name ?? "pessoa"} em ${row.customerName} salvas.`);
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch (error) {
      setErrorMessage(getFormErrorMessage(error));
    } finally {
      setSavingCustomerId("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Metas por Pessoa"
        description="Associe metas por pessoa, cliente e ano. Informe separadamente Meta Hunter e Meta Renovação + Ampliação; as demais telas consolidam a partir daqui."
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {errorMessage && <ErrorNotice message={errorMessage} floating onClose={() => setErrorMessage("")} />}

      <Card className="mb-5 grid gap-4 p-5 shadow-sm lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Pessoa</span>
          <Select value={personId} onChange={(event) => {
            setPersonId(event.target.value);
            setDrafts({});
          }}>
            {activePeople.map((person) => (
              <option key={person.id} value={person.id}>{person.name} · {person.roleType}</option>
            ))}
          </Select>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Ano</span>
          <Select value={String(year)} onChange={(event) => {
            setYear(Number(event.target.value));
            setDrafts({});
          }}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </label>
        <Summary label="Meta Hunter" value={formatCurrency(totals.hunter)} />
        <Summary label="Renovação + Ampliação" value={formatCurrency(totals.farmerRenewal)} />
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-50 text-brq-purple">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{selectedPerson?.name ?? "Pessoa não selecionada"}</h2>
              <p className="text-xs text-slate-500">Edite os valores por cliente e salve a linha correspondente.</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Meta do Cliente</TableHead>
                <TableHead>Já associado a outras pessoas</TableHead>
                <TableHead>Meta Hunter</TableHead>
                <TableHead>Meta Renovação + Ampliação</TableHead>
                <TableHead>Total da Pessoa</TableHead>
                <TableHead>Status do Cliente</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.customerId}>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{row.customerName}</p>
                    <p className="text-xs text-slate-500">{row.industry}</p>
                  </TableCell>
                  <TableCell>{formatCurrency(row.customerTarget)}</TableCell>
                  <TableCell>{formatCurrency(row.otherPeopleTotal)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[row.customerId]?.hunter ?? row.hunterInput}
                      onChange={(event) => updateDraft(row.customerId, "hunter", event.target.value)}
                      onDoubleClick={(event) => event.currentTarget.select()}
                      aria-label={`Meta Hunter para ${row.customerName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput}
                      onChange={(event) => updateDraft(row.customerId, "farmerRenewal", event.target.value)}
                      onDoubleClick={(event) => event.currentTarget.select()}
                      aria-label={`Meta Renovação + Ampliação para ${row.customerName}`}
                    />
                  </TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(row.personTotal)}</TableCell>
                  <TableCell><ClientStatusBadge status={row.clientStatus} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveCustomerTargets(row)}
                        disabled={savingCustomerId === row.customerId}
                      >
                        <Save className="h-4 w-4" />
                        {savingCustomerId === row.customerId ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

type PersonTargetRow = ReturnType<typeof buildRow>;
type ClientStatus = "ok" | "pending" | "over";

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Target className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fechado</Badge>;
  if (status === "over") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Acima</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>;
}

function buildRow(customer: Customer, personId: string, year: number, allocations: TargetAllocation[], draft?: { hunter: string; farmerRenewal: string }) {
  const hunterAllocation = findAllocation(allocations, customer.id, personId, year, "hunter");
  const farmerRenewalAllocation = findAllocation(allocations, customer.id, personId, year, "farmer_renewal");
  const hunterAmount = parseAmount(draft?.hunter ?? getInputValue(hunterAllocation?.amount ?? 0));
  const farmerRenewalAmount = parseAmount(draft?.farmerRenewal ?? getInputValue(farmerRenewalAllocation?.amount ?? 0));
  const otherPeopleTotal = sumOtherPeopleAllocations(allocations, customer.id, personId, year);
  const customerTarget = getCustomerTarget(customer);
  const clientTotal = otherPeopleTotal + hunterAmount + farmerRenewalAmount;

  return {
    customerId: customer.id,
    customerName: customer.name,
    industry: customer.industry,
    customerTarget,
    otherPeopleTotal,
    hunterAllocation,
    farmerRenewalAllocation,
    hunterAmount,
    farmerRenewalAmount,
    hunterInput: getInputValue(hunterAllocation?.amount ?? 0),
    farmerRenewalInput: getInputValue(farmerRenewalAllocation?.amount ?? 0),
    personTotal: hunterAmount + farmerRenewalAmount,
    clientStatus: getClientStatus(customerTarget, clientTotal),
  };
}

function findAllocation(
  allocations: TargetAllocation[],
  customerId: string,
  personId: string,
  year: number,
  type: TargetAllocationType,
) {
  return allocations.find((allocation) =>
    allocation.customerId === customerId
    && allocation.personId === personId
    && allocation.year === year
    && allocation.type === type
  );
}

async function persistTypeTarget({
  existing,
  amount,
  customerId,
  personId,
  year,
  type,
  saveTargetAllocation,
  deleteTargetAllocation,
}: {
  existing?: TargetAllocation;
  amount: number;
  customerId: string;
  personId: string;
  year: number;
  type: TargetAllocationType;
  saveTargetAllocation: (allocation: TargetAllocation) => Promise<void>;
  deleteTargetAllocation: (id: string) => Promise<void>;
}) {
  if (amount <= 0) {
    if (existing) await deleteTargetAllocation(existing.id);
    return;
  }

  await saveTargetAllocation({
    id: existing?.id ?? `target-${customerId}-${personId}-${type.replace("_", "-")}-${year}`,
    customerId,
    personId,
    type,
    year,
    amount,
    notes: "Meta associada pela tela Metas por Pessoa.",
  });
}

async function persistRowTargets({
  targets,
  saveTargetAllocation,
  deleteTargetAllocation,
}: {
  targets: Array<{
    existing?: TargetAllocation;
    amount: number;
    customerId: string;
    personId: string;
    year: number;
    type: TargetAllocationType;
  }>;
  saveTargetAllocation: (allocation: TargetAllocation) => Promise<void>;
  deleteTargetAllocation: (id: string) => Promise<void>;
}) {
  const orderedTargets = [...targets].sort((left, right) => {
    const leftDelta = left.amount - (left.existing?.amount ?? 0);
    const rightDelta = right.amount - (right.existing?.amount ?? 0);
    return leftDelta - rightDelta;
  });

  for (const target of orderedTargets) {
    await persistTypeTarget({
      ...target,
      saveTargetAllocation,
      deleteTargetAllocation,
    });
  }
}

function sumOtherPeopleAllocations(allocations: TargetAllocation[], customerId: string, personId: string, year: number) {
  return allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.personId !== personId && allocation.year === year)
    .reduce((total, allocation) => total + allocation.amount, 0);
}

function getClientStatus(target: number, allocated: number): ClientStatus {
  if (Math.abs(target - allocated) <= 0.01) return "ok";
  if (allocated > target) return "over";
  return "pending";
}

function getCustomerTarget(customer: Customer) {
  return getFinancialCustomerMetric(customer.name, "revenueTarget") || customer.revenue;
}

function getInputValue(value: number) {
  return value ? String(value) : "";
}

function parseAmount(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar a associação de metas. Verifique permissões, valores e conexão.";
}
