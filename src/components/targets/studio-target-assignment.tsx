"use client";

import { Building2, Pencil, Plus, Save, Target, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Area, Customer, StudioTargetAllocation } from "@/data/mockData";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
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

export function StudioTargetAssignment() {
  const initialParams = useMemo(() => getInitialStudioTargetParams(), []);
  const { areas, customers, customerTargets, studioTargetAllocations, saveStudioTargetAllocation, deleteStudioTargetAllocation } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState(initialParams.customerId);
  const [areaId, setAreaId] = useState("");
  const [year, setYear] = useState(String(initialParams.year ?? currentYear));
  const [editing, setEditing] = useState<StudioTargetAllocation | null>(null);
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");

  const effectiveYear = Number(year) || currentYear;
  const years = useMemo(
    () => Array.from(new Set([...getAvailableTargetYears(customerTargets, currentYear), ...studioTargetAllocations.map((allocation) => allocation.year)])).sort((a, b) => b - a),
    [customerTargets, studioTargetAllocations],
  );
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, effectiveYear), [customerTargets, customers, effectiveYear]);
  const allocationsForYear = useMemo(
    () => studioTargetAllocations.filter((allocation) => allocation.year === effectiveYear),
    [effectiveYear, studioTargetAllocations],
  );
  const filteredRows = useMemo(() => allocationsForYear.filter((allocation) => {
    const customer = findCustomer(yearCustomers, allocation.customerId);
    const area = findArea(areas, allocation.areaId);
    const query = search.toLowerCase();
    return (!query || `${customer?.name ?? ""} ${area?.name ?? ""} ${allocation.notes ?? ""}`.toLowerCase().includes(query))
      && (!customerId || allocation.customerId === customerId)
      && (!areaId || allocation.areaId === areaId);
  }), [allocationsForYear, areaId, areas, customerId, search, yearCustomers]);
  const reconciliation = useMemo(
    () => buildReconciliation(yearCustomers, areas, allocationsForYear),
    [allocationsForYear, areas, yearCustomers],
  );
  const visibleReconciliation = useMemo(() => reconciliation.filter((row) => {
    const query = search.toLowerCase();
    return (!query || `${row.customerName} ${row.areaNames.join(" ")}`.toLowerCase().includes(query))
      && (!customerId || row.customerId === customerId)
      && (!areaId || row.areaIds.includes(areaId));
  }), [areaId, customerId, reconciliation, search]);
  const totals = useMemo(() => visibleReconciliation.reduce((summary, row) => ({
    target: summary.target + row.target,
    allocated: summary.allocated + row.allocated,
    open: summary.open + row.open,
    over: summary.over + row.over,
  }), { target: 0, allocated: 0, open: 0, over: 0 }), [visibleReconciliation]);

  const closeForm = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setFormError("");
  }, []);

  useCloseOnNavigation(closeForm);

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
      amount: parseAmount(String(formData.get("amount") ?? "0")),
      notes: String(formData.get("notes") ?? ""),
    };

    const customer = findCustomer(yearCustomers, draft.customerId);
    const nextAllocated = sumStudioAllocations(studioTargetAllocations, draft.customerId, draft.year, draft.id) + draft.amount;
    if (customer && customer.studioTarget > 0 && nextAllocated > customer.studioTarget + 0.01) {
      setFormError(`A soma das áreas/studios ficará acima da meta do cliente. Meta: ${formatCurrency(customer.studioTarget)}. Soma após salvar: ${formatCurrency(nextAllocated)}.`);
      return;
    }

    try {
      setFormError("");
      await saveStudioTargetAllocation(draft);
      closeForm();
      setSuccessMessage("Meta de área/studio salva com sucesso.");
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
        description="Distribua a meta anual de Áreas / Studios do cliente entre PX, Mobile, BA, IA, Dados e demais studios. Pessoas não fazem parte desta tela."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nova meta por studio</Button>}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Summary label={`Meta Áreas / Studios · ${effectiveYear}`} value={formatCurrency(totals.target)} />
        <Summary label="Alocado" value={formatCurrency(totals.allocated)} />
        <Summary label="Em aberto" value={formatCurrency(totals.open)} />
        <Summary label="Acima da meta" value={formatCurrency(totals.over)} />
      </section>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {yearCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </Select>
        <Select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
          <option value="">Todas as áreas/studios</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </Select>
      </FilterBar>

      <Card className="mb-5 overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Conciliação por cliente</h2>
          <p className="mt-1 text-xs text-slate-500">A soma das áreas/studios deve bater com a meta de Áreas / Studios cadastrada no cliente.</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Meta do Cliente</TableHead>
                <TableHead>Alocado em Studios</TableHead>
                <TableHead>Áreas/Studios</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleReconciliation.map((row) => (
                <TableRow key={row.customerId} className="cursor-pointer" onDoubleClick={() => openForm(undefined, row.customerId)}>
                  <TableCell className="font-semibold text-slate-900">{row.customerName}</TableCell>
                  <TableCell>{formatCurrency(row.target)}</TableCell>
                  <TableCell>{formatCurrency(row.allocated)}</TableCell>
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
                <TableHead>Cliente</TableHead>
                <TableHead>Área / Studio</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((allocation) => (
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
                  <TableCell className="font-bold text-slate-950">{formatCurrency(allocation.amount)}</TableCell>
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
        {!filteredRows.length && <EmptyState />}
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar meta por área/studio" : "Nova meta por área/studio"}</DialogTitle>
            <DialogDescription>Informe cliente, área/studio, ano e valor. O total não pode ultrapassar a meta de Áreas / Studios do cliente.</DialogDescription>
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
            <Field label="Valor da meta (R$)">
              <Input name="amount" type="text" inputMode="decimal" defaultValue={getInputValue(editing?.amount ?? 0)} required />
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

function StatusBadge({ status }: { status: "ok" | "pending" | "over" | "empty" }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Fechado</Badge>;
  if (status === "over") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Acima</Badge>;
  if (status === "empty") return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Sem meta</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>;
}

function buildReconciliation(customers: Customer[], areas: Area[], allocations: StudioTargetAllocation[]) {
  const areasById = new Map(areas.map((area) => [area.id, area.name]));
  return customers
    .filter((customer) => customer.studioTarget > 0 || allocations.some((allocation) => allocation.customerId === customer.id))
    .map((customer) => {
      const customerAllocations = allocations.filter((allocation) => allocation.customerId === customer.id);
      const allocated = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.amount, 0));
      const difference = roundCurrency(customer.studioTarget - allocated);
      const areaIds = customerAllocations.map((allocation) => allocation.areaId);
      return {
        customerId: customer.id,
        customerName: customer.name,
        target: customer.studioTarget,
        allocated,
        open: Math.max(0, difference),
        over: Math.max(0, -difference),
        areaIds,
        areaNames: Array.from(new Set(areaIds.map((id) => areasById.get(id) ?? id))).sort((a, b) => a.localeCompare(b, "pt-BR")),
        status: customer.studioTarget <= 0 && allocated <= 0
          ? "empty" as const
          : allocated > customer.studioTarget + 0.01
            ? "over" as const
            : Math.abs(difference) <= 0.01
              ? "ok" as const
              : "pending" as const,
      };
    })
    .sort((first, second) => second.target - first.target || first.customerName.localeCompare(second.customerName, "pt-BR"));
}

function sumStudioAllocations(allocations: StudioTargetAllocation[], customerId: string, year: number, exceptId: string) {
  return roundCurrency(allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year && allocation.id !== exceptId)
    .reduce((total, allocation) => total + allocation.amount, 0));
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
  if (typeof window === "undefined") return { customerId: "", year: undefined as number | undefined };
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  return {
    customerId: params.get("customerId") ?? "",
    year: Number.isFinite(year) && year >= 2020 && year <= 2100 ? year : undefined,
  };
}
