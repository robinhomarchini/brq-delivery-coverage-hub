"use client";

import { ArrowRight, Building2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDeliveryStore } from "@/store/delivery-store";
import { translateRole } from "@/lib/roles";

export function CoverageMap() {
  const { people, customers } = useDeliveryStore();
  const [director, setDirector] = useState("");
  const [manager, setManager] = useState("");
  const [roleType, setRoleType] = useState("");
  const [customer, setCustomer] = useState("");
  const directors = useMemo(() => people.filter((person) => person.roleType === "Director"), [people]);
  const managers = useMemo(() => people.filter((person) => person.isManager), [people]);
  const managerRoleTypes = useMemo(() => Array.from(new Set(managers.map((person) => person.roleType))), [managers]);

  const coverage = useMemo(() => directors
    .filter((item) => !director || item.id === director)
    .map((directorItem) => ({
      director: directorItem,
      managers: managers
        .filter((managerItem) => managerItem.directorId === directorItem.id)
        .filter((managerItem) => !manager || managerItem.id === manager)
        .filter((managerItem) => !roleType || managerItem.roleType === roleType)
        .map((managerItem) => ({
          manager: managerItem,
          customers: customers
            .filter((customerItem) => managerItem.clientIds.includes(customerItem.id))
            .filter((customerItem) => !customer || customerItem.id === customer)
            .map((customerItem) => ({ customer: customerItem })),
        }))
        .filter((item) => !customer || item.customers.length > 0),
    }))
    .filter((item) => item.managers.length > 0), [customer, customers, director, directors, manager, managers, roleType]);

  return (
    <>
      <PageHeader
        eyebrow="Visão ponta a ponta"
        title="Mapa de Cobertura"
        description="Navegue por Diretor → Manager → Cliente e identifique lacunas de ownership."
      />

      <div className="mb-6 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <Select value={director} onChange={(event) => setDirector(event.target.value)}><option value="">Todos os diretores</option>{directors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={manager} onChange={(event) => setManager(event.target.value)}><option value="">Todos os managers</option>{managers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={roleType} onChange={(event) => setRoleType(event.target.value)}><option value="">Todos os tipos</option>{managerRoleTypes.map((item) => <option key={item} value={item}>{translateRole(item)}</option>)}</Select>
        <Select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Todos os clientes</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      </div>

      <div className="space-y-6">
        {coverage.map(({ director: directorItem, managers: managerItems }) => (
          <Card key={directorItem.id} className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-brq-navy text-white">
              <CardTitle className="flex items-center gap-3">
                <PersonAvatar name={directorItem.name} />
                <span>{directorItem.name}</span>
                <Badge className="ml-auto bg-white/15 text-white">{managerItems.length} managers</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {managerItems.map(({ manager: managerItem, customers: customerItems }) => (
                <div key={managerItem.id} className="grid gap-4 rounded-2xl border bg-slate-50/70 p-4 xl:grid-cols-[220px_28px_1fr] xl:items-start">
                  <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                    <PersonAvatar name={managerItem.name} />
                    <div><p className="font-bold">{managerItem.name}</p><p className="text-xs text-slate-500">{translateRole(managerItem.roleType)}</p></div>
                  </div>
                  <ArrowRight className="mt-5 hidden h-5 w-5 text-purple-300 xl:block" />
                  <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {customerItems.map(({ customer: customerItem }) => (
                      <div key={customerItem.id} className="rounded-xl border bg-white p-4">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div><p className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-brq-purple" />{customerItem.name}</p><p className="mt-1 text-xs text-slate-400">{customerItem.industry}</p></div>
                          {customerItem.strategicAccount && <Badge>Estratégica</Badge>}
                        </div>
                      </div>
                    ))}
                    {!customerItems.length && <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">Sem clientes no filtro atual</div>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {!coverage.length && (
          <Card className="p-12 text-center shadow-sm">
            <UsersRound className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-600">Nenhuma cobertura encontrada</p>
            <p className="mt-1 text-sm text-slate-400">Ajuste os filtros para ampliar a visualização.</p>
          </Card>
        )}
      </div>
    </>
  );
}
