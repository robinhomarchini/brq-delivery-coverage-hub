"use client";

import { Building2, Pencil, Plus, Save, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Area, Customer, Person, StudioTargetAllocation } from "@/data/mockData";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { SortableTableHead, type SortDirection, type SortState } from "@/components/shared/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDeliveryStore } from "@/store/delivery-store";
import { formatCurrencyInput, formatCurrencyInputValue, parseCurrencyInput } from "@/lib/currency-input";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import { isFarmerDeliveryTargetRole, isHunterRole, isHunterSelectionRole } from "@/lib/roles";
import { getStudioMaintenancePersonId } from "@/lib/studio-renewal-rollup";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";
import { formatCurrency, makeId } from "@/lib/utils";

const currentYear = defaultTargetYear;

type ReconciliationSortKey = "customer" | "target" | "allocated" | "areas" | "status";
type AllocationSortKey = "customer" | "area" | "hunterPerson" | "year" | "hunter" | "maintenance" | "total";
type StudioAllocationSegment = "hunter" | "maintenance";

export function StudioTargetAssignment() {
  const initialParams = useMemo(() => getInitialStudioTargetParams(), []);
  const { areas, customers, customerTargets, people, studioTargetAllocations, targetAllocations, saveStudioTargetAllocation, deleteStudioTargetAllocation } = useDeliveryStore();
  const [customerId, setCustomerId] = useState(initialParams.customerId);
  const [areaId, setAreaId] = useState("");
  const [hunterPersonId, setHunterPersonId] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formAreaId, setFormAreaId] = useState("");
  const [formHunterPersonId, setFormHunterPersonId] = useState("");
  const [formMaintenancePersonId, setFormMaintenancePersonId] = useState("");
  const [formYear, setFormYear] = useState(String(initialParams.year ?? currentYear));
  const [formHunterAmount, setFormHunterAmount] = useState("0");
  const [formMaintenanceAmount, setFormMaintenanceAmount] = useState("0");
  const [formNotes, setFormNotes] = useState("");
  const [year, setYear] = useState(String(initialParams.year ?? currentYear));
  const [editing, setEditing] = useState<StudioTargetAllocation | null>(null);
  const [open, setOpen] = useState(false);
  const [allocationPickerCustomerId, setAllocationPickerCustomerId] = useState("");
  const [allocationPickerOptions, setAllocationPickerOptions] = useState<StudioTargetAllocation[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [reconciliationSort, setReconciliationSort] = useState<SortState<ReconciliationSortKey>>({ key: "customer", direction: "asc" });
  const [allocationSort, setAllocationSort] = useState<SortState<AllocationSortKey>>({ key: "customer", direction: "asc" });

  const effectiveYear = Number(year) || currentYear;
  const years = useMemo(
    () => Array.from(new Set([...getAvailableTargetYears(customerTargets, currentYear), ...studioTargetAllocations.map((allocation) => allocation.year)])).sort((a, b) => b - a),
    [customerTargets, studioTargetAllocations],
  );
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, effectiveYear), [customerTargets, customers, effectiveYear]);
  const selectableCustomers = useMemo(
    () => yearCustomers.slice().sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base", numeric: true })),
    [yearCustomers],
  );
  const allocationsForYear = useMemo(
    () => studioTargetAllocations.filter((allocation) => allocation.year === effectiveYear),
    [effectiveYear, studioTargetAllocations],
  );
  const filteredRows = useMemo(() => allocationsForYear.filter((allocation) => {
    return (!customerId || allocation.customerId === customerId)
      && (!areaId || allocation.areaId === areaId)
      && (!hunterPersonId || getEffectiveStudioHunterPersonId(allocation, people, targetAllocations) === hunterPersonId);
  }), [allocationsForYear, areaId, customerId, hunterPersonId, people, targetAllocations]);
  const reconciliation = useMemo(
    () => buildReconciliation(yearCustomers, areas, allocationsForYear),
    [allocationsForYear, areas, yearCustomers],
  );
  const visibleReconciliation = useMemo(() => reconciliation.filter((row) => {
    return (!customerId || row.customerId === customerId)
      && (!areaId || row.areaIds.includes(areaId));
  }), [areaId, customerId, reconciliation]);
  const sortedReconciliation = useMemo(
    () => sortReconciliationRows(visibleReconciliation, reconciliationSort),
    [reconciliationSort, visibleReconciliation],
  );
  const sortedAllocations = useMemo(
    () => sortAllocationRows(filteredRows, allocationSort, yearCustomers, areas, people, targetAllocations),
    [allocationSort, areas, filteredRows, people, targetAllocations, yearCustomers],
  );
  const hunterOptions = useMemo(
    () => getHunterOptions(people, targetAllocations, studioTargetAllocations, customerId, effectiveYear),
    [customerId, effectiveYear, people, studioTargetAllocations, targetAllocations],
  );
  const totals = useMemo(() => visibleReconciliation.reduce((summary, row) => ({
    targetHunter: summary.targetHunter + row.targetHunter,
    targetMaintenance: summary.targetMaintenance + row.targetMaintenance,
    allocatedHunter: summary.allocatedHunter + row.allocatedHunter,
    allocatedMaintenance: summary.allocatedMaintenance + row.allocatedMaintenance,
    open: summary.open + row.openTotal,
    over: summary.over + row.overTotal,
  }), { targetHunter: 0, targetMaintenance: 0, allocatedHunter: 0, allocatedMaintenance: 0, open: 0, over: 0 }), [visibleReconciliation]);

  const closeForm = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setFormCustomerId("");
    setFormAreaId("");
    setFormHunterPersonId("");
    setFormMaintenancePersonId("");
    setFormYear(String(effectiveYear));
    setFormHunterAmount("0");
    setFormMaintenanceAmount("0");
    setFormNotes("");
    setFormError("");
  }, [effectiveYear]);

  const closeAllocationPicker = useCallback(() => {
    setAllocationPickerCustomerId("");
    setAllocationPickerOptions([]);
  }, []);

  useCloseOnNavigation(closeForm);

  useEffect(() => {
    if (!initialParams.consumedFromUrl || typeof window === "undefined") return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [initialParams.consumedFromUrl]);

  function openForm(allocation?: StudioTargetAllocation, presetCustomerId = "", forceNew = false) {
    if (forceNew) {
      setEditing(null);
      setFormCustomerId(presetCustomerId);
      setFormAreaId("");
      setFormHunterPersonId("");
      setFormMaintenancePersonId("");
      setFormYear(String(effectiveYear));
      setFormHunterAmount("0");
      setFormMaintenanceAmount("0");
      setFormNotes("");
      setFormError("");
      setOpen(true);
      return;
    }

    const targetCustomerId = allocation?.customerId || presetCustomerId || customerId;
    const allocationToEdit = allocation ?? findDefaultAllocationForCustomer(
      studioTargetAllocations,
      targetCustomerId,
      effectiveYear,
      areaId,
      hunterPersonId,
      yearCustomers,
      areas,
      people,
      targetAllocations,
    );
    const defaultHunterPersonId = allocationToEdit?.hunterPersonId
      || hunterPersonId
      || getDefaultHunterPersonIdForCustomer(people, targetAllocations, targetCustomerId, effectiveYear);

    setEditing(allocationToEdit ?? null);
    setFormCustomerId(allocationToEdit?.customerId || targetCustomerId);
    setFormAreaId(allocationToEdit?.areaId ?? areaId);
    setFormHunterPersonId(defaultHunterPersonId);
    setFormMaintenancePersonId(allocationToEdit?.maintenancePersonId ?? "");
    setFormYear(String(allocationToEdit?.year ?? effectiveYear));
    setFormHunterAmount(getInputValue(allocationToEdit?.hunterAmount ?? 0));
    setFormMaintenanceAmount(getInputValue(allocationToEdit?.maintenanceAmount ?? 0));
    setFormNotes(allocationToEdit?.notes ?? "");
    setFormError("");
    setOpen(true);
  }

  function openFromCustomer(customerIdToOpen: string) {
    const candidates = getAllocationCandidatesForCustomer(
      studioTargetAllocations,
      customerIdToOpen,
      effectiveYear,
      areaId,
      hunterPersonId,
      yearCustomers,
      areas,
      people,
      targetAllocations,
    );

    if (candidates.length <= 1) {
      openForm(candidates[0], customerIdToOpen);
      return;
    }

    setAllocationPickerCustomerId(customerIdToOpen);
    setAllocationPickerOptions(candidates);
  }

  function syncExistingAllocation(nextCustomerId: string, nextAreaId: string, nextHunterPersonId: string, nextMaintenancePersonId: string, nextYear: string) {
    if (!nextCustomerId || !nextAreaId) return;
    const nextTargetYear = Number(nextYear);
    if (!Number.isInteger(nextTargetYear)) return;
    const matchingAllocation = findMatchingStudioAllocation(
      studioTargetAllocations,
      nextCustomerId,
      nextAreaId,
      nextHunterPersonId,
      nextMaintenancePersonId,
      nextTargetYear,
    );

    if (matchingAllocation) {
      setEditing(matchingAllocation);
      setFormHunterPersonId(matchingAllocation.hunterPersonId ?? "");
      setFormMaintenancePersonId(matchingAllocation.maintenancePersonId ?? "");
      setFormHunterAmount(getInputValue(matchingAllocation.hunterAmount));
      setFormMaintenanceAmount(getInputValue(matchingAllocation.maintenanceAmount));
      setFormNotes(matchingAllocation.notes ?? "");
      setFormError("");
      return;
    }

    if (editing && !matchesStudioAllocationGrain(editing, nextCustomerId, nextAreaId, nextHunterPersonId, nextTargetYear)) {
      const changedOnlyHunter = editing.customerId === nextCustomerId
        && editing.areaId === nextAreaId
        && editing.year === nextTargetYear
        && ((editing.hunterPersonId ?? "") !== nextHunterPersonId || (editing.maintenancePersonId ?? "") !== nextMaintenancePersonId);
      if (changedOnlyHunter) {
        setFormError("");
        return;
      }

      setEditing(null);
      setFormHunterAmount("0");
      setFormMaintenanceAmount("0");
      setFormNotes("");
    }
  }

  function changeFormArea(nextAreaId: string) {
    const currentEditing = editing;
    const nextHunterPersonId = formHunterPersonId
      || getDefaultHunterPersonIdForCustomer(people, targetAllocations, formCustomerId, Number(formYear) || effectiveYear);
    setFormAreaId(nextAreaId);
    if (!formHunterPersonId) setFormHunterPersonId(nextHunterPersonId);

    if (!currentEditing || !nextAreaId || nextAreaId === currentEditing.areaId) {
      syncExistingAllocation(formCustomerId, nextAreaId, nextHunterPersonId, formMaintenancePersonId, formYear);
      return;
    }

    const currentAreaName = findArea(areas, currentEditing.areaId)?.name ?? currentEditing.areaId;
    const nextAreaName = findArea(areas, nextAreaId)?.name ?? nextAreaId;
    const shouldMoveExisting = window.confirm([
      `Você está trocando o Studio desta meta de "${currentAreaName}" para "${nextAreaName}".`,
      "",
      "OK: atualizar esta meta existente para o novo Studio.",
      "Cancelar: criar uma nova meta neste Studio, mantendo a meta original separada.",
    ].join("\n"));

    if (shouldMoveExisting) {
      setEditing(currentEditing);
      setFormError("");
      return;
    }

    setEditing(null);
    setFormError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft: StudioTargetAllocation = {
      id: editing?.id ?? makeId("studio-target"),
      customerId: formCustomerId.trim(),
      areaId: formAreaId.trim(),
      hunterPersonId: formHunterPersonId.trim() || undefined,
      maintenancePersonId: formMaintenancePersonId.trim() || undefined,
      year: Number(formYear),
      hunterAmount: parseAmount(formHunterAmount),
      maintenanceAmount: parseAmount(formMaintenanceAmount),
      notes: formNotes.trim(),
    };

    if (!draft.customerId) {
      setFormError("Selecione um cliente para salvar a meta de área/studio.");
      return;
    }

    if (!draft.areaId) {
      setFormError("Selecione a Área / Studio para salvar a meta.");
      return;
    }

    if (!Number.isInteger(draft.year) || draft.year < 2020 || draft.year > 2100) {
      setFormError("Informe um ano válido entre 2020 e 2100.");
      return;
    }

    const customer = findCustomer(yearCustomers, draft.customerId);
    if (!customer) {
      setFormError("Cliente não encontrado para o ano selecionado. Atualize a tela e tente novamente.");
      return;
    }

    try {
      setFormError("");
      await saveStudioTargetAllocation(draft);
      closeForm();
      setSuccessMessage("Meta de área/studio salva com sucesso. Diferenças permanecem visíveis na conciliação.");
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Metas por Área/Studio"
        description="Distribua a abertura anual de Áreas / Studios entre Hunter, que fica contido na meta Hunter do cliente, e Manutenção/Renovação, que compõe o total."
        actions={<Button onClick={() => openForm(undefined, "", true)}><Plus className="h-4 w-4" /> Nova meta por studio</Button>}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiSummaryCard label={`Studio Hunter · ${effectiveYear}`} currencyValue={totals.targetHunter} icon={Target} tone="sky" />
        <KpiSummaryCard label={`Studio Manutenção · ${effectiveYear}`} currencyValue={totals.targetMaintenance} icon={Target} tone="blue" />
        <KpiSummaryCard label="Alocado" currencyValue={totals.allocatedHunter + totals.allocatedMaintenance} icon={Target} tone="purple" />
        <KpiSummaryCard label="Abaixo da meta" currencyValue={totals.open} icon={Target} tone={totals.open > 0.01 ? "danger" : "neutral"} />
      </section>

      <Card className="mb-5 grid gap-3 p-4 shadow-sm md:grid-cols-2 xl:grid-cols-7">
        <Field label="Cliente em foco" className="xl:col-span-3">
          <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Todos os clientes</option>
            {selectableCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </Select>
          <span className="mt-1 block text-xs text-slate-400">Ao escolher um cliente, a conciliação e as alocações abaixo são atualizadas automaticamente.</span>
        </Field>
        <Field label="Ano">
          <Select value={year} onChange={(event) => setYear(event.target.value)}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </Field>
        <Field label="Área / Studio">
          <Select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">Todas as áreas/studios</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </Select>
        </Field>
        <Field label="Hunter">
          <Select value={hunterPersonId} onChange={(event) => setHunterPersonId(event.target.value)}>
            <option value="">Todos os hunters</option>
            {hunterOptions.map((person) => <option key={person.id} value={person.id}>{formatHunterOptionLabel(person)}</option>)}
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={() => {
            setCustomerId("");
            setAreaId("");
            setHunterPersonId("");
          }}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Conciliação por cliente</h2>
          <p className="mt-1 text-xs text-slate-500">Manutenção/Renovação sem alocação aparece como pendência. Studio Hunter é uma abertura contida na meta Hunter; quando a abertura Hunter estiver parcial, aparece como informação para detalhamento.</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Cliente" sortKey="customer" sortState={reconciliationSort} onSort={setReconciliationSort} />
                <SortableTableHead label="Meta do Cliente" sortKey="target" sortState={reconciliationSort} onSort={setReconciliationSort} />
                <SortableTableHead label="Alocado em Studios" sortKey="allocated" sortState={reconciliationSort} onSort={setReconciliationSort} />
                <SortableTableHead label="Áreas/Studios" sortKey="areas" sortState={reconciliationSort} onSort={setReconciliationSort} />
                <SortableTableHead label="Status" sortKey="status" sortState={reconciliationSort} onSort={setReconciliationSort} />
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedReconciliation.map((row) => (
                <TableRow key={row.customerId} className="cursor-pointer" onDoubleClick={() => openFromCustomer(row.customerId)}>
                  <TableCell className="font-semibold text-slate-900">{row.customerName}</TableCell>
                  <TableCell>
                    <p>Studio Hunter: {formatCurrency(row.targetHunter)}</p>
                    <p>Manut.: {formatCurrency(row.targetMaintenance)}</p>
                  </TableCell>
                  <TableCell>
                    <p>Studio Hunter: {formatCurrency(row.allocatedHunter)}</p>
                    <p>Manut.: {formatCurrency(row.allocatedMaintenance)}</p>
                    {row.hunterNotDetailed > 0.01 && <p className="text-xs text-sky-700">Hunter a detalhar: {formatCurrency(row.hunterNotDetailed)}</p>}
                  </TableCell>
                  <TableCell>{row.areaNames.join(", ") || "Sem área/studio alocado"}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openFromCustomer(row.customerId)}>Alocar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Alocações por área/studio</h2>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Cliente" sortKey="customer" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Área / Studio" sortKey="area" sortState={allocationSort} onSort={setAllocationSort} />
                <TableHead>Tipo</TableHead>
                <SortableTableHead label="Responsável" sortKey="hunterPerson" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Ano" sortKey="year" sortState={allocationSort} onSort={setAllocationSort} />
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAllocations.flatMap((allocation) =>
                getAllocationSegments(allocation).map((segment) => (
                  <TableRow
                    key={`${allocation.id}-${segment}`}
                    className={segment === "hunter" ? "cursor-pointer bg-sky-50/35 hover:bg-sky-50" : "cursor-pointer bg-white hover:bg-slate-50"}
                    onDoubleClick={() => openForm(allocation)}
                  >
                    <TableCell className="font-semibold text-slate-900">{findCustomer(yearCustomers, allocation.customerId)?.name ?? allocation.customerId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={segment === "hunter" ? "grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-700" : "grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"}>
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span>{findArea(areas, allocation.areaId)?.name ?? allocation.areaId}</span>
                      </div>
                    </TableCell>
                    <TableCell><StudioSegmentBadge segment={segment} /></TableCell>
                    <TableCell>
                      {segment === "hunter" ? (
                          <p className={getEffectiveStudioHunterPersonId(allocation, people, targetAllocations) ? "font-semibold text-slate-800" : "text-slate-400"}>
                          {personName(people, getEffectiveStudioHunterPersonId(allocation, people, targetAllocations))}
                        </p>
                      ) : (
                        <p className={getStudioMaintenancePersonId(allocation) ? "font-semibold text-slate-800" : "text-slate-400"}>
                          {personName(people, getStudioMaintenancePersonId(allocation), "Responsável não informado")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{allocation.year}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${segment === "hunter" ? "text-sky-800" : "text-slate-800"}`}>
                      {formatCurrency(getSegmentAmount(allocation, segment))}
                    </TableCell>
                    <TableCell>
                      <span className={segment === "hunter"
                        ? "inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800"
                        : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}
                      >
                        {segment === "hunter" ? "Soma no total do Hunter" : "Compõe Farmer/Delivery elegível"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-slate-500">{allocation.notes || "—"}</TableCell>
                    <TableCell onDoubleClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openForm(allocation)} aria-label="Editar alocação"><Pencil className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          aria-label="Excluir alocação"
                          onClick={() => {
                            if (window.confirm("Excluir esta meta de área/studio?")) void deleteStudioTargetAllocation(allocation.id).catch(() => undefined);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {!sortedAllocations.length && <EmptyState />}
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar meta por área/studio" : "Nova meta por área/studio"}</DialogTitle>
            <DialogDescription>Informe cliente, área/studio, ano e os valores Hunter e Manutenção. Hunter não soma novamente no total do cliente.</DialogDescription>
          </DialogHeader>
          <form key={editing?.id ?? `new-studio-target-${formCustomerId || "blank"}`} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <Select name="customerId" value={formCustomerId} onChange={(event) => {
                const nextCustomerId = event.target.value;
                const nextHunterPersonId = formHunterPersonId || getDefaultHunterPersonIdForCustomer(people, targetAllocations, nextCustomerId, Number(formYear) || effectiveYear);
                setFormCustomerId(nextCustomerId);
                if (!formHunterPersonId) setFormHunterPersonId(nextHunterPersonId);
                syncExistingAllocation(nextCustomerId, formAreaId, nextHunterPersonId, formMaintenancePersonId, formYear);
              }} required>
                <option value="">Selecione</option>
                {yearCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </Select>
            </Field>
            <Field label="Área / Studio">
              <Select name="areaId" value={formAreaId} onChange={(event) => {
                changeFormArea(event.target.value);
              }} required>
                <option value="">Selecione</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </Select>
            </Field>
            <Field label="Hunter associado">
              <Select name="hunterPersonId" value={formHunterPersonId} onChange={(event) => {
                const nextHunterPersonId = event.target.value;
                setFormHunterPersonId(nextHunterPersonId);
                syncExistingAllocation(formCustomerId, formAreaId, nextHunterPersonId, formMaintenancePersonId, formYear);
              }}>
                <option value="">Hunter não informado</option>
                {getHunterOptions(people, targetAllocations, studioTargetAllocations, formCustomerId, Number(formYear) || effectiveYear, editing?.hunterPersonId ? [editing.hunterPersonId] : []).map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </Select>
              <span className="mt-1 block text-xs text-slate-400">Opcional nesta tela. Sem Hunter, o valor fica como Studio Hunter a detalhar e não soma na meta de uma pessoa.</span>
            </Field>
            <Field label="Farmer/Delivery responsável">
              <Select name="maintenancePersonId" value={formMaintenancePersonId} onChange={(event) => {
                const nextMaintenancePersonId = event.target.value;
                setFormMaintenancePersonId(nextMaintenancePersonId);
                syncExistingAllocation(formCustomerId, formAreaId, formHunterPersonId, nextMaintenancePersonId, formYear);
              }}>
                <option value="">Responsável não informado</option>
                {getMaintenancePersonOptions(people, targetAllocations, studioTargetAllocations, formCustomerId, Number(formYear) || effectiveYear, editing?.maintenancePersonId ? [editing.maintenancePersonId] : []).map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </Select>
              <span className="mt-1 block text-xs text-slate-400">Usado para incorporar Manutenção/Renovação na meta do Farmer/Delivery responsável.</span>
            </Field>
            <Field label="Ano">
              <Input name="year" type="number" min="2020" max="2100" step="1" value={formYear} onChange={(event) => {
                const nextYear = event.target.value;
                setFormYear(nextYear);
                syncExistingAllocation(formCustomerId, formAreaId, formHunterPersonId, formMaintenancePersonId, nextYear);
              }} required />
            </Field>
            <Field label="Valor Hunter (R$)">
              <Input name="hunterAmount" type="text" inputMode="decimal" value={formHunterAmount} onChange={(event) => setFormHunterAmount(formatCurrencyInput(event.target.value))} required />
            </Field>
            <Field label="Valor Manutenção/Renovação (R$)">
              <Input name="maintenanceAmount" type="text" inputMode="decimal" value={formMaintenanceAmount} onChange={(event) => setFormMaintenanceAmount(formatCurrencyInput(event.target.value))} required />
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <Textarea name="notes" rows={3} value={formNotes} onChange={(event) => setFormNotes(event.target.value)} maxLength={2000} />
            </Field>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button type="submit"><Save className="h-4 w-4" /> Salvar meta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(allocationPickerCustomerId)} onOpenChange={(nextOpen) => {
        if (!nextOpen) closeAllocationPicker();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolher meta por área/studio</DialogTitle>
            <DialogDescription>
              Este cliente possui mais de uma combinação de Studio e Hunter. Escolha a linha exata que deseja editar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {allocationPickerOptions.map((allocation) => (
              <button
                key={allocation.id}
                type="button"
                className="w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-brq-purple hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-brq-purple"
                onClick={() => {
                  closeAllocationPicker();
                  openForm(allocation);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-950">{findArea(areas, allocation.areaId)?.name ?? allocation.areaId}</p>
                    <p className="text-xs text-slate-500">
                      Hunter associado: {personName(people, getEffectiveStudioHunterPersonId(allocation, people, targetAllocations))}
                      {allocation.maintenancePersonId && (
                        <> · Farmer/Delivery: {personName(people, allocation.maintenancePersonId)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allocation.hunterAmount > 0.01 && <StudioSegmentBadge segment="hunter" />}
                    {allocation.maintenanceAmount > 0.01 && <StudioSegmentBadge segment="maintenance" />}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <span>Studio Hunter: <strong>{formatCurrency(allocation.hunterAmount)}</strong></span>
                  <span>Manutenção: <strong>{formatCurrency(allocation.maintenanceAmount)}</strong></span>
                  <span>Total: <strong>{formatCurrency(allocation.hunterAmount + allocation.maintenanceAmount)}</strong></span>
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => {
              const targetCustomerId = allocationPickerCustomerId;
              closeAllocationPicker();
              openForm(undefined, targetCustomerId, true);
            }}>
              Nova linha para este cliente
            </Button>
            <Button type="button" variant="outline" onClick={closeAllocationPicker}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StudioSegmentBadge({ segment }: { segment: StudioAllocationSegment }) {
  if (segment === "hunter") {
    return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Studio Hunter</Badge>;
  }
  return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Studio Manutenção</Badge>;
}

function StatusBadge({ status }: { status: "ok" | "pending" | "over" | "empty" | "partial" }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fechado</Badge>;
  if (status === "over") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Acima</Badge>;
  if (status === "empty") return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Sem meta</Badge>;
  if (status === "partial") return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Hunter parcial</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Abaixo</Badge>;
}

function buildReconciliation(customers: Customer[], areas: Area[], allocations: StudioTargetAllocation[]) {
  const areasById = new Map(areas.map((area) => [area.id, area.name]));
  return customers
    .filter((customer) => customer.studioHunterTarget > 0 || customer.studioTarget > 0 || allocations.some((allocation) => allocation.customerId === customer.id))
    .map((customer) => {
      const customerAllocations = allocations.filter((allocation) => allocation.customerId === customer.id);
      const allocatedHunter = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.hunterAmount, 0));
      const allocatedMaintenance = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
      const targetHunter = Math.max(customer.studioHunterTarget, allocatedHunter);
      const targetMaintenance = Math.max(customer.studioTarget, allocatedMaintenance);
      const hunterDifference = roundCurrency(targetHunter - allocatedHunter);
      const maintenanceDifference = roundCurrency(targetMaintenance - allocatedMaintenance);
      const areaIds = customerAllocations.map((allocation) => allocation.areaId);
      const overTotal = Math.max(0, -hunterDifference) + Math.max(0, -maintenanceDifference);
      const hunterNotDetailed = Math.max(0, hunterDifference);
      const openTotal = Math.max(0, maintenanceDifference);
      return {
        customerId: customer.id,
        customerName: customer.name,
        targetHunter,
        targetMaintenance,
        allocatedHunter,
        allocatedMaintenance,
        openHunter: Math.max(0, hunterDifference),
        openMaintenance: Math.max(0, maintenanceDifference),
        hunterNotDetailed,
        overHunter: Math.max(0, -hunterDifference),
        overMaintenance: Math.max(0, -maintenanceDifference),
        openTotal,
        overTotal,
        areaIds,
        areaNames: Array.from(new Set(areaIds.map((id) => areasById.get(id) ?? id))).sort((a, b) => a.localeCompare(b, "pt-BR")),
        status: targetHunter <= 0 && targetMaintenance <= 0 && allocatedHunter <= 0 && allocatedMaintenance <= 0
          ? "empty" as const
          : overTotal > 0.01
            ? "over" as const
            : openTotal > 0.01
              ? "pending" as const
              : hunterNotDetailed > 0.01
                ? "partial" as const
                : "ok" as const,
      };
    })
    .sort((first, second) =>
      (second.targetHunter + second.targetMaintenance) - (first.targetHunter + first.targetMaintenance)
      || first.customerName.localeCompare(second.customerName, "pt-BR")
    );
}

type ReconciliationRow = ReturnType<typeof buildReconciliation>[number];

function sortReconciliationRows(rows: ReconciliationRow[], sortState: SortState<ReconciliationSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "customer") return compareText(first.customerName, second.customerName);
    if (sortState.key === "target") return compareNumber(first.targetHunter + first.targetMaintenance, second.targetHunter + second.targetMaintenance);
    if (sortState.key === "allocated") return compareNumber(first.allocatedHunter + first.allocatedMaintenance, second.allocatedHunter + second.allocatedMaintenance);
    if (sortState.key === "areas") return compareText(first.areaNames.join(", "), second.areaNames.join(", "));
    return compareNumber(getStatusRank(first), getStatusRank(second))
      || compareNumber(first.openTotal + first.overTotal, second.openTotal + second.overTotal)
      || compareText(first.customerName, second.customerName);
  });
}

function sortAllocationRows(
  rows: StudioTargetAllocation[],
  sortState: SortState<AllocationSortKey>,
  customers: Customer[],
  areas: Area[],
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number; amount?: number }>,
) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "customer") return compareText(findCustomer(customers, first.customerId)?.name ?? first.customerId, findCustomer(customers, second.customerId)?.name ?? second.customerId);
    if (sortState.key === "area") return compareText(findArea(areas, first.areaId)?.name ?? first.areaId, findArea(areas, second.areaId)?.name ?? second.areaId);
    if (sortState.key === "hunterPerson") {
      return compareText(
        personName(people, getEffectiveStudioHunterPersonId(first, people, targetAllocations)),
        personName(people, getEffectiveStudioHunterPersonId(second, people, targetAllocations)),
      );
    }
    if (sortState.key === "year") return compareNumber(first.year, second.year);
    if (sortState.key === "hunter") return compareNumber(first.hunterAmount, second.hunterAmount);
    if (sortState.key === "maintenance") return compareNumber(first.maintenanceAmount, second.maintenanceAmount);
    return compareNumber(first.hunterAmount + first.maintenanceAmount, second.hunterAmount + second.maintenanceAmount);
  });
}

function sortRows<T>(rows: T[], direction: SortDirection, compare: (first: T, second: T) => number) {
  return [...rows].sort((first, second) => {
    const result = compare(first, second);
    return direction === "asc" ? result : -result;
  });
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "pt-BR", { sensitivity: "base", numeric: true });
}

function compareNumber(first: number, second: number) {
  return first - second;
}

function getStatusRank(row: ReconciliationRow) {
  if (row.status === "over") return 0;
  if (row.status === "pending") return 1;
  if (row.status === "partial") return 2;
  if (row.status === "empty") return 3;
  return 4;
}

function findCustomer(customers: Customer[], id: string) {
  return customers.find((customer) => customer.id === id);
}

function findArea(areas: Area[], id: string) {
  return areas.find((area) => area.id === id);
}

function findDefaultAllocationForCustomer(
  allocations: StudioTargetAllocation[],
  customerId: string,
  year: number,
  areaId: string,
  hunterPersonId: string,
  customers: Customer[],
  areas: Area[],
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number; amount?: number }>,
) {
  if (!customerId) return undefined;
  const candidates = allocations.filter((allocation) =>
    allocation.customerId === customerId
    && allocation.year === year
    && (!areaId || allocation.areaId === areaId)
    && (!hunterPersonId || getEffectiveStudioHunterPersonId(allocation, people, targetAllocations) === hunterPersonId)
  );
  if (!candidates.length) return undefined;
  return sortAllocationRows(candidates, { key: "customer", direction: "asc" }, customers, areas, people, targetAllocations)[0];
}

function getAllocationCandidatesForCustomer(
  allocations: StudioTargetAllocation[],
  customerId: string,
  year: number,
  areaId: string,
  hunterPersonId: string,
  customers: Customer[],
  areas: Area[],
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number; amount?: number }>,
) {
  if (!customerId) return [];
  const candidates = allocations.filter((allocation) =>
    allocation.customerId === customerId
    && allocation.year === year
    && (!areaId || allocation.areaId === areaId)
    && (!hunterPersonId || getEffectiveStudioHunterPersonId(allocation, people, targetAllocations) === hunterPersonId)
  );

  return sortAllocationRows(candidates, { key: "area", direction: "asc" }, customers, areas, people, targetAllocations);
}

function findMatchingStudioAllocation(
  allocations: StudioTargetAllocation[],
  customerId: string,
  areaId: string,
  hunterPersonId: string,
  maintenancePersonId: string,
  year: number,
) {
  const candidates = allocations.filter((allocation) =>
    matchesStudioAllocationBaseGrain(allocation, customerId, areaId, year)
  );
  if (!hunterPersonId && !maintenancePersonId) return candidates.length === 1 ? candidates[0] : undefined;
  return candidates.find((allocation) =>
    (allocation.hunterPersonId ?? "") === hunterPersonId
    && (allocation.maintenancePersonId ?? "") === maintenancePersonId
  );
}

function matchesStudioAllocationGrain(
  allocation: StudioTargetAllocation,
  customerId: string,
  areaId: string,
  hunterPersonId: string,
  year: number,
) {
  return matchesStudioAllocationBaseGrain(allocation, customerId, areaId, year)
    && (allocation.hunterPersonId ?? "") === hunterPersonId;
}

function matchesStudioAllocationBaseGrain(allocation: StudioTargetAllocation, customerId: string, areaId: string, year: number) {
  return allocation.customerId === customerId
    && allocation.areaId === areaId
    && allocation.year === year;
}

function getAllocationSegments(allocation: StudioTargetAllocation): StudioAllocationSegment[] {
  const segments: StudioAllocationSegment[] = [];
  if (allocation.hunterAmount > 0.01) segments.push("hunter");
  if (allocation.maintenanceAmount > 0.01) segments.push("maintenance");
  return segments.length ? segments : ["hunter"];
}

function getSegmentAmount(allocation: StudioTargetAllocation, segment: StudioAllocationSegment) {
  return segment === "hunter" ? allocation.hunterAmount : allocation.maintenanceAmount;
}

function getHunterOptions(
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
  studioTargetAllocations: StudioTargetAllocation[],
  customerId: string,
  year: number,
  extraPersonIds: string[] = [],
) {
  const hunterIdsFromCustomerTargets = new Set(targetAllocations
    .filter((allocation) =>
      allocation.type === "hunter"
      && allocation.year === year
      && (!customerId || allocation.customerId === customerId)
    )
    .map((allocation) => allocation.personId));
  const hunterIdsFromStudioTargets = new Set(studioTargetAllocations
    .filter((allocation) =>
      allocation.year === year
      && allocation.hunterPersonId
      && (!customerId || allocation.customerId === customerId)
    )
    .map((allocation) => allocation.hunterPersonId as string));
  const extraIds = new Set(extraPersonIds.filter(Boolean));

  return people
    .filter((person) =>
      (person.active && isHunterSelectionRole(person.roleType))
      || hunterIdsFromCustomerTargets.has(person.id)
      || hunterIdsFromStudioTargets.has(person.id)
      || extraIds.has(person.id)
      || Boolean(customerId && person.clientIds.includes(customerId) && isHunterSelectionRole(person.roleType))
    )
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

function getMaintenancePersonOptions(
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
  studioTargetAllocations: StudioTargetAllocation[],
  customerId: string,
  year: number,
  extraPersonIds: string[] = [],
) {
  const personIdsFromCustomerTargets = new Set(targetAllocations
    .filter((allocation) =>
      allocation.type === "farmer_renewal"
      && allocation.year === year
      && (!customerId || allocation.customerId === customerId)
    )
    .map((allocation) => allocation.personId));
  const personIdsFromStudioTargets = new Set(studioTargetAllocations
    .filter((allocation) =>
      allocation.year === year
      && getStudioMaintenancePersonId(allocation)
      && (!customerId || allocation.customerId === customerId)
    )
    .map((allocation) => getStudioMaintenancePersonId(allocation) as string));
  const extraIds = new Set(extraPersonIds.filter(Boolean));

  return people
    .filter((person) =>
      (person.active && isFarmerDeliveryTargetRole(person.roleType))
      || personIdsFromCustomerTargets.has(person.id)
      || personIdsFromStudioTargets.has(person.id)
      || extraIds.has(person.id)
      || Boolean(customerId && person.clientIds.includes(customerId) && isFarmerDeliveryTargetRole(person.roleType))
    )
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

function getDefaultHunterPersonIdForCustomer(
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
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

function getEffectiveStudioHunterPersonId(
  allocation: StudioTargetAllocation,
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number; amount?: number }>,
) {
  if (allocation.hunterPersonId) return allocation.hunterPersonId;
  return getDefaultHunterPersonIdForCustomer(people, targetAllocations, allocation.customerId, allocation.year);
}

function personName(people: Person[], personId?: string, emptyLabel = "Hunter não informado") {
  if (!personId) return emptyLabel;
  return people.find((person) => person.id === personId)?.name ?? personId;
}

function formatHunterOptionLabel(person: Pick<Person, "name" | "roleType">) {
  return person.roleType === "Hunter Especializado" ? `${person.name} · Hunter Especializado` : person.name;
}

function getInputValue(value: number) {
  return formatCurrencyInputValue(value);
}

function parseAmount(value: string) {
  return parseCurrencyInput(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar a meta de área/studio. Verifique os valores, permissões e conexão.";
}

function getInitialStudioTargetParams() {
  if (typeof window === "undefined") return { customerId: "", year: undefined as number | undefined, consumedFromUrl: false };
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  const customerId = params.get("customerId") ?? "";
  return {
    customerId,
    year: Number.isFinite(year) && year >= 2020 && year <= 2100 ? year : undefined,
    consumedFromUrl: Boolean(customerId || params.get("year")),
  };
}
