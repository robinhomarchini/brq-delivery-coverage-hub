"use client";

import { Pencil, Plus, Target, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Customer, TargetAllocation, TargetAllocationType } from "@/data/mockData";
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
import { formatCurrency, makeId } from "@/lib/utils";
import { getFinancialCustomerMetric } from "@/lib/financial-customers";

const currentYear = 2026;

export function TargetManagement() {
  const { customers, people, targetAllocations, saveTargetAllocation, deleteTargetAllocation } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [personId, setPersonId] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [editing, setEditing] = useState<TargetAllocation | null>(null);
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [focusAmountOnOpen, setFocusAmountOnOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const activePeople = useMemo(() => people.filter((person) => person.active), [people]);
  const years = useMemo(() => Array.from(new Set([currentYear, ...targetAllocations.map((item) => item.year)])).sort((a, b) => b - a), [targetAllocations]);

  const filtered = useMemo(() => targetAllocations.filter((allocation) => {
    const customer = customers.find((item) => item.id === allocation.customerId);
    const person = people.find((item) => item.id === allocation.personId);
    const query = search.toLowerCase();
    return (!query || `${customer?.name ?? ""} ${person?.name ?? ""} ${allocation.notes ?? ""}`.toLowerCase().includes(query))
      && (!customerId || allocation.customerId === customerId)
      && (!personId || allocation.personId === personId)
      && (!type || allocation.type === type)
      && (!year || allocation.year === Number(year));
  }), [customerId, customers, people, personId, search, targetAllocations, type, year]);

  const totals = useMemo(() => filtered.reduce((summary, allocation) => ({
    hunter: summary.hunter + (allocation.type === "hunter" ? allocation.amount : 0),
    farmerRenewal: summary.farmerRenewal + (allocation.type === "farmer_renewal" ? allocation.amount : 0),
  }), { hunter: 0, farmerRenewal: 0 }), [filtered]);
  const reconciliation = useMemo(() => buildReconciliation(customers, targetAllocations, Number(year) || currentYear), [customers, targetAllocations, year]);
  const reconciledCount = reconciliation.filter((item) => item.status === "ok").length;
  const pendingCount = reconciliation.filter((item) => item.status === "pending").length;
  const overTargetCount = reconciliation.filter((item) => item.status === "over").length;

  useEffect(() => {
    if (!open || !focusAmountOnOpen) return;
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
      setFocusAmountOnOpen(false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusAmountOnOpen, open]);

  function openForm(allocation?: TargetAllocation, options?: { focusAmount?: boolean }) {
    setEditing(allocation ?? null);
    setFormError("");
    setFocusAmountOnOpen(Boolean(options?.focusAmount));
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const draft: TargetAllocation = {
      id: editing?.id ?? makeId("target"),
      customerId: String(formData.get("customerId")),
      personId: String(formData.get("personId")),
      type: String(formData.get("type")) as TargetAllocationType,
      year: Number(formData.get("year")),
      amount: Number(formData.get("amount")),
      notes: String(formData.get("notes") ?? ""),
    };

    const duplicate = targetAllocations.find((allocation) =>
      allocation.id !== draft.id
      && allocation.customerId === draft.customerId
      && allocation.personId === draft.personId
      && allocation.type === draft.type
      && allocation.year === draft.year
    );

    if (duplicate) {
      setFormError("Já existe uma meta cadastrada para este cliente, pessoa, tipo e ano. Edite a meta existente.");
      return;
    }

    const nextAllocations = targetAllocations.some((allocation) => allocation.id === draft.id)
      ? targetAllocations.map((allocation) => (allocation.id === draft.id ? draft : allocation))
      : [...targetAllocations, draft];
    const customer = customers.find((item) => item.id === draft.customerId);
    const target = customer ? getCustomerTarget(customer) : 0;
    const allocated = sumAllocations(nextAllocations, draft.customerId, draft.year);

    if (target > 0 && allocated > target + 0.01) {
      setFormError(`A soma das metas das pessoas para este cliente ficaria acima da meta total. Meta do cliente: ${formatCurrency(target)}. Soma após salvar: ${formatCurrency(allocated)}.`);
      return;
    }

    try {
      setFormError("");
      await saveTargetAllocation(draft);
      setOpen(false);
      const difference = target - allocated;
      setSuccessMessage(Math.abs(difference) <= 0.01
        ? "Meta salva com sucesso. Cliente reconciliado com a meta total."
        : `Meta salva. Ainda faltam ${formatCurrency(Math.max(difference, 0))} para fechar a meta total do cliente.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Metas por cliente e pessoa"
        description="Cadastre metas Hunter e Farmer/Renovação separadas por cliente, pessoa e ano. Hunter é apenas atribuição de reporting; ownership de Delivery continua nos clientes e managers."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nova meta</Button>}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <Summary label="Meta Hunter" value={formatCurrency(totals.hunter)} tone="purple" />
        <Summary label="Meta Farmer/Renovação" value={formatCurrency(totals.farmerRenewal)} tone="blue" />
        <Summary label="Meta Total" value={formatCurrency(totals.hunter + totals.farmerRenewal)} tone="dark" />
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <Summary label="Clientes reconciliados" value={String(reconciledCount)} tone="blue" />
        <Summary label="Clientes pendentes" value={String(pendingCount)} tone="purple" />
        <Summary label="Clientes acima da meta" value={String(overTargetCount)} tone="dark" />
      </section>

      <Card className="mb-5 overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Conciliação por cliente</h2>
          <p className="mt-1 text-xs text-slate-500">A soma das metas das pessoas deve bater com a meta total do cliente no ano selecionado.</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Meta do Cliente</TableHead>
                <TableHead>Soma das Pessoas</TableHead>
                <TableHead>Diferença</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliation.map((item) => (
                <TableRow key={item.customerId}>
                  <TableCell className="font-semibold text-slate-900">{item.customerName}</TableCell>
                  <TableCell>{formatCurrency(item.target)}</TableCell>
                  <TableCell>{formatCurrency(item.allocated)}</TableCell>
                  <TableCell className={item.difference < -0.01 ? "font-semibold text-red-700" : item.difference > 0.01 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
                    {formatCurrency(item.difference)}
                  </TableCell>
                  <TableCell><ReconciliationBadge status={item.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </Select>
        <Select value={personId} onChange={(event) => setPersonId(event.target.value)}>
          <option value="">Todas as pessoas</option>
          {activePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </Select>
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="hunter">Hunter</option>
          <option value="farmer_renewal">Farmer/Renovação</option>
        </Select>
        <Select value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="">Todos os anos</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Tipo de Meta</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Valor da Meta</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((allocation) => (
                <TableRow
                  key={allocation.id}
                  className="cursor-pointer"
                  title="Dê duplo clique para ajustar o valor da meta"
                  onDoubleClick={() => openForm(allocation, { focusAmount: true })}
                >
                  <TableCell className="font-semibold text-slate-900">{customerName(customers, allocation.customerId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-purple-50 text-brq-purple">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <span>{personName(people, allocation.personId)}</span>
                    </div>
                  </TableCell>
                  <TableCell><TypeBadge type={allocation.type} /></TableCell>
                  <TableCell>{allocation.year}</TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(allocation.amount)}</TableCell>
                  <TableCell className="max-w-xs truncate text-slate-500">{allocation.notes || "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm(allocation)}><Pencil className="h-4 w-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm("Excluir esta meta?")) {
                            void deleteTargetAllocation(allocation.id).catch(() => undefined);
                          }
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
        {!filtered.length && <EmptyState />}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar meta" : "Nova meta"}</DialogTitle>
            <DialogDescription>Informe cliente, pessoa, tipo de meta, ano e valor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <Select name="customerId" defaultValue={editing?.customerId ?? customers[0]?.id} required>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </Select>
            </Field>
            <Field label="Pessoa">
              <Select name="personId" defaultValue={editing?.personId ?? activePeople[0]?.id} required>
                {activePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de meta">
              <Select name="type" defaultValue={editing?.type ?? "farmer_renewal"} required>
                <option value="farmer_renewal">Farmer/Renovação</option>
                <option value="hunter">Hunter</option>
              </Select>
            </Field>
            <Field label="Ano">
              <Input name="year" type="number" min="2020" max="2100" step="1" defaultValue={editing?.year ?? currentYear} required />
            </Field>
            <Field label="Valor da meta (R$)">
              <Input ref={amountInputRef} name="amount" type="number" min="0" step="0.01" defaultValue={editing?.amount ?? 0} required />
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <Textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} maxLength={2000} />
            </Field>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit"><Target className="h-4 w-4" /> Salvar meta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: "purple" | "blue" | "dark" }) {
  const colors = {
    purple: "bg-purple-50 text-brq-purple",
    blue: "bg-sky-50 text-sky-700",
    dark: "bg-slate-950 text-white",
  };
  return (
    <Card className="flex items-center gap-4 p-5 shadow-sm">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${colors[tone]}`}>
        <Target className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      </div>
    </Card>
  );
}

function TypeBadge({ type }: { type: TargetAllocationType }) {
  if (type === "hunter") return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Hunter</Badge>;
  return <Badge className="bg-purple-100 text-brq-purple hover:bg-purple-100">Farmer/Renovação</Badge>;
}

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  if (status === "over") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Acima da meta</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function customerName(customers: { id: string; name: string }[], id: string) {
  return customers.find((customer) => customer.id === id)?.name ?? id;
}

function personName(people: { id: string; name: string }[], id: string) {
  return people.find((person) => person.id === id)?.name ?? id;
}

function getFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar a meta. Verifique dados, permissões e conexão.";
}

type ReconciliationStatus = "ok" | "pending" | "over";

function buildReconciliation(customers: Customer[], allocations: TargetAllocation[], year: number) {
  return customers.map((customer) => {
    const target = getCustomerTarget(customer);
    const allocated = sumAllocations(allocations, customer.id, year);
    const difference = target - allocated;
    return {
      customerId: customer.id,
      customerName: customer.name,
      target,
      allocated,
      difference,
      status: getReconciliationStatus(target, allocated),
    };
  });
}

function getReconciliationStatus(target: number, allocated: number): ReconciliationStatus {
  if (Math.abs(target - allocated) <= 0.01) return "ok";
  if (allocated > target) return "over";
  return "pending";
}

function sumAllocations(allocations: TargetAllocation[], customerId: string, year: number) {
  return allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year)
    .reduce((total, allocation) => total + allocation.amount, 0);
}

function getCustomerTarget(customer: Customer) {
  return getFinancialCustomerMetric(customer.name, "revenueTarget") || customer.revenue;
}
