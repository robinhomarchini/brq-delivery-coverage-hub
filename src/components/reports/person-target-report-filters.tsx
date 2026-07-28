"use client";

import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/shared/filter-bar";
import { translateRole } from "@/lib/roles";
import type { ReportView } from "@/lib/reports/person-target-official-export";
import type { RoleType } from "@/lib/roles";

export interface PersonTargetReportFiltersProps {
  view: ReportView;
  effectiveView: ReportView;
  hunterConsultOnly: boolean;
  year: string;
  years: number[];
  onYearChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  roleType: string;
  onRoleTypeChange: (value: string) => void;
  roleTypes: RoleType[];
  selectedDirectorId: string;
  onSelectedDirectorIdChange: (value: string) => void;
  directorOptions: Array<{ id: string; name: string }>;
  selectedHunterClientId: string;
  onSelectedHunterClientIdChange: (value: string) => void;
  hunterRows: Array<{ hunterId: string; hunterName: string }>;
  selectedPeopleClientPersonId: string;
  onSelectedPeopleClientPersonIdChange: (value: string) => void;
  peopleClientPersonOptions: Array<{ personId: string; personName: string; roleType: RoleType }>;
  includeNewLogos: boolean;
  onIncludeNewLogosChange: (value: boolean) => void;
  showClientCoverageValues: boolean;
  onShowClientCoverageValuesChange: (value: boolean) => void;
  onViewChange: (nextView: ReportView) => void;
  getViewDescription: (view: ReportView) => string;
}

export function PersonTargetReportFilters({
  view,
  effectiveView,
  hunterConsultOnly,
  year,
  years,
  onYearChange,
  search,
  onSearchChange,
  roleType,
  onRoleTypeChange,
  roleTypes,
  selectedDirectorId,
  onSelectedDirectorIdChange,
  directorOptions,
  selectedHunterClientId,
  onSelectedHunterClientIdChange,
  hunterRows,
  selectedPeopleClientPersonId,
  onSelectedPeopleClientPersonIdChange,
  peopleClientPersonOptions,
  includeNewLogos,
  onIncludeNewLogosChange,
  showClientCoverageValues,
  onShowClientCoverageValuesChange,
  onViewChange,
  getViewDescription,
}: PersonTargetReportFiltersProps) {
  return (
    <>
      {!hunterConsultOnly && (
        <Card className="mb-5 p-3 shadow-sm">
          <div className="space-y-3">
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="inline-flex min-w-max gap-2">
                {[
                  { key: "people", label: "Pessoas" },
                  { key: "peopleClients", label: "Pessoas x Clientes" },
                  { key: "clients", label: "Clientes" },
                  { key: "areas", label: "Áreas / Studios" },
                  { key: "hunters", label: "Hunters" },
                  { key: "hunterClients", label: "Hunter x Clientes" },
                  { key: "specialistHunters", label: "Hunters Especializados" },
                  { key: "directors", label: "Diretoria Delivery" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${
                      view === item.key
                        ? "bg-brq-purple text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    onClick={() => onViewChange(item.key as ReportView)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-500">{getViewDescription(effectiveView)}</p>
          </div>
        </Card>
      )}

      {effectiveView === "peopleClients" ? (
        <Card className="mb-5 p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_160px] lg:items-end">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Pessoa</span>
              <Select value={selectedPeopleClientPersonId} onChange={(event) => onSelectedPeopleClientPersonIdChange(event.target.value)}>
                <option value="">Escolha uma pessoa para montar a visão</option>
                {peopleClientPersonOptions.map((person) => (
                  <option key={person.personId} value={person.personId}>
                    {person.personName} · {translateRole(person.roleType)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Ano</span>
              <Select value={year} onChange={(event) => onYearChange(event.target.value)}>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </label>
          </div>
        </Card>
      ) : (
        <FilterBar search={search} onSearchChange={onSearchChange}>
          <Select value={year} onChange={(event) => onYearChange(event.target.value)}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          {effectiveView !== "areas" && effectiveView !== "specialistHunters" && effectiveView !== "clients" && !hunterConsultOnly && (
            effectiveView === "directors" ? (
              <Select value={selectedDirectorId} onChange={(event) => onSelectedDirectorIdChange(event.target.value)}>
                <option value="">Escolha a diretoria</option>
                {directorOptions.map((director) => <option key={director.id} value={director.id}>{director.name}</option>)}
              </Select>
            ) : effectiveView === "hunterClients" ? (
              <Select value={selectedHunterClientId} onChange={(event) => onSelectedHunterClientIdChange(event.target.value)}>
                <option value="">Escolha o Hunter</option>
                {[...hunterRows]
                  .sort((first, second) => first.hunterName.localeCompare(second.hunterName, "pt-BR"))
                  .map((hunter) => <option key={hunter.hunterId} value={hunter.hunterId}>{hunter.hunterName}</option>)}
              </Select>
            ) : (
               <Select value={roleType} onChange={(event) => onRoleTypeChange(event.target.value)}>
                <option value="">Todos os perfis</option>
                {roleTypes.map((item) => <option key={item} value={item}>{translateRole(item)}</option>)}
              </Select>
            )
          )}
        </FilterBar>
      )}

      <Card className="mb-5 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">New Logos</p>
            <p className="text-xs text-slate-500">
              New Logos ficam no controle e podem ajudar na realização do ano, mas não compõem a meta oficial planejada. Ative para incluí-los na consulta e nas exportações.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brq-purple focus:ring-brq-purple"
              checked={includeNewLogos}
              onChange={(event) => onIncludeNewLogosChange(event.target.checked)}
            />
            Incluir New Logos
          </label>
        </div>
      </Card>

      {effectiveView === "clients" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Clientes x Hunters x Delivery</p>
              <p className="text-xs text-slate-500">
                Visão por cliente com participantes derivados das metas diretas, governança Delivery, Studios e seleção de Hunter Especializado.
              </p>
            </div>
            <div className="flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-auto">
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-bold transition sm:flex-none ${
                  showClientCoverageValues ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
                onClick={() => onShowClientCoverageValuesChange(true)}
              >
                Com valores
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-bold transition sm:flex-none ${
                  !showClientCoverageValues ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
                onClick={() => onShowClientCoverageValuesChange(false)}
              >
                Sem valores
              </button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
