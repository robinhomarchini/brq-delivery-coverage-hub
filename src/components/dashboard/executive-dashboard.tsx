"use client";

import {
  BriefcaseBusiness,
  Building2,
  Download,
  FileDown,
  Target,
  TrendingUp,
  UserCog,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeliveryStore } from "@/store/delivery-store";
import { exportDeliveryDataAsCsv, exportElementAsPdf } from "@/lib/export";
import { formatCurrency } from "@/lib/utils";
import { portfolioDeliveryManagers, portfolioDirectors, revenuePlans } from "@/data/customerPortfolioData";
import { translateRole } from "@/lib/roles";

const COLORS = ["#15171B", "#7F2EC9", "#EE7C38", "#2563EB", "#F97316", "#A3A3A3"];

export function ExecutiveDashboard() {
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const { people, customers } = useDeliveryStore();
  const activePeople = people.filter((person) => person.active);
  const directors = activePeople.filter((person) => person.roleType === "Director" || person.roleType === "Executive");
  const managers = activePeople.filter((person) => person.isManager);
  const farmerDeliveryManagers = managers.filter((person) => person.roleType === "Farmer + Delivery");
  const deliveryManagers = managers.filter((person) => person.roleType === "Delivery");
  const hunters = activePeople.filter((person) => person.roleType === "Hunter");
  const farmers = activePeople.filter((person) => person.roleType === "Farmer");
  const hunterFarmers = activePeople.filter((person) => person.roleType === "Hunter + Farmer");
  const staff = activePeople.filter((person) => person.roleType === "Staff");
  const totalRevenue = customers.reduce((total, customer) => total + customer.revenue, 0);
  const financialTotals = revenuePlans.reduce((totals, plan) => ({
    revenueCurrent: totals.revenueCurrent + plan.revenueCurrent,
    revenueTarget: totals.revenueTarget + plan.revenueTarget,
    hunterRevenue: totals.hunterRevenue + plan.hunterRevenue,
    deliveryFarmerRevenue: totals.deliveryFarmerRevenue + plan.deliveryFarmerRevenue,
  }), { revenueCurrent: 0, revenueTarget: 0, hunterRevenue: 0, deliveryFarmerRevenue: 0 });
  const financialByCustomer = [...revenuePlans]
    .sort((a, b) => b.revenueTarget - a.revenueTarget)
    .slice(0, 10);
  const financialByDirector = portfolioDirectors.map((director) => {
    const plans = revenuePlans.filter((plan) => plan.directorId === director.id);
    return {
      name: director.name,
      revenueTarget: plans.reduce((total, plan) => total + plan.revenueTarget, 0),
      hunterRevenue: plans.reduce((total, plan) => total + plan.hunterRevenue, 0),
      deliveryFarmerRevenue: plans.reduce((total, plan) => total + plan.deliveryFarmerRevenue, 0),
    };
  });
  const financialByManager = portfolioDeliveryManagers
    .map((manager) => {
      const plans = revenuePlans.filter((plan) => plan.managerIds.includes(manager.id));
      return {
        name: manager.name,
        revenueTarget: plans.reduce((total, plan) => total + plan.revenueTarget, 0),
        hunterRevenue: plans.reduce((total, plan) => total + plan.hunterRevenue, 0),
        deliveryFarmerRevenue: plans.reduce((total, plan) => total + plan.deliveryFarmerRevenue, 0),
      };
    })
    .filter((item) => item.revenueTarget > 0)
    .sort((a, b) => b.revenueTarget - a.revenueTarget);

  const distributionByDirector = people
    .filter((person) => person.roleType === "Director")
    .map((director) => ({
      name: director.name,
      managers: managers.filter((manager) => manager.directorId === director.id).length,
      clientes: customers.filter((customer) => customer.directorResponsibleId === director.id).length,
    }));

  const roleDistribution = [
    { name: translateRole("Delivery"), value: deliveryManagers.length },
    { name: translateRole("Farmer + Delivery"), value: farmerDeliveryManagers.length },
    { name: translateRole("Hunter"), value: hunters.length },
    { name: translateRole("Farmer"), value: farmers.length },
    { name: translateRole("Hunter + Farmer"), value: hunterFarmers.length },
    { name: translateRole("Staff"), value: staff.length },
  ].filter((item) => item.value > 0);

  const clientsByManager = managers
    .map((manager) => ({
      name: manager.name.split(" ")[0],
      clientes: customers.filter((customer) => customer.managerResponsibleIds.includes(manager.id)).length,
    }))
    .sort((a, b) => b.clientes - a.clientes)
    .slice(0, 10);

  const kpis = [
    { label: "Diretores", value: directors.length, icon: UserCog },
    { label: "Managers", value: managers.length, icon: UsersRound },
    { label: "Delivery", value: deliveryManagers.length, icon: UserCog },
    { label: "Farmer + Delivery", value: farmerDeliveryManagers.length, icon: BriefcaseBusiness, farmer: true },
    { label: "Hunters", value: hunters.length, icon: Target },
    { label: "Farmers", value: farmers.length, icon: BriefcaseBusiness },
    { label: "Hunter + Farmer", value: hunterFarmers.length, icon: TrendingUp },
    { label: "Clientes", value: customers.length, icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brq-purple">Visão executiva</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-brq-ink lg:text-4xl">Cobertura que importa</h1>
          <p className="mt-2 text-sm text-slate-500">Estrutura, clientes e metas para decisões mais rápidas.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2" data-no-print="true">
          <div className="mr-1 rounded-lg border bg-white px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Receita do portfólio</p>
            <p className="text-lg font-bold text-brq-purple">{formatCurrency(totalRevenue)}</p>
          </div>
            <Button variant="outline" onClick={() => exportDeliveryDataAsCsv(people, customers)}>
              <Download className="h-4 w-4" /> Exportar dados CSV
            </Button>
            <Button onClick={() => exportElementAsPdf("executive-dashboard", "dashboard-executivo-brq.pdf")}>
              <FileDown className="h-4 w-4" /> Exportar dashboard PDF
            </Button>
        </div>
      </div>

      <div id="executive-dashboard" className="space-y-4 rounded-xl">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-8">
          {kpis.map(({ label, value, icon: Icon, farmer }) => (
            <Card key={label} className="overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${farmer ? "bg-brq-ink text-white" : "bg-purple-50 text-brq-purple"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="text-2xl font-bold text-slate-950">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FinancialKpi label="Receita Atual" value={formatCurrency(financialTotals.revenueCurrent)} icon={TrendingUp} />
          <FinancialKpi label="Meta Prevista" value={formatCurrency(financialTotals.revenueTarget)} icon={Target} />
          <FinancialKpi label="Receita Hunter" value={formatCurrency(financialTotals.hunterRevenue)} icon={UserCog} />
          <FinancialKpi label="Delivery/Farmer" value={formatCurrency(financialTotals.deliveryFarmerRevenue)} icon={BriefcaseBusiness} />
        </section>

        <ChartCard title="Visão Financeira por Cliente">
          {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={financialByCustomer} layout="vertical" margin={{ top: 0, right: 10, left: 42, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="customerCluster" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenueCurrent" name="Receita Atual" fill="#15171B" radius={[0, 4, 4, 0]} />
              <Bar dataKey="revenueTarget" name="Meta Prevista" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer> : <ChartPlaceholder />}
        </ChartCard>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Visão Financeira por Diretor">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={financialByDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hunterRevenue" name="Hunter" stackId="total" fill="#EE7C38" radius={[0, 0, 0, 0]} />
                <Bar dataKey="deliveryFarmerRevenue" name="Delivery/Farmer" stackId="total" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>

          <ChartCard title="Visão Financeira por Subordinado">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={financialByManager} layout="vertical" margin={{ top: 0, right: 10, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hunterRevenue" name="Hunter" stackId="total" fill="#EE7C38" radius={[0, 0, 0, 0]} />
                <Bar dataKey="deliveryFarmerRevenue" name="Delivery/Farmer" stackId="total" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Distribuição por Perfil">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={roleDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                  {roleDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Clientes por Manager">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={clientsByManager} layout="vertical" margin={{ top: 0, right: 10, left: 15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="clientes" name="Clientes" fill="#15171B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>

          <ChartCard title="Clientes por Diretor">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={distributionByDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="clientes" name="Clientes" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>
        </section>
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />;
}

function FinancialKpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="overflow-hidden border-purple-100 bg-gradient-to-br from-white to-purple-50/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brq-purple text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-lg font-black text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(0)} mi`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
  return `R$ ${value.toFixed(0)}`;
}

function subscribeToHydration() {
  return () => undefined;
}

function ChartCard({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={className}>
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72 p-5 pt-0">{children}</CardContent>
    </Card>
  );
}
