"use client";

import { Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Person, RoleType } from "@/data/mockData";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { PersonAvatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
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
import { makeId } from "@/lib/utils";
import { getHierarchyLevelForRole, getRoleBadgeVariant, isDeliveryManagerRole, isHunterRole, roleTypes, translateRole } from "@/lib/roles";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";

export function PeopleManagement() {
  const { people, customers, areas, savePerson, deletePerson } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [director, setDirector] = useState("");
  const [roleType, setRoleType] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [draftRoleType, setDraftRoleType] = useState<RoleType>("Delivery");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const directors = people.filter((person) => person.roleType === "Director" || person.roleType === "Executive");
  const jobTitleOptions = useMemo(
    () => Array.from(new Set([...people.map((person) => person.jobTitle).filter(Boolean), "Diretor Comercial"])).sort((a, b) => a.localeCompare(b)),
    [people],
  );
  const hunterAssignedClientIds = useMemo(() => new Set(people
    .filter((person) => person.id !== editing?.id && isHunterRole(person.roleType))
    .flatMap((person) => person.clientIds)),
  [editing?.id, people]);
  const selectableCustomers = useMemo(
    () => isHunterRole(draftRoleType)
      ? customers.filter((customer) => !hunterAssignedClientIds.has(customer.id))
      : customers,
    [customers, draftRoleType, hunterAssignedClientIds],
  );
  const selectableCustomerIds = useMemo(() => new Set(selectableCustomers.map((customer) => customer.id)), [selectableCustomers]);
  const effectiveSelectedClientIds = useMemo(
    () => selectedClientIds.filter((clientId) => selectableCustomerIds.has(clientId)),
    [selectableCustomerIds, selectedClientIds],
  );

  const filtered = useMemo(() => people.filter((person) => {
    const query = search.toLowerCase();
    return (!query || `${person.name} ${person.email ?? ""} ${person.jobTitle}`.toLowerCase().includes(query))
      && (!director || person.directorId === director || person.id === director)
      && (!roleType || person.roleType === roleType)
      && (!area || person.areaId === area)
      && (!status || String(person.active) === status);
  }), [area, director, people, roleType, search, status]);

  const closeForm = useCallback(() => {
    setDialogOpen(false);
    setEditing(null);
    setFormError("");
  }, []);

  useCloseOnNavigation(closeForm);

  function openForm(person?: Person) {
    setEditing(person ?? null);
    setSelectedClientIds(person?.clientIds ?? []);
    setDraftRoleType(person?.roleType ?? "Delivery");
    setFormError("");
    setDialogOpen(true);
  }

  function updateDraftRoleType(nextRoleType: RoleType) {
    setDraftRoleType(nextRoleType);
    if (isHunterRole(nextRoleType)) {
      setSelectedClientIds((current) => current.filter((clientId) => !hunterAssignedClientIds.has(clientId)));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedRole = String(formData.get("roleType")) as RoleType;
    const person: Person = {
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
      active: formData.get("active") === "true",
      isManager: isDeliveryManagerRole(selectedRole),
      hierarchyLevel: getHierarchyLevelForRole(selectedRole),
    };
    try {
      setFormError("");
      await savePerson(person);
      closeForm();
      setSuccessMessage(`Pessoa ${person.name} salva com sucesso.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Gestão organizacional"
        title="Pessoas"
        description="Cadastre profissionais, responsabilidades, áreas e clientes atendidos."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nova pessoa</Button>}
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
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Diretor</TableHead>
                <TableHead>Área / Cobertura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((person) => (
                <TableRow
                  key={person.id}
                  className="cursor-pointer"
                  title="Dê duplo clique para editar a pessoa"
                  onDoubleClick={() => openForm(person)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={person.name} />
                      <div><p className="font-semibold">{person.name}</p><p className="text-xs text-slate-400">{person.email ?? "Sem e-mail cadastrado"}</p></div>
                    </div>
                  </TableCell>
                  <TableCell>{person.jobTitle}</TableCell>
                  <TableCell><Badge variant={getRoleBadgeVariant(person.roleType)}>{translateRole(person.roleType)}</Badge></TableCell>
                  <TableCell>{people.find((item) => item.id === person.directorId)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <p>{areas.find((item) => item.id === person.areaId)?.name ?? "—"}</p>
                    <p className="max-w-64 truncate text-xs text-slate-400">{person.clientIds.length} cliente(s)</p>
                  </TableCell>
                  <TableCell><Badge variant={person.active ? "success" : "secondary"}>{person.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell onDoubleClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm(person)} aria-label={`Editar ${person.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => {
                        if (window.confirm(`Excluir ${person.name}?`)) void deletePerson(person.id).catch(() => undefined);
                      }} aria-label={`Excluir ${person.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!filtered.length && <EmptyState />}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>Preencha os dados de estrutura e cobertura.</DialogDescription>
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
              <Select name="directorId" defaultValue={editing?.directorId}>
                <option value="">Sem diretor</option>
                {directors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de atuação">
              <Select name="roleType" value={draftRoleType} onChange={(event) => updateDraftRoleType(event.target.value as RoleType)} required>
                {roleTypes.map((item) => <option key={item} value={item}>{translateRole(item)}</option>)}
              </Select>
            </Field>
            <Field label="Área">
              <Select name="areaId" defaultValue={editing?.areaId}>
                <option value="">Sem área</option>
                {areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Clientes" className="md:col-span-2">
              <DualListSelector
                items={selectableCustomers.map((item) => ({
                  id: item.id,
                  label: item.name,
                  description: item.industry,
                }))}
                selectedIds={effectiveSelectedClientIds}
                onChange={(ids) => setSelectedClientIds(isHunterRole(draftRoleType) ? ids.filter((id) => !hunterAssignedClientIds.has(id)) : ids)}
                availableTitle="Clientes disponíveis"
                selectedTitle="Clientes selecionados"
                availableSearchPlaceholder="Buscar cliente disponível"
                selectedSearchPlaceholder="Buscar cliente selecionado"
                emptyAvailableMessage={isHunterRole(draftRoleType) ? "Todos os clientes disponíveis para Hunter já foram selecionados." : "Todos os clientes já foram selecionados."}
                emptySelectedMessage="Nenhum cliente selecionado."
              />
              <span className="mt-1 block text-xs text-slate-400">
                {isHunterRole(draftRoleType)
                  ? "Para Hunter, aparecem apenas clientes que ainda não estão associados a outro Hunter."
                  : "Mova um ou mais clientes para a lista de selecionados antes de salvar."}
              </span>
            </Field>
            <Field label="URL da foto"><Input name="photoUrl" type="url" defaultValue={editing?.photoUrl} /></Field>
            <Field label="Status">
              <Select name="active" defaultValue={String(editing?.active ?? true)}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </Field>
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
