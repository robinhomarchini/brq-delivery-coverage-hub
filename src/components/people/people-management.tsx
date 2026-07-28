"use client";

import { Pencil, Plus, Power, RotateCcw, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Person } from "@/data/mockData";
import type { RoleType } from "@/lib/roles";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { PersonAvatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { SortableTableHead, type SortDirection, type SortState } from "@/components/shared/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DualListSelector } from "@/components/shared/dual-list-selector";
import { useDeliveryStore } from "@/store/delivery-store";
import { useAccess } from "@/lib/access-context";
import { accessUsersChangedEvent } from "@/lib/access-events";
import { isHunterConsultAccess, normalizeAccessEmail, translateAccessRole, type AccessUser } from "@/lib/access-control";
import { canManageCompensation } from "@/lib/compensation-access";
import { buildHunterAccessScope } from "@/lib/hunter-access-scope";
import { createAccessRepositorySelection } from "@/lib/repositories/accessRepository";
import type { LifecycleStatus } from "@/lib/lifecycle";
import { getActiveFromLifecycle, getLifecycleStatusBadgeVariant, translateLifecycleStatus } from "@/lib/lifecycle";
import { makeId } from "@/lib/utils";
import { getHierarchyLevelForRole, getRoleBadgeVariant, isDeliveryManagerRole, isDirectorOrExecutiveRole, roleTypes, translateRole } from "@/lib/roles";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";

type PeopleSortKey = "person" | "jobTitle" | "role" | "director" | "area" | "status";

const suggestedJobTitles = [
  "Diretor Comercial",
  "Gerente Executivo de Vendas",
  "Executivo de Negócios",
];

export function PeopleManagement() {
  const {
    people,
    personCompensations,
    customers,
    areas,
    targetAllocations,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
    savePerson,
    savePersonCompensation,
    deletePersonCompensation,
  } = useDeliveryStore();
  const { accessUser, canEdit, isAdmin } = useAccess();
  const accessRepositorySelection = useMemo(() => createAccessRepositorySelection(), []);
  const accessRepository = accessRepositorySelection.repository;
  const [search, setSearch] = useState("");
  const [director, setDirector] = useState("");
  const [roleType, setRoleType] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [draftRoleType, setDraftRoleType] = useState<RoleType>("Delivery");
  const [draftLifecycleStatus, setDraftLifecycleStatus] = useState<LifecycleStatus>("active");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [systemUsers, setSystemUsers] = useState<AccessUser[]>([]);
  const [sortState, setSortState] = useState<SortState<PeopleSortKey>>({ key: "person", direction: "asc" });
  const directors = people.filter((person) => isDirectorOrExecutiveRole(person.roleType));
  const jobTitleOptions = useMemo(
    () => Array.from(new Set([...people.map((person) => person.jobTitle).filter(Boolean), ...suggestedJobTitles])).sort((a, b) => a.localeCompare(b)),
    [people],
  );
  const selectableCustomers = customers;
  const selectableCustomerIds = useMemo(() => new Set(selectableCustomers.map((customer) => customer.id)), [selectableCustomers]);
  const effectiveSelectedClientIds = useMemo(
    () => selectedClientIds.filter((clientId) => selectableCustomerIds.has(clientId)),
    [selectableCustomerIds, selectedClientIds],
  );

  const hunterScope = useMemo(() => buildHunterAccessScope({
    accessUser,
    people,
    customers,
    targetAllocations,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
  }), [accessUser, customers, people, specialistHunterStudioAssignments, studioTargetAllocations, targetAllocations]);
  const hunterConsultOnly = isHunterConsultAccess(accessUser);
  const canCreatePerson = canEdit && !hunterScope.enabled;
  const filtered = useMemo(() => people.filter((person) => {
    if (hunterScope.enabled && person.id !== hunterScope.person?.id) return false;
    const query = search.toLowerCase();
    return (!query || `${person.name} ${person.email ?? ""} ${person.jobTitle}`.toLowerCase().includes(query))
      && (!director || person.directorId === director || person.id === director)
      && (!roleType || person.roleType === roleType)
      && (!area || person.areaId === area)
      && (!status || person.lifecycleStatus === status);
  }), [area, director, hunterScope.enabled, hunterScope.person?.id, people, roleType, search, status]);
  const sortedPeople = useMemo(
    () => sortPeopleRows(filtered, sortState, people, areas),
    [areas, filtered, people, sortState],
  );
  const systemUserByEmail = useMemo(
    () => {
      if (!isAdmin) return new Map<string, AccessUser>();
      return new Map(systemUsers.map((user) => [normalizeAccessEmail(user.email), user]));
    },
    [isAdmin, systemUsers],
  );
  const canEditCompensation = canManageCompensation(accessUser, people);
  const canEditPerson = useCallback((person: Person) => {
    if (canEdit && !hunterScope.enabled) return true;
    return Boolean(hunterScope.enabled && hunterScope.person?.id === person.id);
  }, [canEdit, hunterScope.enabled, hunterScope.person?.id]);
  const editingCompensation = editing
    ? personCompensations.find((item) => item.personId === editing.id)
    : undefined;

  const closeForm = useCallback(() => {
    setDialogOpen(false);
    setEditing(null);
    setFormError("");
  }, []);

  useCloseOnNavigation(closeForm);

  useEffect(() => {
    if (!accessRepository || !isAdmin) {
      return;
    }

    let mounted = true;
    const loadSystemUsers = () => {
      accessRepository.listAccessUsers()
        .then((users: AccessUser[]) => {
          if (mounted) setSystemUsers(users);
        })
        .catch(() => {
          if (mounted) setSystemUsers([]);
        });
    };

    loadSystemUsers();
    window.addEventListener(accessUsersChangedEvent, loadSystemUsers);

    return () => {
      mounted = false;
      window.removeEventListener(accessUsersChangedEvent, loadSystemUsers);
    };
  }, [accessRepository, isAdmin]);

  function openForm(person?: Person) {
    if (!person && !canCreatePerson) return;
    if (person && !canEditPerson(person)) return;
    setEditing(person ?? null);
    setSelectedClientIds(person?.clientIds ?? []);
    setDraftRoleType(person?.roleType ?? "Delivery");
    setDraftLifecycleStatus(person?.lifecycleStatus ?? "active");
    setFormError("");
    setDialogOpen(true);
  }

  function updateDraftRoleType(nextRoleType: RoleType) {
    setDraftRoleType(nextRoleType);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hunterScope.enabled && (!editing || editing.id !== hunterScope.person?.id)) {
      setFormError("Seu perfil permite alterar apenas o próprio cadastro.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const selectedRole = hunterScope.enabled && editing
      ? editing.roleType
      : String(formData.get("roleType")) as RoleType;
    const lifecycleStatus = hunterScope.enabled && editing
      ? editing.lifecycleStatus
      : String(formData.get("lifecycleStatus") || "active") as LifecycleStatus;
    const closedAt = String(formData.get("closedAt") || "") || undefined;
    const closedReason = String(formData.get("closedReason") || "") || undefined;
    const nextPerson: Person = {
      id: editing?.id ?? makeId("person"),
      name: String(formData.get("name")),
      email: String(formData.get("email") || "") || undefined,
      jobTitle: String(formData.get("jobTitle")),
      directorId: String(formData.get("directorId") || "") || undefined,
      roleType: selectedRole,
      areaId: String(formData.get("areaId") || "") || undefined,
      clientIds: effectiveSelectedClientIds,
      photoUrl: String(formData.get("photoUrl") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
      active: getActiveFromLifecycle(lifecycleStatus),
      lifecycleStatus,
      closedAt: lifecycleStatus === "closed" ? closedAt : undefined,
      closedReason: lifecycleStatus === "closed" ? closedReason : undefined,
      isManager: isDeliveryManagerRole(selectedRole),
      hierarchyLevel: getHierarchyLevelForRole(selectedRole),
      importedDirectHeadcount: editing?.importedDirectHeadcount,
      importedDirectHeadcountAt: editing?.importedDirectHeadcountAt,
      importedDirectHeadcountSource: editing?.importedDirectHeadcountSource,
      importedDirectHeadcountBatchId: editing?.importedDirectHeadcountBatchId,
    };
    const person: Person = hunterScope.enabled && editing
      ? {
        ...editing,
        name: nextPerson.name,
        email: nextPerson.email,
        jobTitle: nextPerson.jobTitle,
        photoUrl: nextPerson.photoUrl,
        notes: nextPerson.notes,
      }
      : nextPerson;
    try {
      setFormError("");
      await savePerson(person);
      if (canEditCompensation) {
        const annualSalary = parseCurrencyInput(String(formData.get("annualSalary") ?? ""));
        const compensationNotes = String(formData.get("compensationNotes") || "") || undefined;
        if (annualSalary > 0) {
          await savePersonCompensation({
            personId: person.id,
            annualSalary,
            currency: "BRL",
            effectiveFrom: new Date().toISOString().slice(0, 10),
            notes: compensationNotes,
          });
        } else if (editingCompensation) {
          await deletePersonCompensation(person.id);
        }
      }
      closeForm();
      setSuccessMessage(`Pessoa ${person.name} salva com sucesso.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  async function closePerson(person: Person) {
    if (!canEdit || hunterScope.enabled) return;
    if (!window.confirm(`Registrar ${person.name} como desligado? O histórico será preservado e a pessoa deixará de aparecer como ativa.`)) return;
    const closedPerson: Person = {
      ...person,
      active: false,
      lifecycleStatus: "closed",
      closedAt: new Date().toISOString().slice(0, 10),
      closedReason: person.closedReason ?? "Desligamento registrado pela tela Pessoas.",
    };

    try {
      setFormError("");
      await savePerson(closedPerson);
      setSuccessMessage(`Pessoa ${person.name} marcada como desligada. O histórico foi preservado.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  async function reactivatePerson(person: Person) {
    if (!canEdit || hunterScope.enabled) return;
    if (!window.confirm(`Reativar ${person.name}?`)) return;
    const activePerson: Person = {
      ...person,
      active: true,
      lifecycleStatus: "active",
      closedAt: undefined,
      closedReason: undefined,
    };

    try {
      setFormError("");
      await savePerson(activePerson);
      setSuccessMessage(`Pessoa ${person.name} reativada com sucesso.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Gestão organizacional"
        title={hunterConsultOnly ? "Meu cadastro" : "Pessoas"}
        description={hunterConsultOnly ? "Consulte e mantenha seus dados básicos. Estrutura, perfil e clientes continuam sob governança da operação." : "Cadastre profissionais, responsabilidades, áreas e clientes atendidos."}
        actions={canCreatePerson ? <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nova pessoa</Button> : null}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={director} onChange={(event) => setDirector(event.target.value)}>
          <option value="">Todos os diretores</option>
          {directors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select value={roleType} onChange={(event) => setRoleType(event.target.value)}>
          <option value="">Todos os tipos</option>
          {roleTypes.map((item) => <option key={item} value={item}>{translateRole(item)}</option>)}
        </Select>
        <Select value={area} onChange={(event) => setArea(event.target.value)}>
          <option value="">Todas as áreas</option>
          {areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Desativados</option>
          <option value="closed">Encerrados / desligados</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Pessoa" sortKey="person" sortState={sortState} onSort={setSortState} />
                <SortableTableHead label="Cargo" sortKey="jobTitle" sortState={sortState} onSort={setSortState} />
                <SortableTableHead label="Tipo" sortKey="role" sortState={sortState} onSort={setSortState} />
                <SortableTableHead label="Diretor" sortKey="director" sortState={sortState} onSort={setSortState} />
                <SortableTableHead label="Área / Cobertura" sortKey="area" sortState={sortState} onSort={setSortState} />
                <TableHead className="text-right">HC direto</TableHead>
                <SortableTableHead label="Status" sortKey="status" sortState={sortState} onSort={setSortState} />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPeople.map((person) => {
                const systemUser = person.email ? systemUserByEmail.get(normalizeAccessEmail(person.email)) : undefined;
                const editable = canEditPerson(person);

                return (
                <TableRow
                  key={person.id}
                  className={editable ? "cursor-pointer" : ""}
                  title={editable ? "Dê duplo clique para editar a pessoa" : "Consulta em modo leitura"}
                  onDoubleClick={() => {
                    if (editable) openForm(person);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={person.name} />
                      <div>
                        <p className="font-semibold">{person.name}</p>
                        <p className="text-xs text-slate-400">{person.email ?? "Sem e-mail cadastrado"}</p>
                        {systemUser && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant={systemUser.active ? "success" : "secondary"} className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Usuário do sistema
                            </Badge>
                            <span className="text-[11px] font-medium text-slate-400">
                              {translateAccessRole(systemUser.role)} · {translateAccessStatus(systemUser.status)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{person.jobTitle}</TableCell>
                  <TableCell><Badge variant={getRoleBadgeVariant(person.roleType)}>{translateRole(person.roleType)}</Badge></TableCell>
                  <TableCell>{people.find((item) => item.id === person.directorId)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <p>{areas.find((item) => item.id === person.areaId)?.name ?? "—"}</p>
                    <p className="max-w-64 truncate text-xs text-slate-400">{person.clientIds.length} cliente(s)</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-bold tabular-nums">{person.importedDirectHeadcount ?? "—"}</p>
                    {person.importedDirectHeadcountAt && (
                      <p className="text-xs text-slate-400" title={person.importedDirectHeadcountSource}>
                        Atualizado em {formatDate(person.importedDirectHeadcountAt)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getLifecycleStatusBadgeVariant(person.lifecycleStatus)}>
                      {translateLifecycleStatus(person.lifecycleStatus)}
                    </Badge>
                    {person.closedAt && <p className="mt-1 text-xs text-slate-400">Desde {formatDate(person.closedAt)}</p>}
                  </TableCell>
                  <TableCell onDoubleClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {editable && <Button variant="ghost" size="icon" onClick={() => openForm(person)} aria-label={`Editar ${person.name}`}><Pencil className="h-4 w-4" /></Button>}
                      {canEdit && !hunterScope.enabled && person.active ? (
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => void closePerson(person)} aria-label={`Desligar ${person.name}`} title="Desligar sem excluir histórico"><Power className="h-4 w-4" /></Button>
                      ) : canEdit && !hunterScope.enabled ? (
                        <Button variant="ghost" size="icon" className="text-emerald-700" onClick={() => void reactivatePerson(person)} aria-label={`Reativar ${person.name}`} title="Reativar pessoa"><RotateCcw className="h-4 w-4" /></Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!sortedPeople.length && <EmptyState />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>{hunterScope.enabled ? "Atualize apenas seus dados básicos. Perfil, hierarquia e clientes são governados pela operação." : "Preencha os dados de estrutura e cobertura."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Nome"><Input name="name" defaultValue={editing?.name} maxLength={120} required /></Field>
            <Field label="E-mail"><Input name="email" type="email" defaultValue={editing?.email} maxLength={254} /></Field>
            <Field label="Cargo">
              <Input name="jobTitle" defaultValue={editing?.jobTitle} list="job-title-options" maxLength={120} required />
              <datalist id="job-title-options">
                {jobTitleOptions.map((jobTitle) => <option key={jobTitle} value={jobTitle} />)}
              </datalist>
            </Field>
            <Field label="Diretor">
              <Select name="directorId" defaultValue={editing?.directorId} disabled={hunterScope.enabled}>
                <option value="">Sem diretor</option>
                {directors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de atuação">
              <Select name="roleType" value={draftRoleType} onChange={(event) => updateDraftRoleType(event.target.value as RoleType)} disabled={hunterScope.enabled} required>
                {roleTypes.map((item) => <option key={item} value={item}>{translateRole(item)}</option>)}
              </Select>
            </Field>
            <Field label="Área">
              <Select name="areaId" defaultValue={editing?.areaId} disabled={hunterScope.enabled}>
                <option value="">Sem área</option>
                {areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="HC sob gestão direta">
              <Input value={editing?.importedDirectHeadcount ?? ""} readOnly placeholder="Ainda não conciliado" />
              <span className="mt-1 block text-xs text-slate-400">
                Atualizado pela importação de funcionários
                {editing?.importedDirectHeadcountSource ? ` · ${editing.importedDirectHeadcountSource}` : ""}.
              </span>
            </Field>
            <Field label="Clientes" className="md:col-span-2">
              {hunterScope.enabled ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {effectiveSelectedClientIds.length
                    ? effectiveSelectedClientIds.map((clientId) => customers.find((customer) => customer.id === clientId)?.name ?? clientId).join(", ")
                    : "Nenhum cliente associado diretamente."}
                </div>
              ) : (
                <DualListSelector
                  items={selectableCustomers.map((item) => ({
                    id: item.id,
                    label: item.name,
                    description: item.industry,
                  }))}
                  selectedIds={effectiveSelectedClientIds}
                  onChange={setSelectedClientIds}
                  availableTitle="Clientes disponíveis"
                  selectedTitle="Clientes selecionados"
                  availableSearchPlaceholder="Buscar cliente disponível"
                  selectedSearchPlaceholder="Buscar cliente selecionado"
                  emptyAvailableMessage="Todos os clientes já foram selecionados."
                  emptySelectedMessage="Nenhum cliente selecionado."
                />
              )}
              <span className="mt-1 block text-xs text-slate-400">
                {hunterScope.enabled ? "A associação de clientes não é editável neste perfil." : "Mova um ou mais clientes para a lista de selecionados antes de salvar."}
              </span>
            </Field>
            <Field label="URL da foto"><Input name="photoUrl" type="url" defaultValue={editing?.photoUrl} /></Field>
            <Field label="Status">
              <Select name="lifecycleStatus" value={draftLifecycleStatus} onChange={(event) => setDraftLifecycleStatus(event.target.value as LifecycleStatus)} disabled={hunterScope.enabled}>
                <option value="active">Ativo</option>
                <option value="inactive">Desativado</option>
                <option value="closed">Encerrado / desligado</option>
              </Select>
            </Field>
            {draftLifecycleStatus === "closed" && (
              <>
                <Field label="Data de desligamento">
                  <Input name="closedAt" type="date" defaultValue={editing?.closedAt ?? new Date().toISOString().slice(0, 10)} required />
                </Field>
                <Field label="Motivo do desligamento">
                  <Input name="closedReason" defaultValue={editing?.closedReason} maxLength={500} placeholder="Opcional" />
                </Field>
              </>
            )}
            {canEditCompensation && (
              <div className="grid gap-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-4 md:col-span-2 md:grid-cols-2">
                <Field label="Salário mensal">
                  <Input
                    name="annualSalary"
                    inputMode="decimal"
                    defaultValue={editingCompensation ? formatCurrencyInput(editingCompensation.annualSalary) : ""}
                    placeholder="Ex.: 40.000,00"
                  />
                  <span className="mt-1 block text-xs text-slate-500">Campo restrito a admin com cargo VP. A Análise de Desafio anualiza automaticamente por 12.</span>
                </Field>
                <Field label="Observação da remuneração">
                  <Input
                    name="compensationNotes"
                    defaultValue={editingCompensation?.notes}
                    maxLength={500}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            )}
            <Field label="Observações" className="md:col-span-2"><Textarea name="notes" defaultValue={editing?.notes} maxLength={2000} /></Field>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button type="submit"><UserRoundCheck className="h-4 w-4" /> Salvar pessoa</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function getFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar. Verifique permissões, dados e conexão.";
}

function sortPeopleRows(rows: Person[], sortState: SortState<PeopleSortKey>, people: Person[], areas: Array<{ id: string; name: string }>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "person") return compareText(first.name, second.name);
    if (sortState.key === "jobTitle") return compareText(first.jobTitle, second.jobTitle);
    if (sortState.key === "role") return compareText(translateRole(first.roleType), translateRole(second.roleType));
    if (sortState.key === "director") return compareText(getPersonDirectorName(first, people), getPersonDirectorName(second, people));
    if (sortState.key === "area") return compareText(getPersonAreaName(first, areas), getPersonAreaName(second, areas));
    return compareNumber(getLifecycleSortValue(first.lifecycleStatus), getLifecycleSortValue(second.lifecycleStatus));
  });
}

function getPersonDirectorName(person: Person, people: Person[]) {
  return people.find((item) => item.id === person.directorId)?.name ?? "";
}

function getPersonAreaName(person: Person, areas: Array<{ id: string; name: string }>) {
  return areas.find((item) => item.id === person.areaId)?.name ?? "";
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

function parseCurrencyInput(value: string) {
  const normalized = value
    .trim()
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyInput(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getLifecycleSortValue(status: LifecycleStatus) {
  if (status === "active") return 0;
  if (status === "inactive") return 1;
  return 2;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function translateAccessStatus(status: AccessUser["status"]) {
  const labels: Record<AccessUser["status"], string> = {
    active: "Ativo",
    approval_pending: "Aguardando aprovação",
    blocked: "Bloqueado",
    invited: "Pré-cadastrado",
    pending: "Pendente",
  };

  return labels[status] ?? status;
}
