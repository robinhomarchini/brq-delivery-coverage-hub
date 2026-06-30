"use client";

import { Plus, Save, Target, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type InputHTMLAttributes } from "react";
import type { Customer, Person, TargetAllocation, TargetAllocationType } from "@/data/mockData";
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
import { isTargetAssignableRole } from "@/lib/roles";

const currentYear = 2026;

type DraftAmounts = Record<string, { hunter: string; farmerRenewal: string }>;
type AllocationField = "hunter" | "farmerRenewal";

export function PersonTargetAssignment() {
  const initialParams = useMemo(() => getInitialTargetParams(), []);
  const { people, customers, targetAllocations, savePersonCustomerTargets, removePersonCustomerTargets } = useDeliveryStore();
  const activePeople = useMemo(() => people.filter((person) => person.active), [people]);
  const assignablePeople = useMemo(() =>
    activePeople.filter((person) => isTargetAssignableRole(person.roleType)),
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
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialParams.customerId);
  const [customerToAdd, setCustomerToAdd] = useState("");
  const [savingCustomerId, setSavingCustomerId] = useState("");
  const [removingCustomerId, setRemovingCustomerId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const effectivePersonId = assignablePeople.some((person) => person.id === personId)
    ? personId
    : "";
  const selectedPerson = assignablePeople.find((person) => person.id === effectivePersonId);
  const visibleCustomerIds = useMemo(
    () => buildVisibleCustomerIds(selectedPerson?.clientIds ?? [], targetAllocations, effectivePersonId, year, extraCustomerIds),
    [effectivePersonId, extraCustomerIds, selectedPerson?.clientIds, targetAllocations, year],
  );
  const visibleCustomers = useMemo(
    () => customers.filter((customer) => visibleCustomerIds.has(customer.id)),
    [customers, visibleCustomerIds],
  );
  const effectiveSelectedCustomerId = visibleCustomerIds.has(selectedCustomerId) ? selectedCustomerId : "";
  const scopedVisibleCustomers = useMemo(
    () => effectiveSelectedCustomerId
      ? visibleCustomers.filter((customer) => customer.id === effectiveSelectedCustomerId)
      : visibleCustomers,
    [effectiveSelectedCustomerId, visibleCustomers],
  );
  const availableCustomersToAdd = useMemo(
    () => effectivePersonId ? customers.filter((customer) => !visibleCustomerIds.has(customer.id)) : [],
    [customers, effectivePersonId, visibleCustomerIds],
  );
  const effectiveCustomerToAdd = availableCustomersToAdd.some((customer) => customer.id === customerToAdd)
    ? customerToAdd
    : availableCustomersToAdd[0]?.id ?? "";
  const rows = useMemo(
    () => scopedVisibleCustomers.map((customer) => buildRow(
      customer,
      effectivePersonId,
      year,
      targetAllocations,
      drafts[customer.id],
      people,
      selectedPerson,
      getRowSource(customer.id, selectedPerson?.clientIds ?? [], targetAllocations, effectivePersonId, year, extraCustomerIds),
    )),
    [drafts, effectivePersonId, extraCustomerIds, people, scopedVisibleCustomers, selectedPerson, targetAllocations, year],
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

  function changeFocusedCustomer(customerId: string) {
    setSelectedCustomerId(customerId);
    if (!customerId) return;
    setExtraCustomerIds((current) => current.includes(customerId) ? current : [...current, customerId]);
  }

  async function saveCustomerTargets(row: PersonTargetRow) {
    if (!effectivePersonId) {
      setErrorMessage("Selecione uma pessoa antes de salvar.");
      return;
    }

    const nextHunterAmount = parseAmount(drafts[row.customerId]?.hunter ?? row.hunterInput);
    const nextFarmerRenewalAmount = parseAmount(drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput);
    await persistCustomerTargets(row, nextHunterAmount, nextFarmerRenewalAmount);
  }

  async function removeCustomerFromPerson(row: PersonTargetRow) {
    if (!effectivePersonId || !selectedPerson) {
      setErrorMessage("Selecione uma pessoa antes de remover o cliente.");
      return;
    }

    const confirmed = window.confirm(
      `Remover ${row.customerName} de ${selectedPerson.name}?\n\nO vínculo pessoa-cliente será removido e todas as metas dessa pessoa para este cliente serão zeradas.`,
    );
    if (!confirmed) return;

    try {
      setRemovingCustomerId(row.customerId);
      setErrorMessage("");
      await removePersonCustomerTargets({
        customerId: row.customerId,
        personId: effectivePersonId,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.customerId];
        return next;
      });
      setExtraCustomerIds((current) => current.filter((customerId) => customerId !== row.customerId));
      if (selectedCustomerId === row.customerId) {
        setSelectedCustomerId("");
      }
      setSuccessMessage(`${row.customerName} removido de ${selectedPerson.name}. Metas da pessoa para este cliente foram zeradas.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setErrorMessage(getFormErrorMessage(error));
    } finally {
      setRemovingCustomerId("");
    }
  }

  async function quickAllocateCustomerTarget(row: PersonTargetRow, field: AllocationField) {
    if (!effectivePersonId || !selectedPerson) {
      setErrorMessage("Selecione uma pessoa antes de alocar a meta.");
      return;
    }

    const label = field === "hunter" ? "Hunter" : "Renovação + Ampliação";
    const availableAmount = roundCurrency(Math.max(0, field === "hunter"
      ? row.customerHunterTarget - row.otherPeopleHunterTotal
      : row.customerFarmerRenewalTarget - row.otherPeopleFarmerRenewalTotal));

    if (availableAmount <= 0.01) {
      setErrorMessage(`Não há saldo disponível de ${label} para ${row.customerName}. Revise as pessoas já associadas antes de realocar.`);
      return;
    }

    const confirmed = window.confirm(
      `Alocar ${formatCurrency(availableAmount)} como meta ${label} para ${selectedPerson.name} em ${row.customerName}?\n\nA alteração será salva imediatamente para ${year}.`,
    );
    if (!confirmed) return;

    await persistCustomerTargets(
      row,
      field === "hunter" ? availableAmount : row.hunterAmount,
      field === "farmerRenewal" ? availableAmount : row.farmerRenewalAmount,
      `Meta ${label} de ${selectedPerson.name} em ${row.customerName} alocada com sucesso.`,
    );
  }

  async function persistCustomerTargets(
    row: PersonTargetRow,
    nextHunterAmount: number,
    nextFarmerRenewalAmount: number,
    successText?: string,
  ) {
    if (!effectivePersonId) {
      setErrorMessage("Selecione uma pessoa antes de salvar.");
      return;
    }

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
        : successText ?? `Metas de ${selectedPerson?.name ?? "pessoa"} em ${row.customerName} salvas.`);
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

      <Card className="mb-5 grid gap-4 p-5 shadow-sm lg:grid-cols-[2fr_2fr_1fr_1fr_1fr]">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Pessoa</span>
          <Select value={effectivePersonId} onChange={(event) => {
            setPersonId(event.target.value);
            setDrafts({});
            const retainedCustomerId = selectedCustomerId || initialParams.customerId;
            setExtraCustomerIds(retainedCustomerId ? [retainedCustomerId] : []);
          }}>
            <option value="">Selecione uma pessoa</option>
            {assignablePeople.map((person) => (
              <option key={person.id} value={person.id}>{person.name} · {person.roleType}</option>
            ))}
          </Select>
          <span className="mt-1 block text-xs text-slate-400">Escolha uma pessoa lançável. Executivo, Diretores e Staff aparecem apenas nas consolidações.</span>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Cliente em foco</span>
          <Select
            value={effectivePersonId ? selectedCustomerId : ""}
            onChange={(event) => changeFocusedCustomer(event.target.value)}
            disabled={!effectivePersonId}
          >
            {!effectivePersonId ? (
              <option value="">Selecione uma pessoa primeiro</option>
            ) : (
              <>
                <option value="">Todos os clientes da pessoa</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </>
            )}
          </Select>
          <span className="mt-1 block text-xs text-slate-400">Ao vir de Clientes, o cliente já fica selecionado aqui.</span>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Ano</span>
          <Select value={String(year)} onChange={(event) => {
            setYear(Number(event.target.value));
            setDrafts({});
            const retainedCustomerId = selectedCustomerId || initialParams.customerId;
            setExtraCustomerIds(retainedCustomerId ? [retainedCustomerId] : []);
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
          <Select value={effectiveCustomerToAdd} onChange={(event) => setCustomerToAdd(event.target.value)} disabled={!effectivePersonId || !availableCustomersToAdd.length}>
            {!effectivePersonId
              ? <option value="">Selecione uma pessoa primeiro</option>
              : !availableCustomersToAdd.length && <option value="">Todos os clientes já estão na grade</option>}
            {availableCustomersToAdd.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </Select>
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            disabled={!effectivePersonId || !effectiveCustomerToAdd}
            onClick={() => {
              if (!effectiveCustomerToAdd) return;
              setExtraCustomerIds((current) => current.includes(effectiveCustomerToAdd) ? current : [...current, effectiveCustomerToAdd]);
              setSelectedCustomerId(effectiveCustomerToAdd);
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
          <Table className="min-w-[1760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Meta do Cliente</TableHead>
                <TableHead>Já associado a outras pessoas</TableHead>
                <TableHead>Hunters / Farmers</TableHead>
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
                      hunterAction={{
                        onClick: () => quickAllocateCustomerTarget(row, "hunter"),
                        title: `Clique para alocar o saldo Hunter em ${selectedPerson?.name ?? "pessoa selecionada"}`,
                      }}
                      farmerRenewalAction={{
                        onClick: () => quickAllocateCustomerTarget(row, "farmerRenewal"),
                        title: `Clique para alocar o saldo de Renovação + Ampliação em ${selectedPerson?.name ?? "pessoa selecionada"}`,
                      }}
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
                    <TargetPeopleSummary hunterPeople={row.hunterPeople} farmerRenewalPeople={row.farmerRenewalPeople} />
                  </TableCell>
                  <TableCell>
                    <TargetGapBreakdown
                      hunter={row.hunterGap}
                      farmerRenewal={row.farmerRenewalGap}
                      total={row.customerTarget - row.clientTotal}
                    />
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      value={drafts[row.customerId]?.hunter ?? row.hunterInput}
                      onChange={(event) => updateDraft(row.customerId, "hunter", event.target.value)}
                      aria-label={`Meta Hunter para ${row.customerName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      value={drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput}
                      onChange={(event) => updateDraft(row.customerId, "farmerRenewal", event.target.value)}
                      aria-label={`Meta Renovação + Ampliação para ${row.customerName}`}
                    />
                  </TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(row.personTotal)}</TableCell>
                  <TableCell><ClientStatusBadge status={row.clientStatus} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 hover:text-red-800"
                        onClick={() => removeCustomerFromPerson(row)}
                        disabled={savingCustomerId === row.customerId || removingCustomerId === row.customerId}
                      >
                        <Trash2 className="h-4 w-4" />
                        {removingCustomerId === row.customerId ? "Removendo..." : "Remover"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveCustomerTargets(row)}
                        disabled={savingCustomerId === row.customerId || removingCustomerId === row.customerId}
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
              {effectivePersonId
                ? "Esta pessoa ainda não possui clientes associados nem metas lançadas neste ano. Use “Incluir cliente para meta” para começar."
                : "Selecione uma pessoa para carregar os clientes associados e lançar metas."}
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
type TargetPerson = {
  personId: string;
  name: string;
  roleType: string;
  amount: number;
  isDraft: boolean;
};
type BreakdownLineAction = {
  onClick: () => void;
  title: string;
};

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

function TargetBreakdown({
  hunter,
  farmerRenewal,
  total,
  hunterAction,
  farmerRenewalAction,
}: {
  hunter: number;
  farmerRenewal: number;
  total: number;
  hunterAction?: BreakdownLineAction;
  farmerRenewalAction?: BreakdownLineAction;
}) {
  return (
    <div className="min-w-40 space-y-1 text-xs">
      <BreakdownLine label="Hunter" value={hunter} action={hunterAction} />
      <BreakdownLine label="Renov. + Ampl." value={farmerRenewal} action={farmerRenewalAction} />
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

function TargetPeopleSummary({ hunterPeople, farmerRenewalPeople }: { hunterPeople: TargetPerson[]; farmerRenewalPeople: TargetPerson[] }) {
  return (
    <div className="min-w-56 space-y-3 text-xs">
      <TargetPeopleGroup label="Hunters" people={hunterPeople} emptyLabel="Sem hunter alocado" tone="orange" />
      <TargetPeopleGroup label="Farmers / Delivery" people={farmerRenewalPeople} emptyLabel="Sem farmer/delivery alocado" tone="purple" />
    </div>
  );
}

function TargetPeopleGroup({ label, people, emptyLabel, tone }: { label: string; people: TargetPerson[]; emptyLabel: string; tone: "orange" | "purple" }) {
  const toneClassName = tone === "orange"
    ? "bg-orange-50 text-orange-800"
    : "bg-purple-50 text-brq-purple";

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {people.length ? (
        <div className="flex flex-wrap gap-1.5">
          {people.map((person) => (
            <span key={`${label}-${person.personId}`} className={`rounded-full px-2 py-1 font-semibold ${toneClassName}`} title={`${person.name} · ${formatCurrency(person.amount)}`}>
              {person.name}
              <span className="ml-1 opacity-70">{formatCurrency(person.amount)}</span>
              {person.isDraft && <span className="ml-1 text-[10px] opacity-70">(edição)</span>}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-slate-400">{emptyLabel}</p>
      )}
    </div>
  );
}

function BreakdownLine({
  label,
  value,
  tone = "neutral",
  action,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "pending" | "over";
  action?: BreakdownLineAction;
}) {
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
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          title={action.title}
          className={`rounded-md px-1 text-right font-semibold underline decoration-dotted underline-offset-4 transition hover:bg-purple-50 hover:text-brq-purple focus:outline-none focus:ring-2 focus:ring-purple-100 ${toneClassName}`}
        >
          {formatCurrency(value)}
        </button>
      ) : (
        <span className={`font-semibold ${toneClassName}`}>{formatCurrency(value)}</span>
      )}
    </div>
  );
}

function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex min-w-[180px] items-center rounded-2xl border bg-white px-3 focus-within:ring-2 focus-within:ring-purple-100">
      <span className="mr-2 text-sm font-semibold text-slate-400">R$</span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="h-12 border-0 px-0 text-right text-base font-semibold tabular-nums shadow-none outline-none focus:ring-0"
        onFocus={(event) => event.currentTarget.select()}
        onDoubleClick={(event) => event.currentTarget.select()}
      />
    </div>
  );
}

function buildRow(
  customer: Customer,
  personId: string,
  year: number,
  allocations: TargetAllocation[],
  draft: { hunter: string; farmerRenewal: string } | undefined,
  people: Person[],
  selectedPerson: Person | undefined,
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
  const hunterPeople = buildTargetPeople(allocations, people, customer.id, year, "hunter", selectedPerson, hunterAmount);
  const farmerRenewalPeople = buildTargetPeople(allocations, people, customer.id, year, "farmer_renewal", selectedPerson, farmerRenewalAmount);

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
    hunterPeople,
    farmerRenewalPeople,
    hunterInput: getInputValue(hunterAllocation?.amount ?? 0),
    farmerRenewalInput: getInputValue(farmerRenewalAllocation?.amount ?? 0),
    personTotal: hunterAmount + farmerRenewalAmount,
    clientStatus: getClientStatus(targetBreakdown.hunter, clientHunterTotal, targetBreakdown.farmerRenewal, clientFarmerRenewalTotal),
    source,
  };
}

function buildTargetPeople(
  allocations: TargetAllocation[],
  people: Person[],
  customerId: string,
  year: number,
  type: TargetAllocationType,
  selectedPerson: Person | undefined,
  selectedAmount: number,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rowsByPerson = new Map<string, TargetPerson>();

  allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year && allocation.type === type)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const amount = selectedPerson?.id === allocation.personId ? selectedAmount : allocation.amount;
      if (amount <= 0.01) return;
      rowsByPerson.set(allocation.personId, {
        personId: allocation.personId,
        name: person?.name ?? allocation.personId,
        roleType: person?.roleType ?? "Sem perfil",
        amount,
        isDraft: selectedPerson?.id === allocation.personId && Math.abs(selectedAmount - allocation.amount) > 0.01,
      });
    });

  if (selectedPerson && selectedAmount > 0.01 && !rowsByPerson.has(selectedPerson.id)) {
    rowsByPerson.set(selectedPerson.id, {
      personId: selectedPerson.id,
      name: selectedPerson.name,
      roleType: selectedPerson.roleType,
      amount: selectedAmount,
      isDraft: true,
    });
  }

  return Array.from(rowsByPerson.values())
    .sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name));
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
  if (!personId) return new Set<string>();
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
  return roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget);
}

function getCustomerTargetBreakdown(customer: Customer, allocations: TargetAllocation[], year: number) {
  void allocations;
  void year;
  return {
    hunter: roundCurrency(customer.hunterTarget),
    farmerRenewal: roundCurrency(customer.farmerRenewalTarget),
  };
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
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseAmount(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : isThousandSeparatedAmount(sanitized)
      ? sanitized.replace(/\./g, "")
      : sanitized;
  const parsed = Number(normalized || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isThousandSeparatedAmount(value: string) {
  return /^\d{1,3}(\.\d{3})+$/.test(value);
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
