"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardList,
  FileSearch,
  Files,
  GitBranch,
  LayoutDashboard,
  Layers3,
  Map,
  Menu,
  Settings,
  Target,
  LogOut,
  MonitorSmartphone,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { createAuthServiceSelection } from "@/lib/auth/auth-service";
import { resolvePersistenceProvider } from "@/lib/repositories";
import { useDeliveryStore } from "@/store/delivery-store";
import { ErrorNotice } from "@/components/shared/success-notice";
import { isHunterConsultAccess, translateAccessRole } from "@/lib/access-control";
import { useAccess } from "@/lib/access-context";
import { canManageCompensation } from "@/lib/compensation-access";

const navigation = [
  { href: "/", label: "Dashboard Executivo", icon: LayoutDashboard },
  { href: "/organograma", label: "Organograma", icon: GitBranch },
  { href: "/pessoas", label: "Pessoas", icon: UsersRound },
  { href: "/areas-studios", label: "Áreas / Studios", icon: Layers3 },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/portfolio-clientes", label: "Portfólio de Clientes", icon: ChartNoAxesCombined },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/metas-pessoas", label: "Metas por Pessoa", icon: Target },
  { href: "/metas-studios", label: "Metas por Área/Studio", icon: Layers3 },
  { href: "/metas-hunters-especializados", label: "Metas Hunter Especializado", icon: Target },
  { href: "/relatorio-metas", label: "Relatório de Metas", icon: ClipboardList },
  { href: "/baselines", label: "Baselines", icon: Files },
  { href: "/comparativo-baseline", label: "Baseline vs Cadastro", icon: FileSearch },
  { href: "/insights", label: "Insights", icon: Bot },
  { href: "/analise-desafio", label: "Análise de Desafio", icon: BrainCircuit, vpOnly: true },
  { href: "/assuntos", label: "Assuntos", icon: Target, disabled: true },
  { href: "/mapa-cobertura", label: "Mapa de Cobertura", icon: Map, disabled: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
  { href: "/ajuda", label: "Ajuda", icon: CircleHelp },
];

const mobileAllowedRoutes = new Set([
  "/",
  "/portfolio-clientes",
  "/relatorio-metas",
  "/baselines",
  "/comparativo-baseline",
  "/ajuda",
]);

const hunterConsultRoutes = new Set([
  "/clientes",
  "/relatorio-metas",
  "/ajuda",
]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const { accessUser, isAdmin } = useAccess();
  const { error, clearError, people } = useDeliveryStore();
  const canViewCompensation = canManageCompensation(accessUser, people);
  const hunterConsultOnly = isHunterConsultAccess(accessUser);
  const visibleNavigation = navigation.filter((item) =>
    (!item.adminOnly || isAdmin)
    && (!item.vpOnly || canViewCompensation)
    && (!hunterConsultOnly || hunterConsultRoutes.has(item.href))
  );
  const current = navigation.find((item) => item.href === pathname) ?? navigation[0];
  const authSelection = useMemo(() => createAuthServiceSelection(), []);
  const persistenceProvider = useMemo(() => resolvePersistenceProvider(), []);
  const authService = authSelection.service;
  const userEmail = accessUser?.email ?? "Usuário BRQ";
  const userInitials = getInitials(userEmail);
  const dataStatus = persistenceProvider === "supabase"
    ? { label: "Dados persistidos", className: "bg-emerald-500" }
    : persistenceProvider === "unavailable"
      ? { label: "Configuração pendente", className: "bg-amber-500" }
      : { label: "Dados demonstrativos", className: "bg-emerald-500" };
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const mobileRestricted = isMobileViewport && !mobileAllowedRoutes.has(pathname);
  const hunterRestricted = hunterConsultOnly && !hunterConsultRoutes.has(pathname);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileState = () => setIsMobileViewport(mediaQuery.matches);

    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);

    return () => mediaQuery.removeEventListener("change", updateMobileState);
  }, []);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-white text-slate-700 shadow-sm transition-transform lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="text-[25px] font-black tracking-[-0.18em] text-brq-ink" aria-label="BRQ">brq</div>
            <div>
              <p className="text-sm font-bold leading-tight text-brq-ink">Delivery</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Coverage Hub</p>
            </div>
          </Link>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Navegação</p>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const desktopOnlyOnMobile = isMobileViewport && !mobileAllowedRoutes.has(item.href);
            if (item.disabled || desktopOnlyOnMobile) {
              return (
                <div
                  key={item.href}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300"
                  title={desktopOnlyOnMobile ? "Disponível no desktop" : "Módulo em avaliação"}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    {desktopOnlyOnMobile ? "Desktop" : "Pausado"}
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active ? "bg-purple-50 text-brq-purple shadow-sm ring-1 ring-purple-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="relative shrink-0 border-t bg-white p-3">
          <div className="flex items-center gap-3 pr-9">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-100 text-xs font-bold text-brq-purple">{userInitials}</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">{userEmail}</p>
              <p className="truncate text-[10px] text-slate-400">
                {accessUser ? translateAccessRole(accessUser.role) : "Acesso local"}
              </p>
            </div>
          </div>
          {authService && <button onClick={() => authService.signOut()} className="absolute bottom-3 right-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sair"><LogOut className="h-4 w-4" /></button>}
        </div>
      </aside>

      {mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="min-w-0 overflow-x-hidden lg:pl-72">
        <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center justify-between gap-2 border-b bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-xl border p-2.5 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">BRQ · Building delivery that matters</p>
              <p className="truncate text-sm font-semibold text-slate-800 sm:hidden">{current.label}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <span className={`h-2 w-2 rounded-full ${dataStatus.className}`} />
            {dataStatus.label}
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] w-full min-w-0 max-w-[1680px] overflow-x-hidden p-4 sm:p-6">
          {error && <ErrorNotice message={error} floating onClose={clearError} />}
          <div key={routeKey} className="min-w-0">
            {hunterRestricted
              ? <RestrictedAccessView />
              : mobileRestricted
                ? <MobileRestrictedView currentLabel={current.label} />
                : children}
          </div>
        </main>
      </div>
    </div>
  );
}

function RestrictedAccessView() {
  const links = navigation.filter((item) => hunterConsultRoutes.has(item.href));

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-50 text-brq-purple">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Consulta Hunter</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">Acesso limitado ao seu relatório</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Este perfil consulta apenas o relatório de metas do próprio Hunter e os clientes vinculados, sem permissões de alteração.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-purple-100 hover:bg-purple-50 hover:text-brq-purple"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MobileRestrictedView({ currentLabel }: { currentLabel: string }) {
  const mobileLinks = navigation.filter((item) => mobileAllowedRoutes.has(item.href));

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-50 text-brq-purple">
          <MonitorSmartphone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Modo mobile</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">{currentLabel} fica melhor no desktop</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            No celular, o hub mostra apenas consultas simples e relatórios básicos. Use desktop ou tablet para telas operacionais, cadastros, metas detalhadas e administração.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {mobileLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-purple-100 hover:bg-purple-50 hover:text-brq-purple"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function getInitials(email: string) {
  const [name] = email.split("@");
  const parts = name.split(/[._-]/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}
