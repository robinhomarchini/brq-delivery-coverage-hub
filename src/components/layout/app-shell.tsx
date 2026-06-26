"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChartNoAxesCombined,
  GitBranch,
  LayoutDashboard,
  Map,
  Menu,
  Settings,
  Target,
  LogOut,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDeliveryStore } from "@/store/delivery-store";
import { ErrorNotice } from "@/components/shared/success-notice";

const navigation = [
  { href: "/", label: "Dashboard Executivo", icon: LayoutDashboard },
  { href: "/organograma", label: "Organograma", icon: GitBranch },
  { href: "/pessoas", label: "Pessoas", icon: UsersRound },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/portfolio-clientes", label: "Portfólio de Clientes", icon: ChartNoAxesCombined },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/assuntos", label: "Assuntos", icon: Target, disabled: true },
  { href: "/mapa-cobertura", label: "Mapa de Cobertura", icon: Map },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navigation.find((item) => item.href === pathname) ?? navigation[0];
  const client = getSupabaseBrowserClient();
  const { error, clearError } = useDeliveryStore();

  return (
    <div className="min-h-screen">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r bg-white text-slate-700 transition-transform lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center justify-between border-b px-4">
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
        <nav className="space-y-1 p-3">
          <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Navegação</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300"
                  title="Módulo em avaliação"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Pausado</span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-purple-50 text-brq-purple" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-purple-100 text-xs font-bold text-brq-purple">RM</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">Robinson Marchini</p>
              <p className="truncate text-[10px] text-slate-400">Diretor Executivo</p>
            </div>
          </div>
          {client && <button onClick={() => client.auth.signOut()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sair"><LogOut className="h-4 w-4" /></button>}
        </div>
      </aside>

      {mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border p-2.5 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">BRQ · Building delivery that matters</p>
              <p className="text-sm font-semibold text-slate-800 sm:hidden">{current.label}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Dados demonstrativos
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1680px] p-4 sm:p-6">
          {error && <ErrorNotice message={error} floating onClose={clearError} />}
          {children}
        </main>
      </div>
    </div>
  );
}
