"use client";

import { Building2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Customer } from "@/data/mockData";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DualListSelector } from "@/components/shared/dual-list-selector";
import { useDeliveryStore } from "@/store/delivery-store";
import { formatCurrency, makeId } from "@/lib/utils";

const financialDirectorIds = ["ca", "ane"];
const deliveryManagerIds = ["bruno", "orion", "fernanda", "bonfim", "ana"];
const itauManagerIds = ["bruno", "orion", "fernanda", "bonfim"];
const anaManagerIds = ["ana"];

export function CustomerManagement() {
  const initialCustomerId = useMemo(() => getInitialCustomerId(), []);
  const { customers, people, saveCustomer, deleteCustomer } = useDeliveryStore();
  const initialCustomer = customers.find((customer) => customer.id === initialCustomerId);
  const [search, setSearch] = useState(initialCustomer?.name ?? "");
  const [director, setDirector] = useState("");
  const [manager, setManager] = useState("");
  const [strategic, setStrategic] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissInitialOpen, setDismissInitialOpen] = useState(false);
  const [formName, setFormName] = useState(initialCustomer?.name ?? "");
  const [formDirectorId, setFormDirectorId] = useState(initialCustomer?.directorResponsibleId ?? "ane");
  const [formManagerIds, setFormManagerIds] = useState<string[]>(initialCustomer?.managerResponsibleIds ?? anaManagerIds);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const directors = people.filter((person) => financialDirectorIds.includes(person.id));
  const managers = people.filter((person) => deliveryManagerIds.includes(person.id));
  const linkedEditing = editing ?? (!dismissInitialOpen ? initialCustomer ?? null : null);
  const open = manualOpen || Boolean(linkedEditing && !dismissInitialOpen);

  const filtered = useMemo(() => customers.filter((customer) => {
    const query = search.toLowerCase();
    return (!query || `${customer.name} ${customer.industry}`.toLowerCase().includes(query))
      && (!director || customer.directorResponsibleId === director)
      && (!manager || customer.managerResponsibleIds.includes(manager))
      && (!strategic || String(customer.strategicAccount) === strategic);
  }), [customers, director, manager, search, strategic]);

  const totalRevenue = filtered.reduce((sum, customer) => sum + customer.revenue, 0);
  const averageMargin = filtered.length ? filtered.reduce((sum, customer) => sum + customer.margin, 0) / filtered.length : 0;

  function openForm(item?: Customer) {
    setEditing(item ?? null);
    const defaults = getCustomerDefaults(item?.name ?? "");
    setFormName(item?.name ?? "");
    setFormDirectorId(item?.directorResponsibleId ?? defaults.directorResponsibleId);
    setFormManagerIds(item?.managerResponsibleIds ?? defaults.managerResponsibleIds);
    setFormError("");
    setManualOpen(true);
    setDismissInitialOpen(false);
  }

  function applyCustomerRules(name: string) {
    const defaults = getCustomerDefaults(name);
    setFormDirectorId(defaults.directorResponsibleId);
    setFormManagerIds(defaults.managerResponsibleIds);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("name"));
    const defaults = getCustomerDefaults(customerName);
    const validManagers = formManagerIds.filter((id) => deliveryManagerIds.includes(id));
    try {
      setFormError("");
      await saveCustomer({
      id: linkedEditing?.id ?? makeId("customer"),
      name: customerName,
      industry: String(formData.get("industry")),
      directorResponsibleId: String(formData.get("directorResponsibleId") || defaults.directorResponsibleId),
      managerResponsibleIds: validManagers.length ? validManagers : defaults.managerResponsibleIds,
      revenue: Number(formData.get("revenue")),
      margin: Number(formData.get("margin")),
      strategicAccount: formData.get("strategicAccount") === "true",
      });
      setManualOpen(false);
      setDismissInitialOpen(true);
      setSuccessMessage(`Cliente ${customerName} salvo com sucesso.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Portfólio executivo"
        title="Clientes"
        description="Acompanhe responsáveis, receita, margem e relevância estratégica das contas."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Novo cliente</Button>}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <Summary label="Clientes filtrados" value={String(filtered.length)} />
        <Summary label="Receita da carteira" value={formatCurrency(totalRevenue)} />
        <Summary label="Margem média" value={`${averageMargin.toFixed(1).replace(".", ",")}%`} />
      </section>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={director} onChange={(event) => setDirector(event.target.value)}><option value="">Todos os diretores</option>{directors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={manager} onChange={(event) => setManager(event.target.value)}><option value="">Todos os managers</option>{managers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={strategic} onChange={(event) => setStrategic(event.target.value)}><option value="">Todas as contas</option><option value="true">Estratégicas</option><option value="false">Não estratégicas</option></Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Responsáveis</TableHead>
              <TableHead>Receita</TableHead><TableHead>Margem</TableHead><TableHead>Estratégica</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  title="Dê duplo clique para editar o cliente"
                  onDoubleClick={() => openForm(customer)}
                >
                  <TableCell><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-brq-purple"><Building2 className="h-5 w-5" /></div><div><p className="font-semibold">{customer.name}</p><p className="text-xs text-slate-400">{customer.industry}</p></div></div></TableCell>
                  <TableCell><p>{customer.managerResponsibleIds.map((id) => people.find((item) => item.id === id)?.name ?? id).join(", ")}</p><p className="text-xs text-slate-400">{people.find((item) => item.id === customer.directorResponsibleId)?.name}</p></TableCell>
                  <TableCell className="font-semibold">{formatCurrency(customer.revenue)}</TableCell>
                  <TableCell><span className={customer.margin < 18 ? "font-semibold text-amber-600" : "text-emerald-700"}>{customer.margin.toFixed(1).replace(".", ",")}%</span></TableCell>
                  <TableCell>{customer.strategicAccount ? <Badge><Star className="mr-1 h-3 w-3 fill-current" /> Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                  <TableCell onDoubleClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openForm(customer)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => {
                      if (window.confirm(`Excluir o cliente ${customer.name}?`)) void deleteCustomer(customer.id).catch(() => undefined);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!filtered.length && <EmptyState />}
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => {
        setManualOpen(nextOpen);
        if (!nextOpen) {
          setEditing(null);
          setDismissInitialOpen(true);
        }
      }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{linkedEditing ? "Editar cliente" : "Novo cliente"}</DialogTitle><DialogDescription>Cadastre a conta e seus indicadores executivos.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do cliente"><Input name="name" value={formName} onChange={(event) => setFormName(event.target.value)} onBlur={(event) => applyCustomerRules(event.target.value)} maxLength={160} required /></Field>
            <Field label="Indústria"><Input name="industry" defaultValue={linkedEditing?.industry ?? "Financial Services"} maxLength={120} required /></Field>
            <Field label="Diretor responsável"><Select name="directorResponsibleId" value={formDirectorId} onChange={(event) => setFormDirectorId(event.target.value)} required><option value="">Selecione</option>{directors.map((item) => <option key={item.id} value={item.id}>{displayDirectorName(item.name)}</option>)}</Select></Field>
            <Field label="Managers responsáveis" className="md:col-span-2">
              <DualListSelector
                items={managers.map((item) => ({
                  id: item.id,
                  label: item.name,
                  description: item.jobTitle,
                }))}
                selectedIds={formManagerIds}
                onChange={setFormManagerIds}
                availableTitle="Managers disponíveis"
                selectedTitle="Managers selecionados"
                availableSearchPlaceholder="Buscar manager disponível"
                selectedSearchPlaceholder="Buscar manager selecionado"
                emptyAvailableMessage="Todos os managers de Delivery já foram selecionados."
                emptySelectedMessage="Nenhum manager selecionado."
              />
              <span className="mt-1 block text-xs text-slate-400">Mova um ou mais managers para a lista de selecionados. A regra automática apenas sugere o padrão inicial.</span>
            </Field>
            <Field label="Conta estratégica"><Select name="strategicAccount" defaultValue={String(linkedEditing?.strategicAccount ?? true)}><option value="true">Sim</option><option value="false">Não</option></Select></Field>
            <Field label="Receita (R$)"><Input name="revenue" type="number" min="0" step="1000" defaultValue={linkedEditing?.revenue} required /></Field>
            <Field label="Margem (%)"><Input name="margin" type="number" min="0" max="100" step="0.1" defaultValue={linkedEditing?.margin} required /></Field>
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => {
              setManualOpen(false);
              setDismissInitialOpen(true);
            }}>Cancelar</Button><Button type="submit">Salvar cliente</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card className="p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></Card>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function getFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar. Verifique permissões, dados e conexão.";
}

function getCustomerDefaults(name: string) {
  const normalized = normalizeName(name);
  if (normalized.includes("itau")) {
    return { directorResponsibleId: "ca", managerResponsibleIds: itauManagerIds };
  }
  if (normalized.includes("alelo") || normalized.includes("nuclea") || normalized === "cip") {
    return { directorResponsibleId: "ca", managerResponsibleIds: anaManagerIds };
  }
  return { directorResponsibleId: "ane", managerResponsibleIds: anaManagerIds };
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function displayDirectorName(name: string) {
  return name.startsWith("Ane Knust") ? "Ane Knust" : name;
}

function getInitialCustomerId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("customerId") ?? "";
}
