"use client";

import type { User } from "@supabase/supabase-js";
import { LoaderCircle, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCurrentAccessUser, type AccessUser } from "@/lib/access-control";
import { AccessContextProvider } from "@/lib/access-context";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const client = getSupabaseBrowserClient();

  useEffect(() => {
    if (!client) return;

    let mounted = true;

    async function loadAccessProfile() {
      if (!client) return null;
      setLoadingAccess(true);
      try {
        return await fetchCurrentAccessUserWithRetry();
      } finally {
        setLoadingAccess(false);
      }
    }

    async function fetchCurrentAccessUserWithRetry() {
      if (!client) return null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const profile = await fetchCurrentAccessUser(client);
        if (profile) return profile;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      return null;
    }

    async function acceptUser(nextUser: User | null) {
      if (!client || !mounted) return;
      const email = nextUser?.email?.toLowerCase() ?? "";
      if (nextUser && !email.endsWith("@brq.com")) {
        await client.auth.signOut();
        if (!mounted) return;
        setUser(null);
        setAccessUser(null);
        setError("Use seu e-mail corporativo @brq.com.");
        setLoading(false);
        return;
      }
      if (nextUser) {
        let profile: AccessUser | null = null;
        try {
          profile = await loadAccessProfile();
        } catch (accessError) {
          console.error("Failed to load access profile", accessError);
          await client.auth.signOut();
          if (!mounted) return;
          setUser(null);
          setAccessUser(null);
          setError("Não foi possível validar seu acesso. Tente novamente ou solicite apoio ao administrador.");
          setLoading(false);
          return;
        }
        if (!mounted) return;
        if (!profile?.active) {
          await client.auth.signOut();
          if (!mounted) return;
          setUser(null);
          setAccessUser(null);
          setError("Seu usuário BRQ ainda não está liberado para acessar este hub. Solicite acesso ao administrador.");
          setLoading(false);
          return;
        }
        setAccessUser(profile);
      } else {
        setAccessUser(null);
      }
      setUser(nextUser);
      setLoading(false);
    }

    client.auth.getSession().then(({ data }) => {
      void acceptUser(data.session?.user ?? null);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void acceptUser(session?.user ?? null);
      if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  async function signIn(formData: FormData) {
    if (!client) return;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    setError("");
    setMessage("");
    if (!email.endsWith("@brq.com")) {
      setError("Use seu e-mail corporativo @brq.com.");
      return;
    }
    setSending(true);
    const { error: signInError } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (signInError) {
      setError("Não foi possível enviar o link de acesso. Tente novamente.");
      return;
    }
    setMessage("Link de acesso enviado. Verifique seu e-mail corporativo.");
  }

  async function refreshAccess() {
    if (!client || !user) return;
    const profile = await fetchCurrentAccessUser(client);
    setAccessUser(profile);
  }

  const accessContextValue = {
    user,
    accessUser,
    loadingAccess,
    isAdmin: accessUser?.active === true && accessUser.role === "admin",
    canEdit: accessUser?.active === true && (accessUser.role === "editor" || accessUser.role === "admin"),
    refreshAccess,
  };

  if (!client) {
    return (
      <AccessContextProvider value={accessContextValue}>
        {children}
      </AccessContextProvider>
    );
  }
  if (loading) {
    return <div className="grid min-h-screen place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-brq-purple" /></div>;
  }
  if (user) {
    return (
      <AccessContextProvider value={accessContextValue}>
        {children}
      </AccessContextProvider>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md border-purple-100 shadow-xl">
        <CardContent className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 text-brq-purple"><LockKeyhole /></div>
            <div><p className="text-2xl font-black tracking-[-0.08em]">brq</p><p className="text-sm text-slate-500">Delivery Coverage Hub</p></div>
          </div>
          <h1 className="text-2xl font-bold">Acesso corporativo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Receba um link seguro no seu e-mail BRQ. Não é necessário cadastrar senha.</p>
          <form action={signIn} className="mt-6 space-y-4">
            <Input name="email" type="email" placeholder="nome@brq.com" autoComplete="email" maxLength={254} required />
            <Button className="w-full" disabled={sending}>
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {sending ? "Enviando..." : "Enviar link de acesso"}
            </Button>
          </form>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4" /> Acesso restrito ao domínio corporativo.</div>
        </CardContent>
      </Card>
    </main>
  );
}
