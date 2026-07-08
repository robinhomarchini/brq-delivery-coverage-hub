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

type AuthMode = "password" | "first_access" | "reset_password";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("password");
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
          setError("Seu usuário BRQ ainda não está liberado para acessar este hub. Peça ao administrador para pré-cadastrar ou reativar seu e-mail.");
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

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveringPassword(true);
        setAuthMode("reset_password");
        setMessage("Informe uma nova senha para concluir a redefinição.");
      }
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

  async function submitAccess(formData: FormData) {
    if (authMode === "first_access") {
      await createPasswordAccess(formData);
      return;
    }
    if (authMode === "reset_password") {
      await sendPasswordReset(formData);
      return;
    }
    await signInWithPassword(formData);
  }

  async function signInWithPassword(formData: FormData) {
    if (!client) return;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    setError("");
    setMessage("");
    if (!email.endsWith("@brq.com")) {
      setError("Use seu e-mail corporativo @brq.com.");
      return;
    }
    if (password.length < 8) {
      setError("Informe a senha cadastrada. Ela deve ter pelo menos 8 caracteres.");
      return;
    }
    setSending(true);
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    setSending(false);
    if (signInError) {
      setError("Não foi possível entrar com essa senha. Se você já fez o primeiro acesso, use Redefinir senha e depois tente entrar novamente.");
      return;
    }
  }

  async function createPasswordAccess(formData: FormData) {
    if (!client) return;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    setError("");
    setMessage("");
    if (!email.endsWith("@brq.com")) {
      setError("Use seu e-mail corporativo @brq.com.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("A confirmação de senha não confere.");
      return;
    }
    setSending(true);
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (signUpError) {
      setError("Não foi possível criar o primeiro acesso. Verifique se o e-mail está pré-cadastrado ou use Redefinir senha caso já tenha tentado antes.");
      return;
    }
    if (signUpData.session) {
      setMessage("Senha criada. Validando seu acesso...");
      return;
    }
    setMessage("Senha criada. Se receber um e-mail de confirmação da BRQ/Supabase, abra o link e depois entre com e-mail e senha. Se já tinha tentado antes, use Redefinir senha.");
  }

  async function sendPasswordReset(formData: FormData) {
    if (!client) return;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    setError("");
    setMessage("");
    if (!email.endsWith("@brq.com")) {
      setError("Use seu e-mail corporativo @brq.com.");
      return;
    }
    setSending(true);
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setSending(false);
    if (resetError) {
      setError("Não foi possível enviar o link de redefinição. Confirme o e-mail corporativo ou peça apoio ao administrador.");
      return;
    }
    setMessage("Enviamos um link para redefinir sua senha. Abra o e-mail, crie a nova senha e depois entre normalmente.");
  }

  async function updateRecoveredPassword(formData: FormData) {
    if (!client) return;
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("A confirmação de senha não confere.");
      return;
    }
    setSending(true);
    const { error: updateError } = await client.auth.updateUser({ password });
    setSending(false);
    if (updateError) {
      setError("Não foi possível salvar a nova senha. Abra novamente o link de redefinição recebido por e-mail.");
      return;
    }
    setRecoveringPassword(false);
    setAuthMode("password");
    setMessage("Senha redefinida. Entre com e-mail e a nova senha.");
    await client.auth.signOut();
    setUser(null);
    setAccessUser(null);
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
  if (recoveringPassword) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-purple-100 shadow-xl">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 text-brq-purple"><LockKeyhole /></div>
              <div><p className="text-2xl font-black tracking-[-0.08em]">brq</p><p className="text-sm text-slate-500">Delivery Coverage Hub</p></div>
            </div>
            <h1 className="text-2xl font-bold">Redefinir senha</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Crie uma nova senha para seu e-mail BRQ e depois entre normalmente.</p>
            <form action={updateRecoveredPassword} className="mt-5 space-y-4">
              <Input name="password" type="password" placeholder="Nova senha" autoComplete="new-password" minLength={8} required />
              <Input name="confirmPassword" type="password" placeholder="Confirmar nova senha" autoComplete="new-password" minLength={8} required />
              <Button className="w-full" disabled={sending}>
                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {sending ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          </CardContent>
        </Card>
      </main>
    );
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
          <p className="mt-2 text-sm leading-6 text-slate-500">Entre com e-mail BRQ e senha. No primeiro acesso, crie sua senha usando um e-mail já pré-cadastrado pelo administrador.</p>

          <div className="mt-6 grid grid-cols-3 rounded-2xl bg-slate-100 p-1 text-sm font-semibold">
            <button
              type="button"
              className={`rounded-xl px-3 py-2 transition ${authMode === "password" ? "bg-white text-brq-purple shadow-sm" : "text-slate-500"}`}
              onClick={() => {
                setAuthMode("password");
                setError("");
                setMessage("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 transition ${authMode === "first_access" ? "bg-white text-brq-purple shadow-sm" : "text-slate-500"}`}
              onClick={() => {
                setAuthMode("first_access");
                setError("");
                setMessage("");
              }}
            >
              Primeiro acesso
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 transition ${authMode === "reset_password" ? "bg-white text-brq-purple shadow-sm" : "text-slate-500"}`}
              onClick={() => {
                setAuthMode("reset_password");
                setError("");
                setMessage("");
              }}
            >
              Redefinir senha
            </button>
          </div>

          <form action={submitAccess} className="mt-5 space-y-4">
            <Input name="email" type="email" placeholder="nome@brq.com" autoComplete="email" maxLength={254} required />
            {authMode !== "reset_password" && (
              <Input name="password" type="password" placeholder="Senha" autoComplete={authMode === "password" ? "current-password" : "new-password"} minLength={8} required />
            )}
            {authMode === "first_access" && (
              <Input name="confirmPassword" type="password" placeholder="Confirmar senha" autoComplete="new-password" minLength={8} required />
            )}
            <Button className="w-full" disabled={sending}>
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {sending ? "Processando..." : authMode === "password" ? "Entrar" : authMode === "first_access" ? "Criar senha" : "Enviar link"}
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
