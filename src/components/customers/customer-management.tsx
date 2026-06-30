"use client";

import { Building2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Customer, Person, TargetAllocation } from "@/data/mockData";
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
import { getFinancialCustomerMetric } from "@/lib/financial-customers";
import { isCustomerManagerProfile, isTargetAssignableRole } from "@/lib/roles";
import { formatCurrency, makeId } from "@/lib/utils";

const itauManagerIds = ["bruno", "orion", "fernanda", "bonfim"];
const anaManagerIds = ["ana"];
const currentYear = 2026;

interface CustomerTargetBreakdown {
  hunter: number;
  farmerRenewal: number;
  total: number;
}

interface CustomerAllocationWarningData {
  customerId: string;
  year: number;
  target: number;
  allocated: number;
  gap: number;
  people: Pick<Person, "id" | "name" | "jobTitle" | "roleType">[];
}

interface CustomerAllocationCompositionData {
  customerId: string;
  year: number;
  rows: CustomerAllocationPersonRow[];
  allocatedHunter: number;
  allocatedFarmerRenewal: number;
  allocatedTotal: number;
  openHunter: number;
  openFarmerRenewal: number;
  openTotal: number;
  overHunter: number;
  overFarmerRenewal: number;
  overTotal: number;
}

interface CustomerAllocationPersonRow {
  personId: string;
  personName: string;
  jobTitle: string;
  roleType: string;
  hunter: number;
  farmerRenewal: number;
  total: number;
}

interface CustomerTargetPerson {
  personId: string;
  name: string;
  roleType: string;
  amount: number;
}

