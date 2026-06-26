"use client";

import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Subject, SubjectStatus } from "@/data/mockData";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { makeId } from "@/lib/utils";

const statuses: SubjectStatus[] = ["Ativo", "Em evolução", "Atenção", "Planejado"];

export function SubjectManagement() {
  const { subjects, customers, people, saveSubject, deleteSubject } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [open, setOpen] = useState(false);
  const owners = people.filter((person) => person.isManager || person.roleType === "Director");

  const filtered = useMemo(() => subjects.filter((subject) =>
    (!search || `${subject.name} ${subject.description}`.toLowerCase().includes(search.toLowerCase()))
    && (!customer || subject.customerId === customer)
    && (!owner || subject.ownerPersonId === owner)
    && (!status || subject.status === status)
  ), [customer, owner, search, status, subjects]);

  function openForm(item?: Subject) {
    setEditing(item ?? null);
    setOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    try {
      await saveSubject({
      id: editing?.id ?? makeId("subject"),
      customerId: String(formData.get("customerId")),
      name: String(formData.get("name")),
      description: String(formData.get("description") || ""),
      ownerPersonId: String(formData.get("ownerPersonId") || "") || undefined,
      status: String(formData.get("status")) as SubjectStatus,
      strategic: formData.get("strategic") === "true",
      });
      setOpen(false);
    } catch {
      // The store exposes a user-facing persistence error.
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cobertura por cliente"
        title="Assuntos"
        description="Gerencie as frentes atendidas dentro de cada cliente, como Dados, Conta Corrente e Investimentos."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Novo assunto</Button>}
      />
      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Todos os clientes</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Todos os owners</option>{owners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Assunto</TableHead><TableHead>Cliente</TableHead><TableHead>Owner</TableHead>
              <TableHead>Status</TableHead><TableHead>Estratégico</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-brq-purple"><Tags className="h-4 w-4" /></div><div><p className="font-semibold">{subject.name}</p><p className="max-w-96 truncate text-xs text-slate-400">{subject.description}</p></div></div></TableCell>
                  <TableCell>{customers.find((item) => item.id === subject.customerId)?.name ?? "—"}</TableCell>
                  <TableCell>{people.find((item) => item.id === subject.ownerPersonId)?.name ?? "Sem owner"}</TableCell>
                  <TableCell><StatusBadge status={subject.status} /></TableCell>
                  <TableCell><Badge variant={subject.strategic ? "default" : "secondary"}>{subject.strategic ? "Sim" : "Não"}</Badge></TableCell>
                  <TableCell><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openForm(subject)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => {
                      if (window.confirm(`Excluir o assunto ${subject.name}?`)) void deleteSubject(subject.id).catch(() => undefined);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!filtered.length && <EmptyState />}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar assunto" : "Novo assunto"}</DialogTitle><DialogDescription>Defina a frente de atuação e seu ownership.</DialogDescription></DialogHeader>
          <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do assunto"><Input name="name" defaultValue={editing?.name} maxLength={160} required /></Field>
            <Field label="Cliente"><Select name="customerId" defaultValue={editing?.customerId} required><option value="">Selecione</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Owner"><Select name="ownerPersonId" defaultValue={editing?.ownerPersonId}><option value="">Sem owner</option>{owners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Status"><Select name="status" defaultValue={editing?.status ?? "Ativo"}>{statuses.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Estratégico"><Select name="strategic" defaultValue={String(editing?.strategic ?? false)}><option value="true">Sim</option><option value="false">Não</option></Select></Field>
            <Field label="Descrição" className="md:col-span-2"><Textarea name="description" defaultValue={editing?.description} maxLength={2000} /></Field>
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar assunto</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: SubjectStatus }) {
  const variant = status === "Ativo" ? "success" : status === "Em evolução" ? "default" : status === "Atenção" ? "warning" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
