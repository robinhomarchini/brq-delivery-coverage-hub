"use client";

import { Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Area } from "@/data/mockData";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDeliveryStore } from "@/store/delivery-store";
import { makeId } from "@/lib/utils";

export function AreaStudioManagement() {
  const { areas, people, saveArea, deleteArea } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Area | null>(null);
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const peopleCountByArea = useMemo(() => {
    const counts = new Map<string, number>();
    people.forEach((person) => {
      if (!person.areaId) return;
      counts.set(person.areaId, (counts.get(person.areaId) ?? 0) + 1);
    });
    return counts;
  }, [people]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return areas
      .filter((area) => !query || `${area.name} ${area.description}`.toLowerCase().includes(query))
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [areas, search]);

  function openForm(area?: Area) {
    setEditing(area ?? null);
    setError("");
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");

    try {
      setError("");
      await saveArea({
        id: editing?.id ?? makeId("area"),
        name,
        description: String(formData.get("description") ?? ""),
      });
      setOpen(false);
      setSuccess(`Área/Studio ${name} salvo com sucesso.`);
      window.setTimeout(() => setSuccess(""), 4000);
    } catch (error) {
      setError(getMessage(error));
    }
  }

  async function handleDelete(area: Area) {
    const count = peopleCountByArea.get(area.id) ?? 0;
    const message = count
      ? `Excluir ${area.name}? ${count} pessoa(s) ficarão sem área/studio definido.`
      : `Excluir ${area.name}?`;
    if (!window.confirm(message)) return;

    try {
      await deleteArea(area.id);
      setSuccess(`Área/Studio ${area.name} excluído.`);
      window.setTimeout(() => setSuccess(""), 4000);
    } catch (error) {
      setError(getMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Estrutura de Delivery"
        title="Áreas / Studios"
        description="Cadastre Studios e áreas de atuação usados em Pessoas, Organograma, Metas e análises de cobertura."
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nova área/studio</Button>}
      />

      {success && <SuccessNotice message={success} floating />}
      {error && <ErrorNotice message={error} floating onClose={() => setError("")} />}

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <Summary label="Áreas/Studios" value={String(areas.length)} />
        <Summary label="Pessoas associadas" value={String(people.filter((person) => person.areaId).length)} />
        <Summary label="Sem área definida" value={String(people.filter((person) => !person.areaId).length)} />
      </section>

      <FilterBar search={search} onSearchChange={setSearch} />

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Área / Studio</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Pessoas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((area) => (
                <TableRow
                  key={area.id}
                  className="cursor-pointer"
                  title="Dê duplo clique para editar"
                  onDoubleClick={() => openForm(area)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-brq-purple">
                        <Layers3 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">{area.name}</p>
                        <p className="text-xs text-slate-400">{area.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xl text-sm text-slate-600">{area.description || "—"}</TableCell>
                  <TableCell>{peopleCountByArea.get(area.id) ?? 0}</TableCell>
                  <TableCell onDoubleClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm(area)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => void handleDelete(area)}><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar área/studio" : "Nova área/studio"}</DialogTitle>
            <DialogDescription>
              Áreas/Studios classificam pessoas e ajudam a distribuir metas de Renovação + Ampliação sem virar manager responsável do cliente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Field label="Nome">
              <Input name="name" defaultValue={editing?.name} maxLength={120} required />
            </Field>
            <Field label="Descrição">
              <Textarea name="description" defaultValue={editing?.description} maxLength={500} rows={4} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar área/studio</Button>
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
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function getMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Não foi possível concluir a operação.";
}
