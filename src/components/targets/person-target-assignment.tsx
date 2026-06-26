"use client";

import { Plus, Save, Target, UserRound } from "lucide-react";
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
  const initialParams = useMemo(() => getInitialTargetParams(), []);
  const { people, customers, targetAllocations, savePersonCustomerTargets } = useDeliveryStore();
  const activePeople = useMemo(() => people.filter((person) => person.active), [people]);
  const assignablePeople = useMemo(() =>
    activePeople.filter((person) => person.roleType !== "Executive" && person.roleType !== "Director" && person.roleType !== "Staff"),
    [activePeople],
  );
  const years = useMemo(
    () => Array.from(new Set([currentYear, ...targetAllocations.map((allocation) => allocation.year)])).sort((a, b) => b - a),
    [targetAllocations],
  );
  const [personId, setPersonId] = useState(initialParams.personId);
  const [year, setYear] = useState(initialParams.year ?? currentYear);
  const [drafts, setDrafts] = useState<DraftAmounts>({});
  const [extraCustomerIds, setExtraCustomerIds] = useState<string[]>(initialParams.customerId ? [initialParams.customerId] : []);
  const [customerToAdd, setCustomerToAdd] = useState("");
  const [savingCustomerId, setSavingCustomerId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const effectivePersonId = assignablePeople.some((person) => person.id === personId)
    ? personId
    : assignablePeople[0]?.id ?? "";
  const selectedPerson = assignablePeople.find((person) => person.id === effectivePersonId);
  const visibleCustomerIds = useMemo(
    () => buildVisibleCustomerIds(selectedPerson?.clientIds ?? [], targetAllocations, effectivePersonId, year, extraCustomerIds),
    [effectivePersonId, extraCustomerIds, selectedPerson?.clientIds, targetAllocations, year],
  );
  const visibleCustomers = useMemo(
    () => customers.filter((customer) => visibleCustomerIds.has(customer.id)),
    [customers, visibleCustomerIds],
  );
  const availableCustomersToAdd = useMemo(
    () => customers.filter((customer) => !visibleCustomerIds.has(customer.id)),
    [customers, visibleCustomerIds],
  );
  const effectiveCustomerToAdd = availableCustomersToAdd.some((customer) => customer.id === customerToAdd)
    ? customerToAdd
    : availableCustomersToAdd[0]?.id ?? "";
  const rows = useMemo(
    () => visibleCustomers.map((customer) => buildRow(
      customer,
      effectivePersonId,
      year,
      targetAllocations,
      drafts[customer.id],
      getRowSource(customer.id, selectedPerson?.clientIds ?? [], targetAllocations, effectivePersonId, year, extraCustomerIds),
    )),
    [drafts, effectivePersonId, extraCustomerIds, selectedPerson?.clientIds, targetAllocations, visibleCustomers, year],
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
    if (!effectivePersonId) {
      setErrorMessage("Selecione uma pessoa antes de salvar.");
      return;
    }

    const nextHunterAmount = parseAmount(drafts[row.customerId]?.hunter ?? row.hunterInput);
    const nextFarmerRenewalAmount = parseAmount(drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput);
    const currentOtherPeopleTotal = sumOtherPeopleAllocations(targetAllocations, row.customerId, effectivePersonId, year);
    const nextCustomerTotal = currentOtherPeopleTotal + nextHunterAmount + nextFarmerRenewalAmount;
    const overAmount = nextCustomerTotal - row.customerTarget;

    if (overAmount > 0.01) {
      const increaseType = getIncreaseType({
        currentHunterAmount: row.hunterAllocation?.amount ?? 0,
        nextHunterAmount,
        currentFarmerRenewalAmount: row.farmerRenewalAllocation?.amount ?? 0,
        nextFarmerRenewalAmount,
      });
      const confirmed = window.confirm(
        `A soma das metas das pessoas em ${row.customerName} ficará ${formatCurrency(overAmount)} acima da meta atual do cliente.\n\nDeseja aumentar a meta do cliente para ${formatCurrency(nextCustomerTotal)}? Origem do acréscimo: ${increaseType}.`,
      );
      if (!confirmed) return;
    }

    try {
      setSavingCustomerId(row.customerId);
      setErrorMessage("");
      await savePersonCustomerTargets({
        customerId: row.customerId,
        personId: effectivePersonId,
        year,
        hunterAmount: nextHunterAmount,
        farmerRenewalAmount: nextFarmerRenewalAmount,
        increaseCustomerTarget: overAmount > 0.01,
        notes: "Meta associada pela tela Metas por Pessoa.",
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.customerId];
        return next;
      });
      setSuccessMessage(overAmount > 0.01
        ? `Metas salvas e meta do cliente ${row.customerName} aumentada para ${formatCurrency(nextCustomerTotal)}.`
        : `Metas de ${selectedPerson?.name ?? "pessoa"} em ${row.customerName} salvas.`);
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
        description="Associe metas por pessoa lançável, cliente e ano. Robinson, Ane e CA consolidam subordinados e não recebem metas diretas nesta tela."
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {errorMessage && <ErrorNotice message={errorMessage} floating onClose={() => setErrorMessage("")} />}

      <Card className="mb-5 grid gap-4 p-5 shadow-sm lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Pessoa</span>
          <Select value={effectivePersonId} onChange={(event) => {
            setPersonId(event.target.value);
            setDrafts({});
            setExtraCustomerIds([]);
          }}>
            {assignablePeople.map((person) => (
              <option key={person.id} value={person.id}>{person.name} · {person.roleType}</option>
            ))}
          </Select>
          <span className="mt-1 block text-xs text-slate-400">Executivo e Diretores aparecem apenas nas consolidações.</span>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Ano</span>
          <Select value={String(year)} onChange={(event) => {
            setYear(Number(event.target.value));
            setDrafts({});
            setExtraCustomerIds([]);
          }}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </label>
        <Summary label="Meta Hunter" value={formatCurrency(totals.hunter)} />
        <Summary label="Renovação + Ampliação" value={formatCurrency(totals.farmerRenewal)} />
      </Card>

      <Card className="mb-5 grid gap-3 p-5 shadow-sm lg:grid-cols-[1fr_auto]">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Incluir cliente para meta</span>
          <Select value={effectiveCustomerToAdd} onChange={(event) => setCustomerToAdd(event.target.value)} disabled={!availableCustomersToAdd.length}>
            {!availableCustomersToAdd.length && <option value="">Todos os clientes já estão na grade</option>}
            {availableCustomersToAdd.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </Select>
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            disabled={!effectiveCustomerToAdd}
            onClick={() => {
              if (!effectiveCustomerToAdd) return;
              setExtraCustomerIds((current) => current.includes(effectiveCustomerToAdd) ? current : [...current, effectiveCustomerToAdd]);
            }}
          >
            <Plus className="h-4 w-4" />
            Incluir cliente
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-50 text-brq-purple">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{selectedPerson?.name ?? "Pessoa não selecionada"}</h2>
              <p className="text-xs text-slate-500">A grade começa com clientes associados na tela Pessoas e metas já existentes no ano. Inclua novos clientes quando necessário.</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Meta do Cliente</TableHead>
                <TableHead>Já associado a outras pessoas</TableHead>
                <TableHead>Gap após edição</TableHead>
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
                  <TableCell><SourceBadge source={row.source} /></TableCell>
                  <TableCell>
                    <TargetBreakdown
                      hunter={row.customerHunterTarget}
                      farmerRenewal={row.customerFarmerRenewalTarget}
                      total={row.customerTarget}
                    />
                  </TableCell>
                  <TableCell>
                    <TargetBreakdown
                      hunter={row.otherPeopleHunterTotal}
                      farmerRenewal={row.otherPeopleFarmerRenewalTotal}
                      total={row.otherPeopleTotal}
                    />
                  </TableCell>
                  <TableCell>
                    <TargetGapBreakdown
                      hunter={row.hunterGap}
                      farmerRenewal={row.farmerRenewalGap}
                      total={row.customerTarget - row.clientTotal}
                    />
                  </TableCell>
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
          {!rows.length && (
            <div className="p-8 text-center text-sm text-slate-500">
              Esta pessoa ainda não possui clientes associados nem metas lançadas neste ano. Use “Incluir cliente para meta” para começar.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

type PersonTargetRow = ReturnType<typeof buildRow>;
type ClientStatus = "ok" | "pending" | "over";
type RowSource = "assigned" | "existing_target" | "added";

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

function SourceBadge({ source }: { source: RowSource }) {
  if (source === "assigned") return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Cliente associado</Badge>;
  if (source === "existing_target") return <Badge className="bg-purple-100 text-brq-purple hover:bg-purple-100">Meta existente</Badge>;
  return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Incluído agora</Badge>;
}

function TargetBreakdown({ hunter, farmerRenewal, total }: { hunter: number; farmerRenewal: number; total: number }) {
  return (
    <div className="min-w-40 space-y-1 text-xs">
      <BreakdownLine label="Hunter" value={hunter} />
      <BreakdownLine label="Renov. + Ampl." value={farmerRenewal} />
      <div className="border-t pt-1 font-bold text-slate-950">{formatCurrency(total)}</div>
    </div>
  );
}

function TargetGapBreakdown({ hunter, farmerRenewal, total }: { hunter: number; farmerRenewal: number; total: number }) {
  return (
    <div className="min-w-40 space-y-1 text-xs">
      <BreakdownLine label="Hunter" value={hunter} tone={getGapTone(hunter)} />
      <BreakdownLine label="Renov. + Ampl." value={farmerRenewal} tone={getGapTone(farmerRenewal)} />
      <div className={`border-t pt-1 font-bold ${getGapClassName(total)}`}>{formatCurrency(total)}</div>
    </div>
  );
}

function BreakdownLine({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ok" | "pending" | "over" }) {
  const toneClassName = tone === "ok"
    ? "text-emerald-700"
    : tone === "pending"
      ? "text-amber-700"
      : tone === "over"
        ? "text-red-700"
        : "text-slate-700";

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${toneClassName}`}>{formatCurrency(value)}</span>
    </div>
  );
}

function buildRow(
  customer: Customer,
  personId: string,
  year: number,
  allocations: TargetAllocation[],
  draft: { hunter: string; farmerRenewal: string } | undefined,
  source: RowSource,
) {
  const hunterAllocation = findAllocation(allocations, customer.id, personId, year, "hunter");
  const farmerRenewalAllocation = findAllocation(allocations, customer.id, personId, year, "farmer_renewal");
  const hunterAmount = parseAmount(draft?.hunter ?? getInputValue(hunterAllocation?.amount ?? 0));
  const farmerRenewalAmount = parseAmount(draft?.farmerRenewal ?? getInputValue(farmerRenewalAllocation?.amount ?? 0));
  const targetBreakdown = getCustomerTargetBreakdown(customer, allocations, year);
  const otherPeopleHunterTotal = sumOtherPeopleAllocations(allocations, customer.id, personId, year, "hunter");
  const otherPeopleFarmerRenewalTotal = sumOtherPeopleAllocations(allocations, customer.id, personId, year, "farmer_renewal");
  const otherPeopleTotal = otherPeopleHunterTotal + otherPeopleFarmerRenewalTotal;
  const customerTarget = getCustomerTarget(customer);
  const clientHunterTotal = otherPeopleHunterTotal + hunterAmount;
  const clientFarmerRenewalTotal = otherPeopleFarmerRenewalTotal + farmerRenewalAmount;
  const clientTotal = clientHunterTotal + clientFarmerRenewalTotal;

  return {
    customerId: customer.id,
    customer,
    customerName: customer.name,
    industry: customer.industry,
    customerTarget,
    customerHunterTarget: targetBreakdown.hunter,
    customerFarmerRenewalTarget: targetBreakdown.farmerRenewal,
    otherPeopleHunterTotal,
    otherPeopleFarmerRenewalTotal,
    otherPeopleTotal,
    clientHunterTotal,
    clientFarmerRenewalTotal,
    clientTotal,
    hunterGap: targetBreakdown.hunter - clientHunterTotal,
    farmerRenewalGap: targetBreakdown.farmerRenewal - clientFarmerRenewalTotal,
    hunterAllocation,
    farmerRenewalAllocation,
    hunterAmount,
    farmerRenewalAmount,
    hunterInput: getInputValue(hunterAllocation?.amount ?? 0),
    farmerRenewalInput: getInputValue(farmerRenewalAllocation?.amount ?? 0),
    personTotal: hunterAmount + farmerRenewalAmount,
    clientStatus: getClientStatus(targetBreakdown.hunter, clientHunterTotal, targetBreakdown.farmerRenewal, clientFarmerRenewalTotal),
    source,
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

function sumOtherPeopleAllocations(
  allocations: TargetAllocation[],
  customerId: string,
  personId: string,
  year: number,
  type?: TargetAllocationType,
) {
  return allocations
    .filter((allocation) =>
      allocation.customerId === customerId
      && allocation.personId !== personId
      && allocation.year === year
      && (!type || allocation.type === type)
    )
    .reduce((total, allocation) => total + allocation.amount, 0);
}

function buildVisibleCustomerIds(
  assignedCustomerIds: string[],
  allocations: TargetAllocation[],
  personId: string,
  year: number,
  extraCustomerIds: string[],
) {
  return new Set([
    ...assignedCustomerIds,
    ...allocations
      .filter((allocation) => allocation.personId === personId && allocation.year === year)
      .map((allocation) => allocation.customerId),
    ...extraCustomerIds,
  ]);
}

function getRowSource(
  customerId: string,
  assignedCustomerIds: string[],
  allocations: TargetAllocation[],
  personId: string,
  year: number,
  extraCustomerIds: string[],
): RowSource {
  if (assignedCustomerIds.includes(customerId)) return "assigned";
  if (allocations.some((allocation) => allocation.customerId === customerId && allocation.personId === personId && allocation.year === year)) {
    return "existing_target";
  }
  if (extraCustomerIds.includes(customerId)) return "added";
  return "added";
}

function getClientStatus(hunterTarget: number, hunterAllocated: number, farmerRenewalTarget: number, farmerRenewalAllocated: number): ClientStatus {
  if (hunterAllocated > hunterTarget + 0.01 || farmerRenewalAllocated > farmerRenewalTarget + 0.01) return "over";
  if (Math.abs(hunterTarget - hunterAllocated) <= 0.01 && Math.abs(farmerRenewalTarget - farmerRenewalAllocated) <= 0.01) return "ok";
  return "pending";
}

function getCustomerTarget(customer: Customer) {
  return customer.revenue || getFinancialCustomerMetric(customer.name, "revenueTarget");
}

function getCustomerTargetBreakdown(customer: Customer, allocations: TargetAllocation[], year: number) {
  const customerTarget = getCustomerTarget(customer);
  const importedHunter = getFinancialCustomerMetric(customer.name, "hunterRevenue");
  const importedFarmerRenewal = getFinancialCustomerMetric(customer.name, "deliveryFarmerRevenue");
  const importedTotal = importedHunter + importedFarmerRenewal;

  if (customerTarget <= 0) return { hunter: 0, farmerRenewal: 0 };
  if (importedTotal <= 0) return { hunter: 0, farmerRenewal: customerTarget };

  const difference = customerTarget - importedTotal;
  if (Math.abs(difference) <= 0.01) {
    return { hunter: importedHunter, farmerRenewal: importedFarmerRenewal };
  }

  if (difference < -0.01) {
    const ratio = customerTarget / importedTotal;
    const hunter = roundCurrency(importedHunter * ratio);
    return { hunter, farmerRenewal: roundCurrency(customerTarget - hunter) };
  }

  const allocatedHunter = sumCustomerAllocations(allocations, customer.id, year, "hunter");
  const allocatedFarmerRenewal = sumCustomerAllocations(allocations, customer.id, year, "farmer_renewal");
  const hunterOverImported = Math.max(0, allocatedHunter - importedHunter);
  const farmerRenewalOverImported = Math.max(0, allocatedFarmerRenewal - importedFarmerRenewal);
  const overImportedTotal = hunterOverImported + farmerRenewalOverImported;

  if (overImportedTotal > 0.01) {
    const hunterIncrease = roundCurrency(difference * (hunterOverImported / overImportedTotal));
    return {
      hunter: importedHunter + hunterIncrease,
      farmerRenewal: roundCurrency(customerTarget - importedHunter - hunterIncrease),
    };
  }

  const hunterRatio = importedHunter / importedTotal;
  const hunter = roundCurrency(importedHunter + difference * hunterRatio);
  return { hunter, farmerRenewal: roundCurrency(customerTarget - hunter) };
}

function sumCustomerAllocations(allocations: TargetAllocation[], customerId: string, year: number, type: TargetAllocationType) {
  return allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year && allocation.type === type)
    .reduce((total, allocation) => total + allocation.amount, 0);
}

function getGapTone(value: number) {
  if (value < -0.01) return "over";
  if (value > 0.01) return "pending";
  return "ok";
}

function getGapClassName(value: number) {
  const tone = getGapTone(value);
  if (tone === "over") return "text-red-700";
  if (tone === "pending") return "text-amber-700";
  return "text-emerald-700";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
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

function getInitialTargetParams() {
  if (typeof window === "undefined") return { customerId: "", personId: "", year: undefined as number | undefined };
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  return {
    customerId: params.get("customerId") ?? "",
    personId: params.get("personId") ?? "",
    year: Number.isFinite(year) && year >= 2020 && year <= 2100 ? year : undefined,
  };
}

function getIncreaseType({
  currentHunterAmount,
  nextHunterAmount,
  currentFarmerRenewalAmount,
  nextFarmerRenewalAmount,
}: {
  currentHunterAmount: number;
  nextHunterAmount: number;
  currentFarmerRenewalAmount: number;
  nextFarmerRenewalAmount: number;
}) {
  const hunterDelta = nextHunterAmount - currentHunterAmount;
  const farmerRenewalDelta = nextFarmerRenewalAmount - currentFarmerRenewalAmount;
  if (hunterDelta > 0.01 && farmerRenewalDelta > 0.01) return "Hunter e Renovação + Ampliação";
  if (hunterDelta > 0.01) return "Hunter";
  if (farmerRenewalDelta > 0.01) return "Renovação + Ampliação";
  return "redistribuição de metas";
}
