"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeliveryStore } from "@/store/delivery-store";
import { exportElementAsPng } from "@/lib/export";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";
import { ChevronDown, ChevronUp, ImageDown, Info, LoaderCircle } from "lucide-react";
import { useOrganizationTree } from "@/components/organization/hooks/use-organization-tree";
import { ExecutiveCard } from "@/components/organization/organization-card-executive";
import { DirectorCard } from "@/components/organization/organization-card-director";
import { ManagerCard } from "@/components/organization/organization-card-manager";

export function OrganizationChartV2() {
  const { people, areas } = useDeliveryStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ ane: true, ca: true });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const { tree, toggle } = useOrganizationTree({
    people,
    expanded,
    onToggle: (id) => setExpanded((current) => ({ ...current, [id]: !current[id] })),
  });

  useCloseOnNavigation(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  });

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const generatedUrl = await exportElementAsPng("organization-chart-v2", "organograma-brq-delivery.png");
      setPreviewUrl(generatedUrl);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Não foi possível gerar o organograma.");
    } finally {
      setExporting(false);
    }
  }

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    people.forEach((person) => {
      const directReports = people.filter((p) => p.id !== person.id && (p.directorId === person.id || p.managerId === person.id));
      if (directReports.length > 0) {
        allExpanded[person.id] = true;
      }
    });
    setExpanded(allExpanded);
  };

  const handleCollapseAll = () => setExpanded({});

  const executiveNode = tree.rootNodes.find((node) => node.person.roleType === "Executive");
  const directorNodes = tree.rootNodes.filter((node) => node.person.roleType === "Director");
  const staffNodes = tree.rootNodes.filter((node) => node.person.roleType === "Staff");

  const getClientCount = (person: typeof people[0]) => {
    if (person.roleType === "Executive") {
      return new Set(people.filter((item) => item.id !== person.id && item.active).flatMap((item) => item.clientIds)).size;
    }
    if (person.roleType === "Director") {
      return new Set(people.filter((item) => isDirectReportTo(item, person.id)).flatMap((item) => item.clientIds)).size;
    }
    return person.clientIds.length;
  };

  return (
    <>
      <PageHeader
        eyebrow="Estrutura organizacional"
        title="Organograma"
        description="Hierarquia interativa da liderança de Delivery. Visualização executiva com busca e controles de expansão."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleExpandAll}>
              Expandir tudo
            </Button>
            <Button size="sm" variant="outline" onClick={handleCollapseAll}>
              Recolher tudo
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
              {exporting ? "Gerando PNG..." : "Exportar PNG"}
            </Button>
          </div>
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

      <Card className="overflow-hidden bg-white">
        <div className="p-6">
          {executiveNode && (
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <ExecutiveCard
                  person={executiveNode.person}
                  areaName={areas.find((area) => area.id === executiveNode.person.areaId)?.name}
                  clientCount={getClientCount(executiveNode.person)}
                  teamCount={people.filter((p) => activePerson(p) && isDirectReportTo(p, executiveNode.person.id)).length}
                />
                <div className="h-8 w-px bg-purple-300" />
              </div>

              <div className="flex w-full flex-col gap-6">
                {directorNodes.map((director) => {
                  const isExpanded = expanded[director.id] ?? true;
                  const directReports = people.filter((person) => activePerson(person) && isDirectReportTo(person, director.id) && person.roleType !== "Director");
                  return (
                    <div key={director.id} className="flex flex-col items-center gap-2">
                      <DirectorCard
                        person={director.person}
                        areaName={areas.find((area) => area.id === director.person.areaId)?.name}
                        teamCount={directReports.length}
                      />
                      <button
                        className="flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-brq-purple shadow-sm"
                        onClick={() => toggle(director.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {directReports.length} pessoa(s)
                      </button>

                      {isExpanded && (
                        <>
                          <div className="h-6 w-px bg-purple-200" />
                          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {directReports.map((person) => (
                              <ManagerCard
                                key={person.id}
                                person={person}
                                areaName={areas.find((area) => area.id === person.areaId)?.name}
                                clientCount={getClientCount(person)}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {!isExpanded && (
                        <div className="rounded-xl border border-dashed bg-white p-4 text-center text-sm text-slate-400">
                          Equipe recolhida
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {staffNodes.map((person) => (
                <div key={person.id} className="flex flex-col items-center gap-2">
                  <div className="w-fit rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold tracking-wider text-orange-700">
                    {person.person.roleType === "Staff" ? "STAFF" : "REPORT DIRETO"}
                  </div>
                  <ManagerCard
                    person={person.person}
                    areaName={areas.find((area) => area.id === person.person.areaId)?.name}
                    clientCount={getClientCount(person.person)}
                  />
                  <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-4 text-sm text-orange-800">
                    Pessoa ligada diretamente à Direção Executiva.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {previewUrl && (
        <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => { if (!open) { URL.revokeObjectURL(previewUrl); setPreviewUrl(""); } }}>
          <DialogContent className="max-w-[92vw]">
            <DialogHeader>
              <DialogTitle>Organograma gerado</DialogTitle>
              <DialogDescription>O download foi solicitado. Se o navegador bloquear, abra a imagem e use Ctrl+S.</DialogDescription>
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
        </Dialog>
      )}
    </>
  );
}

function activePerson(person: { active?: boolean }) {
  return person.active !== false;
}

function isDirectReportTo(person: { directorId?: string; managerId?: string; id: string }, leaderId: string) {
  return person.id !== leaderId && (person.directorId === leaderId || person.managerId === leaderId);
}
