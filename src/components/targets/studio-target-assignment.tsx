"use client";

import { Building2, Pencil, Plus, Save, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Area, Customer, StudioTargetAllocation } from "@/data/mockData";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
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
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";
import { formatCurrency, makeId } from "@/lib/utils";

const currentYear = defaultTargetYear;

type ReconciliationSortKey = "customer" | "target" | "allocated" | "areas" | "status";
type AllocationSortKey = "customer" | "area" | "year" | "hunter" | "maintenance" | "total";

export function StudioTargetAssignment() {
  const initialParams = useMemo(() => getInitialStudioTargetParams(), []);
  const { areas, customers, customerTargets, studioTargetAllocations, saveCustomer, saveStudioTargetAllocation, deleteStudioTargetAllocation } = useDeliveryStore();
  const [customerId, setCustomerId] = useState(initialParams.customerId);
  const [areaId, setAreaId] = useState("");
  const [year, setYear] = useState(String(initialParams.year ?? currentYear));
  const [editing, setEditing] = useState<StudioTargetAllocation | null>(null);
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [reconciliationSort, setReconciliationSort] = useState<SortState<ReconciliationSortKey>>(null);
  const [allocationSort, setAllocationSort] = useState<SortState<AllocationSortKey>>(null);

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
      && (!areaId || allocation.areaId === areaId);
  }), [allocationsForYear, areaId, customerId]);
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
    () => sortAllocationRows(filteredRows, allocationSort, yearCustomers, areas),
    [allocationSort, areas, filteredRows, yearCustomers],
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
    setFormError("");
  }, []);

  useCloseOnNavigation(closeForm);

  useEffect(() => {
    if (!initialParams.consumedFromUrl || typeof window === "undefined") return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [initialParams.consumedFromUrl]);

  function openForm(allocation?: StudioTargetAllocation, presetCustomerId = "") {
    setEditing(allocation ?? null);
    setCustomerId((current) => current || allocation?.customerId || presetCustomerId);
    setFormError("");
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const draft: StudioTargetAllocation = {
      id: editing?.id ?? makeId("studio-target"),
      customerId: String(formData.get("customerId")),
      areaId: String(formData.get("areaId")),
      year: Number(formData.get("year")),
      hunterAmount: parseAmount(String(formData.get("hunterAmount") ?? "0")),
      maintenanceAmount: parseAmount(String(formData.get("maintenanceAmount") ?? "0")),
      notes: String(formData.get("notes") ?? ""),
    };

    const customer = findCustomer(yearCustomers, draft.customerId);
    const nextHunterAllocated = sumStudioAllocations(studioTargetAllocations, draft.customerId, draft.year, draft.id, "hunter") + draft.hunterAmount;
    const nextMaintenanceAllocated = sumStudioAllocations(studioTargetAllocations, draft.customerId, draft.year, draft.id, "maintenance") + draft.maintenanceAmount;
    const customerUpdate = customer ? buildCustomerTargetUpdate(customer, nextHunterAllocated, nextMaintenanceAllocated) : null;

    try {
      setFormError("");
      if (customerUpdate?.changed) {
        await saveCustomer(customerUpdate.customer, draft.year);
      }
      await saveStudioTargetAllocation(draft);
      closeForm();
      setSuccessMessage(customerUpdate?.changed
        ? "Meta de área/studio salva com sucesso e meta do cliente atualizada."
        : "Meta de área/studio salva com sucesso. Diferenças permanecem visíveis na conciliação.");
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
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nova meta por studio</Button>}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Summary label={`Studio Hunter · ${effectiveYear}`} value={formatCurrency(totals.targetHunter)} />
        <Summary label={`Studio Manutenção · ${effectiveYear}`} value={formatCurrency(totals.targetMaintenance)} />
        <Summary label="Alocado" value={formatCurrency(totals.allocatedHunter + totals.allocatedMaintenance)} />
        <Summary label="Em aberto" value={formatCurrency(totals.open)} />
      </section>

      <Card className="mb-5 grid gap-3 p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
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
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={() => {
            setCustomerId("");
            setAreaId("");
          }}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Conciliação por cliente</h2>
          <p className="mt-1 text-xs text-slate-500">Manutenção/Renovação sem alocação aparece como pendência. Studio Hunter é uma abertura contida na meta Hunter; quando não estiver totalmente detalhado, fica apenas informativo.</p>
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
                <TableRow key={row.customerId} className="cursor-pointer" onDoubleClick={() => openForm(undefined, row.customerId)}>
                  <TableCell className="font-semibold text-slate-900">{row.customerName}</TableCell>
                  <TableCell>
                    <p>Studio Hunter: {formatCurrency(row.targetHunter)}</p>
                    <p>Manut.: {formatCurrency(row.targetMaintenance)}</p>
                  </TableCell>
                  <TableCell>
                    <p>Studio Hunter: {formatCurrency(row.allocatedHunter)}</p>
                    <p>Manut.: {formatCurrency(row.allocatedMaintenance)}</p>
                    {row.hunterNotDetailed > 0.01 && <p className="text-xs text-sky-700">Não detalhado: {formatCurrency(row.hunterNotDetailed)}</p>}
                  </TableCell>
                  <TableCell>{row.areaNames.join(", ") || "Sem área/studio alocado"}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openForm(undefined, row.customerId)}>Alocar</Button>
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
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Cliente" sortKey="customer" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Área / Studio" sortKey="area" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Ano" sortKey="year" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Hunter" sortKey="hunter" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Manutenção" sortKey="maintenance" sortState={allocationSort} onSort={setAllocationSort} />
                <SortableTableHead label="Total" sortKey="total" sortState={allocationSort} onSort={setAllocationSort} />
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAllocations.map((allocation) => (
                <TableRow key={allocation.id} className="cursor-pointer" onDoubleClick={() => openForm(allocation)}>
                  <TableCell className="font-semibold text-slate-900">{findCustomer(yearCustomers, allocation.customerId)?.name ?? allocation.customerId}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span>{findArea(areas, allocation.areaId)?.name ?? allocation.areaId}</span>
                    </div>
                  </TableCell>
                  <TableCell>{allocation.year}</TableCell>
                  <TableCell>{formatCurrency(allocation.hunterAmount)}</TableCell>
                  <TableCell>{formatCurrency(allocation.maintenanceAmount)}</TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(allocation.hunterAmount + allocation.maintenanceAmount)}</TableCell>
                  <TableCell className="max-w-xs truncate text-slate-500">{allocation.notes || "—"}</TableCell>
                  <TableCell onDoubleClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm(allocation)}><Pencil className="h-4 w-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm("Excluir esta meta de área/studio?")) void deleteStudioTargetAllocation(allocation.id).catch(() => undefined);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <Select name="customerId" defaultValue={editing?.customerId ?? customerId} required>
                <option value="">Selecione</option>
                {yearCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </Select>
            </Field>
            <Field label="Área / Studio">
              <Select name="areaId" defaultValue={editing?.areaId ?? ""} required>
                <option value="">Selecione</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </Select>
            </Field>
            <Field label="Ano">
              <Input name="year" type="number" min="2020" max="2100" step="1" defaultValue={editing?.year ?? effectiveYear} required />
            </Field>
            <Field label="Valor Hunter (R$)">
              <Input name="hunterAmount" type="text" inputMode="decimal" defaultValue={getInputValue(editing?.hunterAmount ?? 0)} required />
            </Field>
            <Field label="Valor Manutenção/Renovação (R$)">
              <Input name="maintenanceAmount" type="text" inputMode="decimal" defaultValue={getInputValue(editing?.maintenanceAmount ?? 0)} required />
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} maxLength={2000} />
            </Field>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button type="submit"><Save className="h-4 w-4" /> Salvar meta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Target className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </Card>
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

function StatusBadge({ status }: { status: "ok" | "pending" | "over" | "empty" | "partial" }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fechado</Badge>;
  if (status === "over") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Acima</Badge>;
  if (status === "empty") return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Sem meta</Badge>;
  if (status === "partial") return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Hunter parcial</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>;
}

function buildReconciliation(customers: Customer[], areas: Area[], allocations: StudioTargetAllocation[]) {
  const areasById = new Map(areas.map((area) => [area.id, area.name]));
  return customers
    .filter((customer) => customer.studioHunterTarget > 0 || customer.studioTarget > 0 || allocations.some((allocation) => allocation.customerId === customer.id))
    .map((customer) => {
      const customerAllocations = allocations.filter((allocation) => allocation.customerId === customer.id);
      const allocatedHunter = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.hunterAmount, 0));
      const allocatedMaintenance = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
      const hunterDifference = roundCurrency(customer.studioHunterTarget - allocatedHunter);
      const maintenanceDifference = roundCurrency(customer.studioTarget - allocatedMaintenance);
      const areaIds = customerAllocations.map((allocation) => allocation.areaId);
      const overTotal = Math.max(0, -hunterDifference) + Math.max(0, -maintenanceDifference);
      const hunterNotDetailed = Math.max(0, hunterDifference);
      const openTotal = Math.max(0, maintenanceDifference);
      return {
        customerId: customer.id,
        customerName: customer.name,
        targetHunter: customer.studioHunterTarget,
        targetMaintenance: customer.studioTarget,
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
        status: customer.studioHunterTarget <= 0 && customer.studioTarget <= 0 && allocatedHunter <= 0 && allocatedMaintenance <= 0
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

function sortAllocationRows(rows: StudioTargetAllocation[], sortState: SortState<AllocationSortKey>, customers: Customer[], areas: Area[]) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "customer") return compareText(findCustomer(customers, first.customerId)?.name ?? first.customerId, findCustomer(customers, second.customerId)?.name ?? second.customerId);
    if (sortState.key === "area") return compareText(findArea(areas, first.areaId)?.name ?? first.areaId, findArea(areas, second.areaId)?.name ?? second.areaId);
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

function sumStudioAllocations(allocations: StudioTargetAllocation[], customerId: string, year: number, exceptId: string, type: "hunter" | "maintenance") {
  return roundCurrency(allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year && allocation.id !== exceptId)
    .reduce((total, allocation) => total + (type === "hunter" ? allocation.hunterAmount : allocation.maintenanceAmount), 0));
}

function buildCustomerTargetUpdate(customer: Customer, nextHunterAllocated: number, nextMaintenanceAllocated: number) {
  let nextCustomer = { ...customer };
  let changed = false;

  if (nextHunterAllocated > customer.studioHunterTarget + 0.01) {
    const increaseStudioHunter = window.confirm(
      `A soma Studio Hunter das áreas/studios ficará acima do subtotal atual do cliente.\n\nSubtotal atual: ${formatCurrency(customer.studioHunterTarget)}\nSoma após salvar: ${formatCurrency(nextHunterAllocated)}\n\nDeseja aumentar o subtotal Studio Hunter do cliente? Se escolher Cancelar, a meta será salva e a diferença ficará na conciliação.`,
    );

    if (increaseStudioHunter) {
      nextCustomer = {
        ...nextCustomer,
        studioHunterTarget: roundCurrency(nextHunterAllocated),
      };
      changed = true;
    }
  }

  if (nextHunterAllocated > customer.hunterTarget + 0.01) {
    const increaseHunterTarget = window.confirm(
      `A soma Studio Hunter também ficará acima da Meta Hunter do cliente.\n\nMeta Hunter atual: ${formatCurrency(customer.hunterTarget)}\nSoma Studio Hunter após salvar: ${formatCurrency(nextHunterAllocated)}\n\nDeseja aumentar a Meta Hunter do cliente? Se escolher Cancelar, a meta será salva e a diferença ficará na conciliação.`,
    );

    if (increaseHunterTarget) {
      nextCustomer = {
        ...nextCustomer,
        hunterTarget: roundCurrency(nextHunterAllocated),
        revenue: roundCurrency(nextHunterAllocated + nextCustomer.farmerRenewalTarget + nextCustomer.studioTarget),
      };
      changed = true;
    }
  }

  if (nextMaintenanceAllocated > customer.studioTarget + 0.01) {
    const increaseMaintenance = window.confirm(
      `A soma Studio Manutenção/Renovação ficará acima do subtotal atual do cliente.\n\nSubtotal atual: ${formatCurrency(customer.studioTarget)}\nSoma após salvar: ${formatCurrency(nextMaintenanceAllocated)}\n\nDeseja aumentar o subtotal Studio Manutenção/Renovação do cliente? Se escolher Cancelar, a meta será salva e a diferença ficará na conciliação.`,
    );

    if (increaseMaintenance) {
      nextCustomer = {
        ...nextCustomer,
        studioTarget: roundCurrency(nextMaintenanceAllocated),
        revenue: roundCurrency(nextCustomer.hunterTarget + nextCustomer.farmerRenewalTarget + nextMaintenanceAllocated),
      };
      changed = true;
    }
  }

  return { customer: nextCustomer, changed };
}

function findCustomer(customers: Customer[], id: string) {
  return customers.find((customer) => customer.id === id);
}

function findArea(areas: Area[], id: string) {
  return areas.find((area) => area.id === id);
}

function getInputValue(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseAmount(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(sanitized)
      ? sanitized.replace(/\./g, "")
      : sanitized;
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
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