export function CustomerManagement() {
  const initialCustomerId = useMemo(() => getInitialCustomerId(), []);
  const { customers, people, targetAllocations, saveCustomer, deleteCustomer } = useDeliveryStore();
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
  const [formManagerIds, setFormManagerIds] = useState<string[]>(initialCustomer?.managerResponsibleIds ?? []);
  const [formRevenue, setFormRevenue] = useState(getInputValue(initialCustomer?.revenue ?? getFinancialCustomerMetric(initialCustomer?.name ?? "", "revenueTarget")));
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const directors = useMemo(() => people
    .filter((person) => person.active && person.roleType === "Director")
    .sort((first, second) => first.name.localeCompare(second.name)),
  [people]);
  const managers = useMemo(() => people
    .filter((person) => person.active && isCustomerManagerProfile(person.roleType, person.isManager))
    .sort((first, second) => first.name.localeCompare(second.name)),
  [people]);
  const managerIds = useMemo(() => new Set(managers.map((person) => person.id)), [managers]);
  const linkedEditing = editing ?? (!dismissInitialOpen ? initialCustomer ?? null : null);
  const open = manualOpen || Boolean(linkedEditing && !dismissInitialOpen);

  const filtered = useMemo(() => customers.filter((customer) => {
    const query = search.toLowerCase();
    return (!query || `${customer.name} ${customer.industry}`.toLowerCase().includes(query))
      && (!director || customer.directorResponsibleId === director)
      && (!manager || customer.managerResponsibleIds.includes(manager))
      && (!strategic || String(customer.strategicAccount) === strategic);
  }), [customers, director, manager, search, strategic]);

  const targetTotals = filtered.reduce((totals, customer) => {
    const breakdown = getCustomerTargetBreakdown(customer);
    return {
      hunter: totals.hunter + breakdown.hunter,
      farmerRenewal: totals.farmerRenewal + breakdown.farmerRenewal,
      total: totals.total + breakdown.total,
    };
  }, { hunter: 0, farmerRenewal: 0, total: 0 });
  const averageMargin = filtered.length ? filtered.reduce((sum, customer) => sum + customer.margin, 0) / filtered.length : 0;
  const formBreakdown = getCustomerTargetBreakdown({
    id: linkedEditing?.id ?? "",
    name: formName || linkedEditing?.name || "",
    industry: linkedEditing?.industry ?? "Financial Services",
    directorResponsibleId: formDirectorId,
    managerResponsibleIds: formManagerIds,
    revenue: parseAmount(formRevenue),
    margin: linkedEditing?.margin ?? 0,
    strategicAccount: linkedEditing?.strategicAccount ?? true,
  });
  const allocationComposition = linkedEditing
    ? getCustomerAllocationComposition(
      {
        ...linkedEditing,
        name: formName || linkedEditing.name,
        managerResponsibleIds: formManagerIds,
        revenue: parseAmount(formRevenue),
      },
      people,
      targetAllocations,
      currentYear,
      formBreakdown,
    )
    : null;
  const allocationWarning = linkedEditing
    ? getCustomerAllocationWarning(
      {
        ...linkedEditing,
        name: formName || linkedEditing.name,
        managerResponsibleIds: formManagerIds,
        revenue: parseAmount(formRevenue),
      },
      people,
      targetAllocations,
      currentYear,
    )
    : null;

  function openForm(item?: Customer) {
    setEditing(item ?? null);
    const defaults = getCustomerDefaults(item?.name ?? "");
    setFormName(item?.name ?? "");
    setFormDirectorId(item?.directorResponsibleId ?? defaults.directorResponsibleId);
    setFormManagerIds(item?.managerResponsibleIds ?? defaults.managerResponsibleIds);
    setFormRevenue(getInputValue(item?.revenue ?? getFinancialCustomerMetric(item?.name ?? "", "revenueTarget")));
    setFormError("");
    setManualOpen(true);
    setDismissInitialOpen(false);
  }

  function applyCustomerRules(name: string) {
    if (linkedEditing) return;
    const defaults = getCustomerDefaults(name);
    setFormDirectorId(defaults.directorResponsibleId);
    setFormManagerIds(defaults.managerResponsibleIds);
    const importedTarget = getFinancialCustomerMetric(name, "revenueTarget");
    if (!linkedEditing && importedTarget > 0) {
      setFormRevenue(getInputValue(importedTarget));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("name"));
    const defaults = getCustomerDefaults(customerName);
    const validManagers = formManagerIds.filter((id) => managerIds.has(id));
    try {
      setFormError("");
      await saveCustomer({
      id: linkedEditing?.id ?? makeId("customer"),
      name: customerName,
      industry: String(formData.get("industry")),
      directorResponsibleId: String(formData.get("directorResponsibleId") || defaults.directorResponsibleId),
      managerResponsibleIds: validManagers,
      revenue: parseAmount(formRevenue),
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
        description="Acompanhe responsáveis, metas financeiras, margem e relevância estratégica das contas."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Novo cliente</Button>}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Summary label="Clientes filtrados" value={String(filtered.length)} />
        <Summary label="Meta Hunter" value={formatCurrency(targetTotals.hunter)} />
        <Summary label="Renovação + Ampliação" value={formatCurrency(targetTotals.farmerRenewal)} />
        <Summary label="Meta total" value={formatCurrency(targetTotals.total)} />
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
              <TableHead>Cliente</TableHead><TableHead>Diretor responsável</TableHead>
              <TableHead>Hunters / Farmers</TableHead><TableHead>Metas</TableHead><TableHead>Margem</TableHead><TableHead>Estratégica</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((customer) => {
                const breakdown = getCustomerTargetBreakdown(customer);
                const targetPeople = getCustomerTargetPeople(customer, people, targetAllocations, currentYear);
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    title="Dê duplo clique para editar o cliente"
                    onDoubleClick={() => openForm(customer)}
                  >
                    <TableCell><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-brq-purple"><Building2 className="h-5 w-5" /></div><div><p className="font-semibold">{customer.name}</p><p className="text-xs text-slate-400">{customer.industry}</p></div></div></TableCell>
                    <TableCell>
                      <p>{displayDirectorName(people.find((item) => item.id === customer.directorResponsibleId)?.name ?? customer.directorResponsibleId)}</p>
                      <p className="text-xs text-slate-400">Governança Delivery</p>
                    </TableCell>
                    <TableCell><CustomerTargetPeopleView hunterPeople={targetPeople.hunterPeople} farmerRenewalPeople={targetPeople.farmerRenewalPeople} /></TableCell>
                    <TableCell><TargetBreakdownView breakdown={breakdown} /></TableCell>
                    <TableCell><span className={customer.margin < 18 ? "font-semibold text-amber-600" : "text-emerald-700"}>{customer.margin.toFixed(1).replace(".", ",")}%</span></TableCell>
                    <TableCell>{customer.strategicAccount ? <Badge><Star className="mr-1 h-3 w-3 fill-current" /> Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                    <TableCell onDoubleClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm(customer)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => {
                        if (window.confirm(`Excluir o cliente ${customer.name}?`)) void deleteCustomer(customer.id).catch(() => undefined);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                );
              })}
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
            <Field label="Meta total (R$)">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <span className="mr-2 text-sm font-semibold text-slate-400">R$</span>
                <Input
                  name="revenue"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={formRevenue}
                  onChange={(event) => setFormRevenue(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-10 border-0 px-0 text-right font-semibold tabular-nums focus:ring-0"
                  required
                />
              </div>
              <span className="mt-1 block text-xs text-slate-500">{formatCurrency(parseAmount(formRevenue))}</span>
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Composição da meta</p>
              <TargetBreakdownView breakdown={formBreakdown} compact />
              {allocationComposition && <CustomerAllocationCompositionView composition={allocationComposition} />}
              <p className="mt-2 text-xs text-slate-500">
                A quebra Hunter / Renovação + Ampliação vem da carga Financial BU; a distribuição por pessoa vem de Metas por Pessoa.
              </p>
            </div>
            {allocationWarning && <CustomerAllocationWarning warning={allocationWarning} />}
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

function TargetBreakdownView({ breakdown, compact = false }: { breakdown: CustomerTargetBreakdown; compact?: boolean }) {
  const containerClassName = compact
    ? "mt-3 grid gap-2 text-sm md:grid-cols-3"
    : "grid min-w-56 gap-1 text-sm";
  return (
    <div className={containerClassName}>
      <MoneyLine label="Hunter" value={breakdown.hunter} />
      <MoneyLine label="Renov. + Ampl." value={breakdown.farmerRenewal} />
      <MoneyLine label="Total" value={breakdown.total} strong />
    </div>
  );
}

function MoneyLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "border-t border-slate-200 pt-1 font-bold text-slate-950" : "text-slate-600"}`}>
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function CustomerTargetPeopleView({
  hunterPeople,
  farmerRenewalPeople,
}: {
  hunterPeople: CustomerTargetPerson[];
  farmerRenewalPeople: CustomerTargetPerson[];
}) {
  return (
    <div className="min-w-60 space-y-2 text-xs">
      <CustomerTargetPeopleGroup label="Hunters" people={hunterPeople} emptyLabel="Sem hunter" tone="orange" />
      <CustomerTargetPeopleGroup label="Farmers / Delivery" people={farmerRenewalPeople} emptyLabel="Sem farmer/delivery" tone="purple" />
    </div>
  );
}

function CustomerTargetPeopleGroup({
  label,
  people,
  emptyLabel,
  tone,
}: {
  label: string;
  people: CustomerTargetPerson[];
  emptyLabel: string;
  tone: "orange" | "purple";
}) {
  const toneClassName = tone === "orange"
    ? "bg-orange-50 text-orange-800"
    : "bg-purple-50 text-brq-purple";

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {people.length ? (
        <div className="flex max-w-80 flex-wrap gap-1.5">
          {people.map((person) => (
            <span key={`${label}-${person.personId}`} className={`rounded-full px-2 py-1 font-semibold ${toneClassName}`} title={`${person.name} · ${formatCurrency(person.amount)}`}>
              {person.name}
              <span className="ml-1 opacity-70">{formatCurrency(person.amount)}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-slate-400">{emptyLabel}</span>
      )}
    </div>
  );
}

function CustomerAllocationCompositionView({ composition }: { composition: CustomerAllocationCompositionData }) {
  const hasOpenAmount = hasVisibleCurrencyAmount(composition.openTotal);
  const hasOverAmount = hasVisibleCurrencyAmount(composition.overTotal);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Distribuição por pessoa · {composition.year}</p>
          <p className="text-sm text-slate-500">
            Alocado: <span className="font-semibold text-slate-800">{formatCurrency(composition.allocatedTotal)}</span>
            {hasOpenAmount && <> · Em aberto: <span className="font-semibold text-amber-700">{formatCurrency(composition.openTotal)}</span></>}
            {hasOverAmount && <> · Acima da meta: <span className="font-semibold text-red-700">{formatCurrency(composition.overTotal)}</span></>}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/metas-pessoas?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
            Ajustar metas
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Pessoa</th>
              <th className="px-4 py-2 font-semibold">Perfil</th>
              <th className="px-4 py-2 text-right font-semibold">Hunter</th>
              <th className="px-4 py-2 text-right font-semibold">Renov. + Ampl.</th>
              <th className="px-4 py-2 text-right font-semibold">Total</th>
              <th className="px-4 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {composition.rows.map((row) => (
              <tr key={row.personId}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{row.personName}</p>
                  <p className="text-xs text-slate-400">{row.jobTitle}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">{row.roleType}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.hunter)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.farmerRenewal)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(row.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-brq-purple hover:underline" href={`/metas-pessoas?personId=${encodeURIComponent(row.personId)}&customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {hasOpenAmount && (
              <tr className="bg-amber-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-amber-900">Em aberto sem pessoa alocada</p>
                  <p className="text-xs text-amber-700">Distribua este saldo em Metas por Pessoa.</p>
                </td>
                <td className="px-4 py-3 text-amber-700">Pendente</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-800">{formatCurrency(composition.openHunter)}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-800">{formatCurrency(composition.openFarmerRenewal)}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-900">{formatCurrency(composition.openTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-amber-800 hover:underline" href={`/metas-pessoas?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Alocar
                  </Link>
                </td>
              </tr>
            )}
            {hasOverAmount && (
              <tr className="bg-red-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-red-900">Acima da meta do cliente</p>
                  <p className="text-xs text-red-700">Revise a meta total ou reduza a distribuição por pessoa.</p>
                </td>
                <td className="px-4 py-3 text-red-700">Excedente</td>
                <td className="px-4 py-3 text-right font-semibold text-red-800">{formatCurrency(composition.overHunter)}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-800">{formatCurrency(composition.overFarmerRenewal)}</td>
                <td className="px-4 py-3 text-right font-bold text-red-900">{formatCurrency(composition.overTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-red-800 hover:underline" href={`/metas-pessoas?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Revisar
                  </Link>
                </td>
              </tr>
            )}
            {!composition.rows.length && !hasOpenAmount && !hasOverAmount && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Ainda não há meta associada a pessoas para este cliente no ano selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerAllocationWarning({ warning }: { warning: CustomerAllocationWarningData }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 md:col-span-2">
      <p className="font-semibold">Meta do cliente acima da distribuição por pessoa</p>
      <p className="mt-1 text-sm">
        Para {warning.year}, a meta total do cliente está {formatCurrency(warning.gap)} acima da soma já associada às pessoas:
        {" "}{formatCurrency(warning.target)} de meta vs. {formatCurrency(warning.allocated)} distribuído.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {warning.people.length ? warning.people.map((person) => (
          <Button key={person.id} asChild variant="outline" size="sm" className="border-amber-300 bg-white/80 text-amber-950 hover:bg-white">
            <Link href={`/metas-pessoas?personId=${encodeURIComponent(person.id)}&customerId=${encodeURIComponent(warning.customerId)}&year=${warning.year}`}>
              Ajustar {person.name}
            </Link>
          </Button>
        )) : (
          <Button asChild variant="outline" size="sm" className="border-amber-300 bg-white/80 text-amber-950 hover:bg-white">
            <Link href={`/metas-pessoas?customerId=${encodeURIComponent(warning.customerId)}&year=${warning.year}`}>
              Abrir Metas por Pessoa
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
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

function getCustomerTargetBreakdown(customer: Customer): CustomerTargetBreakdown {
  const customerTarget = getCustomerTarget(customer);
  const importedHunter = getFinancialCustomerMetric(customer.name, "hunterRevenue");
  const importedFarmerRenewal = getFinancialCustomerMetric(customer.name, "deliveryFarmerRevenue");
  const importedTotal = importedHunter + importedFarmerRenewal;

  if (customerTarget <= 0) return { hunter: 0, farmerRenewal: 0, total: 0 };
  if (importedTotal <= 0) return { hunter: 0, farmerRenewal: customerTarget, total: customerTarget };

  const ratio = customerTarget / importedTotal;
  const hunter = roundCurrency(importedHunter * ratio);
  const farmerRenewal = roundCurrency(customerTarget - hunter);
  return { hunter, farmerRenewal, total: roundCurrency(hunter + farmerRenewal) };
}

function getCustomerTarget(customer: Customer) {
  return Number.isFinite(customer.revenue) ? customer.revenue : getFinancialCustomerMetric(customer.name, "revenueTarget");
}

function getCustomerAllocationWarning(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  year: number,
): CustomerAllocationWarningData | null {
  const target = getCustomerTarget(customer);
  const customerAllocations = allocations.filter((allocation) => allocation.customerId === customer.id && allocation.year === year);
  const allocated = customerAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const gap = roundCurrency(target - allocated);

  if (gap <= 0.01) return null;

  const involvedIds = new Set([
    ...customer.managerResponsibleIds,
    ...customerAllocations.map((allocation) => allocation.personId),
  ]);
  const involvedPeople = people
    .filter((person) => involvedIds.has(person.id) && person.active && isTargetAssignableRole(person.roleType))
    .sort((first, second) => {
      const firstIsManager = customer.managerResponsibleIds.includes(first.id) ? 0 : 1;
      const secondIsManager = customer.managerResponsibleIds.includes(second.id) ? 0 : 1;
      return firstIsManager - secondIsManager || first.name.localeCompare(second.name);
    })
    .map((person) => ({
      id: person.id,
      name: person.name,
      jobTitle: person.jobTitle,
      roleType: person.roleType,
    }));

  return { customerId: customer.id, year, target, allocated, gap, people: involvedPeople };
}

function getCustomerAllocationComposition(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  year: number,
  targetBreakdown: CustomerTargetBreakdown,
): CustomerAllocationCompositionData {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rowsByPerson = new Map<string, CustomerAllocationPersonRow>();

  allocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const current = rowsByPerson.get(allocation.personId) ?? {
        personId: allocation.personId,
        personName: person?.name ?? allocation.personId,
        jobTitle: person?.jobTitle ?? "Pessoa não encontrada",
        roleType: person?.roleType ?? "Sem perfil",
        hunter: 0,
        farmerRenewal: 0,
        total: 0,
      };

      if (allocation.type === "hunter") {
        current.hunter += allocation.amount;
      } else {
        current.farmerRenewal += allocation.amount;
      }
      current.total = current.hunter + current.farmerRenewal;
      rowsByPerson.set(allocation.personId, current);
    });

  const rows = Array.from(rowsByPerson.values())
    .map((row) => ({
      ...row,
      hunter: roundCurrency(row.hunter),
      farmerRenewal: roundCurrency(row.farmerRenewal),
      total: roundCurrency(row.total),
    }))
    .sort((first, second) => second.total - first.total || first.personName.localeCompare(second.personName));
  const allocatedHunter = roundCurrency(rows.reduce((total, row) => total + row.hunter, 0));
  const allocatedFarmerRenewal = roundCurrency(rows.reduce((total, row) => total + row.farmerRenewal, 0));
  const allocatedTotal = roundCurrency(allocatedHunter + allocatedFarmerRenewal);
  const hunterGap = roundCurrency(targetBreakdown.hunter - allocatedHunter);
  const farmerRenewalGap = roundCurrency(targetBreakdown.farmerRenewal - allocatedFarmerRenewal);
  const totalGap = roundCurrency(targetBreakdown.total - allocatedTotal);
  const openTotal = Math.max(0, totalGap);
  const overTotal = Math.max(0, roundCurrency(-totalGap));
  const openSplit = splitFinancialGap(openTotal, Math.max(0, hunterGap), Math.max(0, farmerRenewalGap));
  const overSplit = splitFinancialGap(overTotal, Math.max(0, -hunterGap), Math.max(0, -farmerRenewalGap));

  return {
    customerId: customer.id,
    year,
    rows,
    allocatedHunter,
    allocatedFarmerRenewal,
    allocatedTotal,
    openHunter: openSplit.hunter,
    openFarmerRenewal: openSplit.farmerRenewal,
    openTotal,
    overHunter: overSplit.hunter,
    overFarmerRenewal: overSplit.farmerRenewal,
    overTotal,
  };
}

function getCustomerTargetPeople(customer: Customer, people: Person[], allocations: TargetAllocation[], year: number) {
  return {
    hunterPeople: getCustomerTargetPeopleByType(customer, people, allocations, year, "hunter"),
    farmerRenewalPeople: getCustomerTargetPeopleByType(customer, people, allocations, year, "farmer_renewal"),
  };
}

function getCustomerTargetPeopleByType(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  year: number,
  type: "hunter" | "farmer_renewal",
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const totalsByPerson = new Map<string, CustomerTargetPerson>();

  allocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.type === type)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const current = totalsByPerson.get(allocation.personId) ?? {
        personId: allocation.personId,
        name: person?.name ?? allocation.personId,
        roleType: person?.roleType ?? "Sem perfil",
        amount: 0,
      };
      current.amount += allocation.amount;
      totalsByPerson.set(allocation.personId, current);
    });

  return Array.from(totalsByPerson.values())
    .filter((person) => person.amount > 0.01)
    .map((person) => ({ ...person, amount: roundCurrency(person.amount) }))
    .sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name));
}

function getInputValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
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
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isThousandSeparatedAmount(value: string) {
  return /^\d{1,3}(\.\d{3})+$/.test(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function splitFinancialGap(total: number, hunterCandidate: number, farmerRenewalCandidate: number) {
  const visibleTotal = roundCurrency(total);
  if (!hasVisibleCurrencyAmount(visibleTotal)) {
    return { hunter: 0, farmerRenewal: 0 };
  }

  const candidateTotal = roundCurrency(hunterCandidate + farmerRenewalCandidate);
  if (!hasVisibleCurrencyAmount(candidateTotal)) {
    return { hunter: 0, farmerRenewal: visibleTotal };
  }

  const hunter = roundCurrency(visibleTotal * (hunterCandidate / candidateTotal));
  return { hunter, farmerRenewal: roundCurrency(visibleTotal - hunter) };
}

function hasVisibleCurrencyAmount(value: number) {
  return Math.abs(Math.round(value)) >= 1;
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
