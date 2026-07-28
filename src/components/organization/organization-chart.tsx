"use client";

import { ChevronDown, ChevronUp, ImageDown, Info, LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PersonCard } from "./person-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeliveryStore } from "@/store/delivery-store";
import { exportElementAsPng } from "@/lib/export";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";
import { isDirectorRole, isExecutiveRole, isStaffRole } from "@/lib/roles";

export function OrganizationChart() {
  const { people, customers, areas } = useDeliveryStore();
  const executive = people.find((person) => isExecutiveRole(person.roleType));
  const directors = people.filter((person) => isDirectorRole(person.roleType) && person.active);
  const executiveDirectReports = executive
    ? people.filter((person) => isDirectReportTo(person, executive.id) && !isDirectorRole(person.roleType) && person.active)
    : [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ ane: true, ca: true });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const closePreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }, []);

  useCloseOnNavigation(closePreview);

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const generatedUrl = await exportElementAsPng("organization-chart", "organograma-brq-delivery.png");
      setPreviewUrl(generatedUrl);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Não foi possível gerar o organograma.");
    } finally {
      setExporting(false);
    }
  }

  const renderCard = (
    person: NonNullable<typeof executive>,
    variant: "executive" | "director" | "manager" | "staff",
  ) => {
    const displayClientIds = getDisplayClientIds(person);
    return (
      <PersonCard
        key={person.id}
        person={person}
        variant={variant}
        areaName={areas.find((area) => area.id === person.areaId)?.name}
        clientNames={customers.filter((customer) => displayClientIds.includes(customer.id)).map((customer) => customer.name)}
      />
    );
  };

  function getDisplayClientIds(person: NonNullable<typeof executive>) {
    if (isExecutiveRole(person.roleType)) {
      return unique(people.filter((item) => item.id !== person.id && item.active).flatMap((item) => item.clientIds));
    }

    if (isDirectorRole(person.roleType)) {
      return unique(people
        .filter((item) => isDirectReportTo(item, person.id))
        .flatMap((item) => item.clientIds));
    }

    return person.clientIds;
  }

  return (
    <>
      <PageHeader
        eyebrow="Estrutura organizacional"
        title="Organograma"
        description="Hierarquia interativa da liderança de Delivery. O papel de Staff é apresentado por uma conexão pontilhada."
        actions={
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            {exporting ? "Gerando PNG..." : "Exportar organograma PNG"}
          </Button>
        }
      />

      {exportError && (
        <Card className="mb-4 border-red-200 bg-red-50 shadow-none">
          <CardContent className="p-4 text-sm text-red-700">{exportError}</CardContent>
        </Card>
      )}

      <Card className="mb-4 border-purple-100 bg-purple-50/70 shadow-none">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-purple-900">
          <Info className="h-5 w-5 shrink-0" />
          Clique no controle abaixo de cada diretor para expandir ou recolher sua estrutura.
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <div id="organization-chart" className="bg-[#fafafa] p-8">
          <div className="grid grid-cols-[minmax(220px,260px)_72px_1fr] items-stretch gap-0">
            <div className="flex items-center justify-center">
              {executive && renderCard(executive, "executive")}
            </div>

            <div className="relative">
              <div className="absolute left-0 top-1/2 w-9 border-t-2 border-purple-300" />
              <div className="absolute bottom-[72px] left-9 top-[72px] border-l-2 border-purple-300" />
            </div>

            <div className="space-y-5">
              {directors.map((director) => {
                const directReports = people.filter((person) => isDirectReportTo(person, director.id) && !isDirectorRole(person.roleType) && person.active);
                const isExpanded = expanded[director.id] ?? true;
                return (
                  <section key={director.id} className="relative grid grid-cols-[28px_minmax(200px,260px)_52px_1fr] items-center">
                    <div className="border-t-2 border-purple-300" />
                    <div>
                      {renderCard(director, "director")}
                      <button
                        className="mx-auto mt-2 flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-brq-purple shadow-sm"
                        onClick={() => setExpanded((current) => ({ ...current, [director.id]: !isExpanded }))}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Recolher equipe de ${director.name}` : `Expandir equipe de ${director.name}`}
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {directReports.length} pessoa(s)
                      </button>
                    </div>
                    <div className={isExpanded ? "border-t-2 border-purple-200" : ""} />
                    {isExpanded ? (
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 rounded-xl border border-purple-100 bg-white/80 p-3">
                        {directReports.map((person) => renderCard(person, "manager"))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-400">
                        Equipe recolhida
                      </div>
                    )}
                  </section>
                );
              })}

              {executiveDirectReports.map((person) => (
                <section key={person.id} className="relative grid grid-cols-[28px_minmax(200px,260px)_52px_1fr] items-center">
                  <div className="border-t-2 border-dashed border-orange-400" />
                  <div>
                    <div className="mb-2 w-fit rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold tracking-wider text-orange-700">
                       {isStaffRole(person.roleType) ? "STAFF" : "REPORT DIRETO"}
                    </div>
                    {renderCard(person, "staff")}
                  </div>
                  <div className="border-t-2 border-dashed border-orange-300" />
                  <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-4 text-sm text-orange-800">
                    Pessoa ligada diretamente à Direção Executiva.
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>

      {previewUrl && <Dialog
        open={Boolean(previewUrl)}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent className="max-w-[92vw]">
          <DialogHeader>
            <DialogTitle>Organograma gerado</DialogTitle>
            <DialogDescription>
              O download foi solicitado. Se o navegador bloquear, abra a imagem e use Ctrl+S.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">Abrir imagem</a>
            </Button>
            <Button asChild>
              <a href={previewUrl} download="organograma-brq-delivery.png">Baixar PNG</a>
            </Button>
          </div>
          <div className="max-h-[65vh] overflow-auto rounded-xl border bg-slate-100 p-3">
            {/* A generated local Blob URL is intentionally used for the export preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Prévia do organograma BRQ Delivery" className="max-w-none bg-white shadow-sm" />
          </div>
        </DialogContent>
      </Dialog>}
    </>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function isDirectReportTo(person: { directorId?: string; managerId?: string; id: string }, leaderId: string) {
  return person.id !== leaderId && (person.directorId === leaderId || person.managerId === leaderId);
}
