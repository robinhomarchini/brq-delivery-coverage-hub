"use client";

import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type InputHTMLAttributes } from "react";
import type { Customer, RoleType, StudioTargetAllocation, TargetAllocation, TargetAllocationType } from "@/data/mockData";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { getCustomerTotalTarget } from "@/lib/customer-target-total";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import { formatCurrency, toFileSlug } from "@/lib/utils";
import { isHunterRole, isSpecialistHunterRole, isTargetAssignableRole } from "@/lib/roles";
import { getEligibleStudioRenewalAmountForPerson, getStudioMaintenancePersonId } from "@/lib/studio-renewal-rollup";

const currentYear = defaultTargetYear;

type DraftAmounts = Record<string, { hunter: string; farmerRenewal: string }>;
type AllocationField = "hunter" | "farmerRenewal";

export function PersonTargetAssignment() {
  const router = useRouter();
  const initialParams = useMemo(() => getInitialTargetParams(), []);
  const { areas, people, customers, customerTargets, targetAllocations, studioTargetAllocations, specialistHunterStudioAssignments, savePersonCustomerTargets, removePersonCustomerTargets } = useDeliveryStore();
  const activePeople = useMemo(() => people.filter((person) => person.active), [people]);
  const assignablePeople = useMemo(() =>
    activePeople.filter((person) => isTargetAssignableRole(person.roleType) || isSpecialistHunterRole(person.roleType)),
    [activePeople],
  );
  const years = useMemo(
    () => Array.from(new Set([
      ...getAvailableTargetYears(customerTargets, currentYear),
      ...targetAllocations.map((allocation) => allocation.year),
      ...studioTargetAllocations.map((allocation) => allocation.year),
    ])).sort((a, b) => b - a),
    [customerTargets, studioTargetAllocations, targetAllocations],
  );
  const [personId, setPersonId] = useState(initialParams.personId);
  const [year, setYear] = useState(initialParams.year ?? currentYear);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
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
  const selectedPersonIsSpecialistHunter = Boolean(selectedPerson && isSpecialistHunterRole(selectedPerson.roleType));
  const visibleCustomerIds = useMemo(
    () => buildVisibleCustomerIds(people, selectedPerson?.clientIds ?? [], targetAllocations, studioTargetAllocations, effectivePersonId, year, extraCustomerIds),
    [effectivePersonId, extraCustomerIds, people, selectedPerson?.clientIds, studioTargetAllocations, targetAllocations, year],
  );
  const visibleCustomers = useMemo(
    () => yearCustomers.filter((customer) => visibleCustomerIds.has(customer.id)),
    [visibleCustomerIds, yearCustomers],
  );
  const effectiveSelectedCustomerId = visibleCustomerIds.has(selectedCustomerId) ? selectedCustomerId : "";
  const scopedVisibleCustomers = useMemo(
    () => effectiveSelectedCustomerId
      ? visibleCustomers.filter((customer) => customer.id === effectiveSelectedCustomerId)
      : visibleCustomers,
    [effectiveSelectedCustomerId, visibleCustomers],
  );
  const availableCustomersToAdd = useMemo(
    () => effectivePersonId ? yearCustomers.filter((customer) => !visibleCustomerIds.has(customer.id)) : [],
    [effectivePersonId, visibleCustomerIds, yearCustomers],
  );
  const effectiveCustomerToAdd = availableCustomersToAdd.some((customer) => customer.id === customerToAdd)
    ? customerToAdd
    : "";
  const rows = useMemo(
    () => scopedVisibleCustomers.map((customer) => buildRow(
      customer,
      people,
      effectivePersonId,
      year,
      targetAllocations,
      studioTargetAllocations,
      specialistHunterStudioAssignments,
      areas,
      drafts[customer.id],
      getRowSource(customer.id, people, selectedPerson?.clientIds ?? [], targetAllocations, studioTargetAllocations, effectivePersonId, year, extraCustomerIds),
      selectedPerson?.roleType,
    )),
    [areas, drafts, effectivePersonId, extraCustomerIds, people, scopedVisibleCustomers, selectedPerson?.clientIds, selectedPerson?.roleType, specialistHunterStudioAssignments, studioTargetAllocations, targetAllocations, year],
  );
  const totals = useMemo(() => rows.reduce((summary, row) => ({
    hunter: summary.hunter + row.hunterAmount,
    farmerRenewal: summary.farmerRenewal + row.farmerRenewalAmount,
  }), { hunter: 0, farmerRenewal: 0 }), [rows]);
  const expectedBaseTotal = useMemo(
    () => selectedPerson ? getExpectedBaseTotalForPerson(selectedPerson.roleType, rows) : 0,
    [rows, selectedPerson],
  );
  const personTargetReportRows = useMemo(() => rows.map((row) => ({
    personName: selectedPerson?.name ?? "",
    roleType: selectedPerson?.roleType ?? "",
    customerName: row.customerName,
    industry: row.industry,
    source: getSourceLabel(row.source),
    customerHunterTarget: row.customerHunterTarget,
    customerFarmerRenewalTarget: row.customerFarmerRenewalTarget,
    customerTarget: row.customerTarget,
    otherPeopleHunterTotal: row.otherPeopleHunterTotal,
    personHunterOwnTarget: row.hunterOwnAmount,
    personStudioHunterTarget: row.studioHunterAmount,
    otherPeopleFarmerRenewalTotal: row.otherPeopleFarmerRenewalTotal,
    otherPeopleTotal: row.otherPeopleTotal,
    hunterGap: row.hunterGap,
    farmerRenewalGap: row.farmerRenewalGap,
    customerGap: row.clientTotal - row.customerTarget,
    personHunterTarget: row.hunterAmount,
    personFarmerRenewalTarget: row.farmerRenewalAmount,
    personTotal: row.personTotal,
    clientStatus: getClientStatusLabel(row.clientStatus),
    year,
  })), [rows, selectedPerson?.name, selectedPerson?.roleType, year]);
  const personTargetReportColumns = useMemo<ReportColumn<(typeof personTargetReportRows)[number]>[]>(() => [
    { key: "personName", label: "Pessoa", value: (row) => row.personName },
    { key: "roleType", label: "Perfil", value: (row) => row.roleType },
    { key: "customerName", label: "Cliente", value: (row) => row.customerName },
    { key: "industry", label: "Indústria", value: (row) => row.industry },
    { key: "source", label: "Origem", value: (row) => row.source },
    { key: "customerHunterTarget", label: "Meta Hunter Cliente", value: (row) => row.customerHunterTarget, format: "currency", align: "right" },
    { key: "customerFarmerRenewalTarget", label: "Meta Renovação Cliente", value: (row) => row.customerFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "customerTarget", label: "Meta Total Cliente", value: (row) => row.customerTarget, format: "currency", align: "right" },
    { key: "otherPeopleHunterTotal", label: "Hunter já associado a outras pessoas", value: (row) => row.otherPeopleHunterTotal, format: "currency", align: "right" },
    { key: "personHunterOwnTarget", label: "Meta própria Hunter", value: (row) => row.personHunterOwnTarget, format: "currency", align: "right" },
    { key: "personStudioHunterTarget", label: "Meta herdada de Studios", value: (row) => row.personStudioHunterTarget, format: "currency", align: "right" },
    { key: "otherPeopleFarmerRenewalTotal", label: "Renovação já associada a outras pessoas", value: (row) => row.otherPeopleFarmerRenewalTotal, format: "currency", align: "right" },
    { key: "otherPeopleTotal", label: "Total já associado a outras pessoas", value: (row) => row.otherPeopleTotal, format: "currency", align: "right" },
    { key: "hunterGap", label: "Gap Hunter", value: (row) => row.hunterGap, format: "currency", align: "right" },
    { key: "farmerRenewalGap", label: "Gap Renovação", value: (row) => row.farmerRenewalGap, format: "currency", align: "right" },
    { key: "customerGap", label: "Gap Total", value: (row) => row.customerGap, format: "currency", align: "right" },
    { key: "personHunterTarget", label: "Meta Hunter Pessoa", value: (row) => row.personHunterTarget, format: "currency", align: "right" },
    { key: "personFarmerRenewalTarget", label: "Meta Renovação Pessoa", value: (row) => row.personFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "personTotal", label: "Total da Pessoa", value: (row) => row.personTotal, format: "currency", align: "right" },
    { key: "clientStatus", label: "Status do Cliente", value: (row) => row.clientStatus },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);

  function updateDraft(customerId: string, field: AllocationField, value: string) {
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

  function changePerson(nextPersonId: string) {
    const nextPerson = assignablePeople.find((person) => person.id === nextPersonId);
    setPersonId(nextPersonId);
    setDrafts({});
    setSelectedCustomerId("");
    setExtraCustomerIds([]);
    setCustomerToAdd("");
    setSavingCustomerId("");
    setRemovingCustomerId("");
    setErrorMessage("");
    setSuccessMessage("");

    if (nextPerson && isSpecialistHunterRole(nextPerson.roleType)) {
      const shouldOpenSpecialistScreen = window.confirm(
        `${nextPerson.name} é Hunter Especializado.\n\nEsse perfil não recebe lançamento direto nesta tela. Abrir a tela própria para selecionar as metas de Studio?`,
      );
      if (shouldOpenSpecialistScreen) {
        router.push(`/metas-hunters-especializados?personId=${encodeURIComponent(nextPerson.id)}&year=${year}`);
      }
    }
  }

  async function saveCustomerTargets(row: PersonTargetRow) {
    if (!effectivePersonId) {
      setErrorMessage("Selecione uma pessoa antes de salvar.");
      return;
    }
    if (selectedPersonIsSpecialistHunter) {
      setErrorMessage("Hunter Especializado não recebe lançamento direto. Ajuste os valores na tela Metas por Área/Studio.");
      return;
    }

    const nextHunterAmount = parseAmount(drafts[row.customerId]?.hunter ?? row.hunterInput);
    const nextFarmerRenewalAmount = parseAmount(drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput);
    await persistCustomerTargets(row, nextHunterAmount, nextFarmerRenewalAmount, 0);
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
    if (selectedPersonIsSpecialistHunter) {
      setErrorMessage("Hunter Especializado não recebe lançamento direto. A meta dele é derivada dos Studios do cliente.");
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
      0,
      `Meta ${label} de ${selectedPerson.name} em ${row.customerName} alocada com sucesso.`,
    );
  }

  async function persistCustomerTargets(
    row: PersonTargetRow,
    nextHunterAmount: number,
    nextFarmerRenewalTotalAmount: number,
    nextStudioAmount: number,
    successText?: string,
  ) {
    if (!effectivePersonId) {
      setErrorMessage("Selecione uma pessoa antes de salvar.");
      return;
    }
    if (selectedPersonIsSpecialistHunter) {
      setErrorMessage("Hunter Especializado não recebe lançamento direto. Ajuste os valores na tela Metas por Área/Studio.");
      return;
    }

    nextHunterAmount = roundCurrency(nextHunterAmount);
    nextFarmerRenewalTotalAmount = roundCurrency(nextFarmerRenewalTotalAmount);
    const nextHunterOwnAmount = roundCurrency(Math.max(nextHunterAmount - row.studioHunterAmount, 0));
    const nextFarmerRenewalOwnAmount = roundCurrency(Math.max(nextFarmerRenewalTotalAmount - row.studioRenewalAmount, 0));
    const currentOtherPeopleTotal = sumOtherPeopleAllocations(targetAllocations, row.customerId, effectivePersonId, year);
    const nextCustomerTotal = currentOtherPeopleTotal + nextHunterAmount + nextFarmerRenewalTotalAmount + nextStudioAmount;
    const overAmount = nextCustomerTotal - row.customerTarget;

    let increaseCustomerTarget = false;
    if (overAmount > 0.01) {
      const increaseType = getIncreaseType({
        currentHunterAmount: row.hunterAllocation?.amount ?? 0,
        nextHunterAmount,
        currentFarmerRenewalAmount: row.farmerRenewalAllocation?.amount ?? 0,
        nextFarmerRenewalAmount: nextFarmerRenewalTotalAmount,
        currentStudioAmount: 0,
        nextStudioAmount,
      });
      increaseCustomerTarget = window.confirm(
        `A soma das metas das pessoas em ${row.customerName} ficará ${formatCurrency(overAmount)} acima da meta atual do cliente.\n\nOK: aumentar a meta do cliente para ${formatCurrency(nextCustomerTotal)}.\nCancelar: manter a meta original e salvar a alocação como excedente para conciliação.\n\nOrigem do acréscimo: ${increaseType}.`,
      );
    }

    try {
      setSavingCustomerId(row.customerId);
      setErrorMessage("");
      await savePersonCustomerTargets({
        customerId: row.customerId,
        personId: effectivePersonId,
        year,
        hunterAmount: nextHunterAmount,
        hunterOwnAmount: nextHunterOwnAmount,
        farmerRenewalAmount: nextFarmerRenewalOwnAmount,
        studioAmount: nextStudioAmount,
        increaseCustomerTarget,
        notes: "Meta associada pela tela Metas por Pessoa.",
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.customerId];
        return next;
      });
      setSuccessMessage(overAmount > 0.01 && increaseCustomerTarget
        ? `Metas salvas e meta do cliente ${row.customerName} aumentada para ${formatCurrency(nextCustomerTotal)}.`
        : overAmount > 0.01
          ? `Metas salvas mantendo a meta original do cliente. ${row.customerName} ficará ${formatCurrency(overAmount)} acima para conciliação.`
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
        actions={(
          <ReportExportActions
            title={`Relatório de Metas por Pessoa · ${selectedPerson?.name ?? "Pessoa não selecionada"} · ${year}`}
            filename={`relatorio-metas-pessoa-${year}${selectedPerson ? `-${toFileSlug(selectedPerson.name)}` : ""}`}
            rows={personTargetReportRows}
            columns={personTargetReportColumns}
          />
        )}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {errorMessage && <ErrorNotice message={errorMessage} floating onClose={() => setErrorMessage("")} />}

      <Card className="sticky top-0 z-20 mb-5 overflow-hidden border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="border-b border-slate-100 p-4">
          <div className="grid gap-3 xl:grid-cols-[1.5fr_1.5fr_0.7fr]">
            <label className="min-w-0">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Pessoa</span>
              <Select value={effectivePersonId} onChange={(event) => changePerson(event.target.value)}>
                <option value="">Selecione uma pessoa</option>
                {assignablePeople.map((person) => (
                  <option key={person.id} value={person.id}>{person.name} · {person.roleType}</option>
                ))}
              </Select>
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Cliente em foco</span>
              <Select
                value={effectivePersonId ? effectiveSelectedCustomerId : ""}
                onChange={(event) => changeFocusedCustomer(event.target.value)}
                disabled={!effectivePersonId}
              >
                {!effectivePersonId ? (
                  <option value="">Selecione uma pessoa primeiro</option>
                ) : (
                  <>
                    <option value="">Todos os clientes da pessoa</option>
                    {visibleCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </>
                )}
              </Select>
            </label>
            <label className="min-w-0">
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
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[1fr_360px] xl:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase leading-4 tracking-normal text-slate-500">
                Total da pessoa · {selectedPerson?.name ?? "selecione uma pessoa"} · {year}
              </p>
              <p className="text-xs text-slate-400">
                {selectedPersonIsSpecialistHunter
                  ? "Hunter Especializado é somente consulta: total derivado dos Studios do cliente."
                  : "Meta Hunter atual = meta própria + meta herdada de Studios"}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
              <PersonSummaryMetric label="Base esperada das contas" value={expectedBaseTotal} />
              <PersonSummaryMetric label={selectedPersonIsSpecialistHunter ? "Meta derivada dos Studios" : "Meta Hunter atual"} value={totals.hunter} tone="purple" />
              <PersonSummaryMetric label="Renovação + Ampliação" value={selectedPersonIsSpecialistHunter ? 0 : totals.farmerRenewal} tone="blue" />
              <PersonSummaryMetric label="Total da pessoa" value={totals.hunter + totals.farmerRenewal} tone="dark" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            {selectedPersonIsSpecialistHunter && (
              <div className="mb-3 rounded-lg border border-purple-100 bg-white p-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Meta especializada em tela própria</p>
                <p className="mt-1 text-xs leading-5">
                  Ao selecionar esse perfil, use a tela de Hunter Especializado para escolher os Studios do cliente.
                </p>
              </div>
            )}
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">{selectedPersonIsSpecialistHunter ? "Incluir cliente para consulta" : "Incluir cliente para meta"}</span>
              <Select value={effectiveCustomerToAdd} onChange={(event) => setCustomerToAdd(event.target.value)} disabled={!effectivePersonId || selectedPersonIsSpecialistHunter || !availableCustomersToAdd.length}>
                {!effectivePersonId ? (
                  <option value="">Selecione uma pessoa primeiro</option>
                ) : !availableCustomersToAdd.length ? (
                  <option value="">Todos os clientes já estão na grade</option>
                ) : (
                  <option value="">Selecione um cliente</option>
                )}
                {availableCustomersToAdd.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </Select>
            </label>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full justify-center"
              disabled={!effectivePersonId || selectedPersonIsSpecialistHunter || !effectiveCustomerToAdd}
              onClick={() => {
                if (!effectiveCustomerToAdd) return;
                setExtraCustomerIds((current) => current.includes(effectiveCustomerToAdd) ? current : [...current, effectiveCustomerToAdd]);
                setSelectedCustomerId(effectiveCustomerToAdd);
              }}
            >
              <Plus className="h-4 w-4" />
              {selectedPersonIsSpecialistHunter ? "Consulta derivada" : "Incluir cliente"}
            </Button>
          </div>
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
          <Table className="min-w-[1720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Meta do Cliente</TableHead>
                <TableHead>Já associado a outras pessoas</TableHead>
                <TableHead>Gap após edição</TableHead>
                <TableHead>Meta própria / Hunter atual</TableHead>
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
                      hunterLabel={selectedPersonIsSpecialistHunter ? "Meta Studios" : "Hunter"}
                      farmerRenewalLabel={selectedPersonIsSpecialistHunter ? "Renovação inibida" : "Renov. + Ampl."}
                      hunterAction={selectedPersonIsSpecialistHunter ? undefined : {
                        onClick: () => quickAllocateCustomerTarget(row, "hunter"),
                        title: `Clique para alocar o saldo Hunter em ${selectedPerson?.name ?? "pessoa selecionada"}`,
                      }}
                      farmerRenewalAction={selectedPersonIsSpecialistHunter ? undefined : {
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
                    <TargetGapBreakdown
                      hunter={row.hunterGap}
                      farmerRenewal={row.farmerRenewalGap}
                      total={row.clientTotal - row.customerTarget}
                    />
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      value={drafts[row.customerId]?.hunter ?? row.hunterInput}
                      onChange={(event) => updateDraft(row.customerId, "hunter", event.target.value)}
                      aria-label={`Meta própria Hunter para ${row.customerName}`}
                      disabled={selectedPersonIsSpecialistHunter}
                    />
                    <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                      <p>{selectedPersonIsSpecialistHunter ? "Total Studios" : "Studio Hunter herdado"}: <span className="font-semibold text-sky-700">{formatCurrency(row.studioHunterAmount)}</span></p>
                      <p>Total atual: <span className="font-bold text-slate-900">{formatCurrency(row.hunterAmount)}</span></p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      value={drafts[row.customerId]?.farmerRenewal ?? row.farmerRenewalInput}
                      onChange={(event) => updateDraft(row.customerId, "farmerRenewal", event.target.value)}
                      aria-label={`Meta própria Renovação + Ampliação para ${row.customerName}`}
                      disabled={selectedPersonIsSpecialistHunter}
                    />
                    <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                      <p>Studio Manut. herdada: <span className="font-semibold text-sky-700">{formatCurrency(row.studioRenewalAmount)}</span></p>
                      <p>Total atual: <span className="font-bold text-slate-900">{formatCurrency(row.farmerRenewalAmount)}</span></p>
                    </div>
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
                        disabled={selectedPersonIsSpecialistHunter || savingCustomerId === row.customerId || removingCustomerId === row.customerId}
                      >
                        <Trash2 className="h-4 w-4" />
                        {removingCustomerId === row.customerId ? "Removendo..." : "Remover"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveCustomerTargets(row)}
                        disabled={selectedPersonIsSpecialistHunter || savingCustomerId === row.customerId || removingCustomerId === row.customerId}
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
type BreakdownLineAction = {
  onClick: () => void;
  title: string;
};

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fechado</Badge>;
  if (status === "over") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Acima</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Abaixo</Badge>;
}

function getClientStatusLabel(status: ClientStatus) {
  if (status === "ok") return "Fechado";
  if (status === "over") return "Acima";
  return "Abaixo";
}

function SourceBadge({ source }: { source: RowSource }) {
  if (source === "assigned") return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Cliente associado</Badge>;
  if (source === "existing_target") return <Badge className="bg-purple-100 text-brq-purple hover:bg-purple-100">Meta existente</Badge>;
  return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Incluído agora</Badge>;
}

function getSourceLabel(source: RowSource) {
  if (source === "assigned") return "Cliente associado";
  if (source === "existing_target") return "Meta existente";
  return "Incluído agora";
}

function PersonSummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "purple" | "blue" | "dark";
}) {
  const toneClassName = {
    neutral: "border-slate-200 bg-white text-slate-950",
    purple: "border-purple-100 bg-purple-50/40 text-brq-purple",
    blue: "border-sky-100 bg-sky-50/50 text-sky-800",
    dark: "border-slate-200 bg-slate-950 text-white",
  }[tone];
  const labelClassName = tone === "dark" ? "text-white/65" : "text-slate-500";

  return (
    <div className={`min-w-0 rounded-lg border px-3 py-2 ${toneClassName}`}>
      <p className={`text-[11px] font-semibold uppercase leading-4 tracking-normal ${labelClassName}`}>{label}</p>
      <p className="mt-1 whitespace-nowrap text-lg font-black leading-tight tracking-normal tabular-nums sm:text-xl" title={formatCurrency(value)}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function TargetBreakdown({
  hunter,
  farmerRenewal,
  total,
  hunterLabel = "Hunter",
  farmerRenewalLabel = "Renov. + Ampl.",
  hunterAction,
  farmerRenewalAction,
}: {
  hunter: number;
  farmerRenewal: number;
  total: number;
  hunterLabel?: string;
  farmerRenewalLabel?: string;
  hunterAction?: BreakdownLineAction;
  farmerRenewalAction?: BreakdownLineAction;
}) {
  return (
    <div className="min-w-40 space-y-1 text-xs">
      <BreakdownLine label={hunterLabel} value={hunter} action={hunterAction} />
      <BreakdownLine label={farmerRenewalLabel} value={farmerRenewal} action={farmerRenewalAction} />
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
      ? "text-red-700"
      : tone === "over"
        ? "text-emerald-700"
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
  people: Array<{ id: string; active: boolean; roleType: RoleType; clientIds: string[]; name: string }>,
  personId: string,
  year: number,
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  specialistAssignments: Array<{ personId: string; studioTargetAllocationId: string; year: number }>,
  areas: Array<{ id: string; name: string }>,
  draft: { hunter: string; farmerRenewal: string } | undefined,
  source: RowSource,
  roleType?: RoleType,
) {
  const isSpecialistHunter = Boolean(roleType && isSpecialistHunterRole(roleType));
  const hunterAllocation = findAllocation(allocations, customer.id, personId, year, "hunter");
  const farmerRenewalAllocation = findAllocation(allocations, customer.id, personId, year, "farmer_renewal");
  const targetBreakdown = getCustomerTargetBreakdown(customer, allocations, year, isSpecialistHunter);
  const rawStudioHunterAmount = isSpecialistHunter
    ? sumSpecialistStudioAllocations(studioAllocations, specialistAssignments, customer.id, personId, year)
    : sumStudioHunterAllocations(studioAllocations, customer.id, personId, year, people, allocations);
  const studioHunterAmount = isSpecialistHunter
    ? Math.min(rawStudioHunterAmount, targetBreakdown.hunter)
    : rawStudioHunterAmount;
  const rowTargetBreakdown = isSpecialistHunter
    ? { hunter: studioHunterAmount, farmerRenewal: 0 }
    : targetBreakdown;
  const savedHunterAmount = roundCurrency(hunterAllocation?.amount ?? studioHunterAmount);
  const hunterAmount = isSpecialistHunter ? studioHunterAmount : parseAmount(draft?.hunter ?? getInputValue(savedHunterAmount));
  const hunterOwnAmount = isSpecialistHunter ? 0 : roundCurrency(Math.max(hunterAmount - studioHunterAmount, 0));
  const studioRenewalAmount = isSpecialistHunter ? 0 : getEligibleStudioRenewalAmountForPerson({
    allocations: studioAllocations,
    areas,
    people,
    customerId: customer.id,
    personId,
    year,
  });
  const savedFarmerRenewalAmount = roundCurrency(farmerRenewalAllocation?.amount ?? studioRenewalAmount);
  const farmerRenewalAmount = isSpecialistHunter ? 0 : parseAmount(draft?.farmerRenewal ?? getInputValue(savedFarmerRenewalAmount));
  const farmerRenewalOwnAmount = isSpecialistHunter ? 0 : roundCurrency(Math.max(farmerRenewalAmount - studioRenewalAmount, 0));
  const otherPeopleHunterTotal = isSpecialistHunter ? 0 : sumOtherPeopleAllocations(allocations, customer.id, personId, year, "hunter");
  const otherPeopleFarmerRenewalTotal = isSpecialistHunter ? 0 : sumOtherPeopleAllocations(allocations, customer.id, personId, year, "farmer_renewal");
  const otherPeopleTotal = otherPeopleHunterTotal + otherPeopleFarmerRenewalTotal;
  const customerTarget = isSpecialistHunter ? roundCurrency(rowTargetBreakdown.hunter + rowTargetBreakdown.farmerRenewal) : getCustomerTarget(customer);
  const clientHunterTotal = otherPeopleHunterTotal + hunterAmount;
  const clientFarmerRenewalTotal = otherPeopleFarmerRenewalTotal + farmerRenewalAmount;
  const clientTotal = clientHunterTotal + clientFarmerRenewalTotal;

  return {
    customerId: customer.id,
    customer,
    customerName: customer.name,
    industry: customer.industry,
    customerTarget,
    customerHunterTarget: rowTargetBreakdown.hunter,
    customerFarmerRenewalTarget: rowTargetBreakdown.farmerRenewal,
    otherPeopleHunterTotal,
    otherPeopleFarmerRenewalTotal,
    otherPeopleTotal,
    clientHunterTotal,
    clientFarmerRenewalTotal,
    clientTotal,
    hunterGap: clientHunterTotal - rowTargetBreakdown.hunter,
    farmerRenewalGap: clientFarmerRenewalTotal - rowTargetBreakdown.farmerRenewal,
    hunterAllocation,
    farmerRenewalAllocation,
    hunterOwnAmount,
    studioHunterAmount,
    hunterAmount,
    farmerRenewalOwnAmount,
    studioRenewalAmount,
    farmerRenewalAmount,
    hunterInput: getInputValue(savedHunterAmount),
    farmerRenewalInput: getInputValue(savedFarmerRenewalAmount),
    personTotal: hunterAmount + farmerRenewalAmount,
    clientStatus: getClientStatus(rowTargetBreakdown, { hunter: clientHunterTotal, farmerRenewal: clientFarmerRenewalTotal }),
    source,
  };
}

function sumStudioHunterAllocations(
  allocations: StudioTargetAllocation[],
  customerId: string,
  personId: string,
  year: number,
  people: Array<{ id: string; active: boolean; roleType: RoleType; clientIds: string[]; name: string }>,
  targetAllocations: TargetAllocation[],
) {
  return roundCurrency(allocations
    .filter((allocation) =>
      allocation.customerId === customerId
      && allocation.year === year
      && getEffectiveStudioHunterPersonId(allocation, people, targetAllocations) === personId
    )
    .reduce((total, allocation) => total + allocation.hunterAmount, 0));
}

function sumSpecialistStudioAllocations(
  allocations: StudioTargetAllocation[],
  specialistAssignments: Array<{ personId: string; studioTargetAllocationId: string; year: number }>,
  customerId: string,
  personId: string,
  year: number,
) {
  const selectedAllocationIds = new Set(specialistAssignments
    .filter((assignment) => assignment.personId === personId && assignment.year === year)
    .map((assignment) => assignment.studioTargetAllocationId));

  return roundCurrency(allocations
    .filter((allocation) =>
      allocation.customerId === customerId
      && allocation.year === year
      && selectedAllocationIds.has(allocation.id)
    )
    .reduce((total, allocation) => total + allocation.hunterAmount, 0));
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
      && (type ? allocation.type === type : allocation.type !== "studio")
    )
    .reduce((total, allocation) => total + allocation.amount, 0);
}

function buildVisibleCustomerIds(
  people: Array<{ id: string; active: boolean; roleType: RoleType; clientIds: string[]; name: string }>,
  assignedCustomerIds: string[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  personId: string,
  year: number,
  extraCustomerIds: string[],
) {
  if (!personId) return new Set<string>();
  return new Set([
    ...assignedCustomerIds,
    ...allocations
      .filter((allocation) => allocation.personId === personId && allocation.year === year && allocation.type !== "studio")
      .map((allocation) => allocation.customerId),
    ...studioAllocations
      .filter((allocation) =>
        allocation.year === year
        && (
          getEffectiveStudioHunterPersonId(allocation, people, allocations) === personId
          || getStudioMaintenancePersonId(allocation) === personId
        )
        && hasStudioAllocationValue(allocation)
      )
      .map((allocation) => allocation.customerId),
    ...extraCustomerIds,
  ]);
}

function getRowSource(
  customerId: string,
  people: Array<{ id: string; active: boolean; roleType: RoleType; clientIds: string[]; name: string }>,
  assignedCustomerIds: string[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  personId: string,
  year: number,
  extraCustomerIds: string[],
): RowSource {
  if (assignedCustomerIds.includes(customerId)) return "assigned";
  if (allocations.some((allocation) => allocation.customerId === customerId && allocation.personId === personId && allocation.year === year && allocation.type !== "studio")) {
    return "existing_target";
  }
  if (studioAllocations.some((allocation) =>
    allocation.customerId === customerId
    && allocation.year === year
    && (
      getEffectiveStudioHunterPersonId(allocation, people, allocations) === personId
      || getStudioMaintenancePersonId(allocation) === personId
    )
    && hasStudioAllocationValue(allocation)
  )) {
    return "existing_target";
  }
  if (extraCustomerIds.includes(customerId)) return "added";
  return "added";
}

function hasStudioAllocationValue(allocation: StudioTargetAllocation) {
  return allocation.hunterAmount + allocation.maintenanceAmount > 0;
}

function getEffectiveStudioHunterPersonId(
  allocation: StudioTargetAllocation,
  people: Array<{ id: string; active: boolean; roleType: RoleType; clientIds: string[]; name: string }>,
  targetAllocations: TargetAllocation[],
) {
  return allocation.hunterPersonId
    ?? getDefaultHunterPersonIdForCustomer(people, targetAllocations, allocation.customerId, allocation.year);
}

function getDefaultHunterPersonIdForCustomer(
  people: Array<{ id: string; active: boolean; roleType: RoleType; clientIds: string[]; name: string }>,
  targetAllocations: TargetAllocation[],
  customerId: string,
  year: number,
) {
  if (!customerId) return "";

  const hunterIdsFromTargets = new Set(targetAllocations
    .filter((allocation) =>
      allocation.type === "hunter"
      && allocation.year === year
      && allocation.customerId === customerId
    )
    .map((allocation) => allocation.personId));

  return people
    .filter((person) =>
      person.active
      && isHunterRole(person.roleType)
      && (person.clientIds.includes(customerId) || hunterIdsFromTargets.has(person.id))
    )
    .sort((first, second) => {
      const firstHasTarget = hunterIdsFromTargets.has(first.id) ? 0 : 1;
      const secondHasTarget = hunterIdsFromTargets.has(second.id) ? 0 : 1;
      return firstHasTarget - secondHasTarget || first.name.localeCompare(second.name, "pt-BR");
    })[0]?.id ?? "";
}

function getClientStatus(
  target: { hunter: number; farmerRenewal: number },
  allocated: { hunter: number; farmerRenewal: number },
): ClientStatus {
  if (
    allocated.hunter > target.hunter + 0.01
    || allocated.farmerRenewal > target.farmerRenewal + 0.01
  ) return "over";
  if (
    Math.abs(target.hunter - allocated.hunter) <= 0.01
    && Math.abs(target.farmerRenewal - allocated.farmerRenewal) <= 0.01
  ) return "ok";
  return "pending";
}

function getCustomerTarget(customer: Customer) {
  return getCustomerTotalTarget(customer);
}

function getCustomerTargetBreakdown(customer: Customer, allocations: TargetAllocation[], year: number, specialistHunter = false) {
  void allocations;
  void year;
  if (specialistHunter) {
    return {
      hunter: roundCurrency(customer.studioHunterTarget + customer.studioTarget),
      farmerRenewal: 0,
    };
  }
  return {
    hunter: roundCurrency(customer.hunterTarget),
    farmerRenewal: roundCurrency(customer.farmerRenewalTarget),
  };
}

function getExpectedBaseTotalForPerson(roleType: RoleType, rows: PersonTargetRow[]) {
  return rows.reduce((total, row) => {
    if (isSpecialistHunterRole(roleType)) return total + row.customerTarget;
    const hunterBase = isHunterRole(roleType) ? row.customerHunterTarget : 0;
    const deliveryBase = roleType === "Hunter" ? 0 : row.customerFarmerRenewalTarget;
    return total + hunterBase + deliveryBase;
  }, 0);
}

function getGapTone(value: number) {
  if (value > 0.01) return "over";
  if (value < -0.01) return "pending";
  return "ok";
}

function getGapClassName(value: number) {
  const tone = getGapTone(value);
  if (tone === "over") return "text-emerald-700";
  if (tone === "pending") return "text-red-700";
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
  currentStudioAmount,
  nextStudioAmount,
}: {
  currentHunterAmount: number;
  nextHunterAmount: number;
  currentFarmerRenewalAmount: number;
  nextFarmerRenewalAmount: number;
  currentStudioAmount: number;
  nextStudioAmount: number;
}) {
  const hunterDelta = nextHunterAmount - currentHunterAmount;
  const farmerRenewalDelta = nextFarmerRenewalAmount - currentFarmerRenewalAmount;
  const studioDelta = nextStudioAmount - currentStudioAmount;
  const increased = [
    hunterDelta > 0.01 ? "Hunter" : "",
    farmerRenewalDelta > 0.01 ? "Renovação + Ampliação" : "",
    studioDelta > 0.01 ? "Áreas / Studios" : "",
  ].filter(Boolean);
  if (increased.length) return increased.join(" e ");
  return "redistribuição de metas";
}
