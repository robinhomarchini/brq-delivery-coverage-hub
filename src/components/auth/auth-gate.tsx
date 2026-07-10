"use client";

import { LoaderCircle, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AccessUser } from "@/lib/access-control";
import { AccessContextProvider } from "@/lib/access-context";
import { createAuthServiceSelection, normalizeLoginEmail, validateCorporateEmail, type AuthenticatedUser } from "@/lib/auth/auth-service";

type AuthMode = "password" | "first_access" | "reset_password";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const authSelection = useMemo(() => createAuthServiceSelection(), []);
  const authService = authSelection.service;
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
  const [loading, setLoading] = useState(authSelection.configured);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authService) return;
    const service = authService;

    let mounted = true;

    async function loadAccessProfile() {
      setLoadingAccess(true);
      try {
        return await service.fetchCurrentAccessUserWithRetry();
      } finally {
        setLoadingAccess(false);
      }
    }

    async function acceptUser(nextUser: AuthenticatedUser | null) {
      if (!mounted) return;
      const email = nextUser?.email?.toLowerCase() ?? "";
      if (nextUser && !validateCorporateEmail(email)) {
        await service.signOut();
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
          await service.signOut();
          if (!mounted) return;
          setUser(null);
          setAccessUser(null);
          setError("Não foi possível validar seu acesso. Tente novamente ou solicite apoio ao administrador.");
          setLoading(false);
          return;
        }
        if (!mounted) return;
        if (!profile?.active) {
          await service.signOut();
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

    service.getCurrentUser().then((currentUser) => {
      void acceptUser(currentUser);
    });

    const unsubscribe = service.onAuthStateChange((event, nextUser) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveringPassword(true);
        setAuthMode("reset_password");
        setMessage("Informe uma nova senha para concluir a redefinição.");
      }
      void acceptUser(nextUser);
      if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [authService]);

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
    if (!authService) return;
    const email = normalizeLoginEmail(formData.get("email"));
    const password = String(formData.get("password") ?? "");
    setError("");
    setMessage("");
    if (!validateCorporateEmail(email)) {
      setError("Use seu e-mail corporativo @brq.com.");
      return;
    }
    if (password.length < 8) {
      setError("Informe a senha cadastrada. Ela deve ter pelo menos 8 caracteres.");
      return;
    }
    setSending(true);
    const signInResult = await authService.signInWithPassword(email, password)
      .then(() => ({ ok: true }))
      .catch(() => ({ ok: false }));
    setSending(false);
    if (!signInResult.ok) {
      setError("Não foi possível entrar com essa senha. Se você já fez o primeiro acesso, use Redefinir senha e depois tente entrar novamente.");
      return;
    }
  }

  async function createPasswordAccess(formData: FormData) {
    if (!authService) return;
    const email = normalizeLoginEmail(formData.get("email"));
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    setError("");
    setMessage("");
    if (!validateCorporateEmail(email)) {
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
    const signUpResult = await authService.createPasswordAccess(email, password, window.location.origin)
      .then((result) => ({ ok: true, hasSession: result.hasSession }))
      .catch(() => ({ ok: false, hasSession: false }));
    setSending(false);
    if (!signUpResult.ok) {
      setError("Não foi possível criar o primeiro acesso. Verifique se o e-mail está pré-cadastrado ou use Redefinir senha caso já tenha tentado antes.");
      return;
    }
    if (signUpResult.hasSession) {
      setMessage("Senha criada. Validando seu acesso...");
      return;
    }
    setMessage("Senha criada. Se receber um e-mail de confirmação da BRQ/Supabase, abra o link e depois entre com e-mail e senha. Se já tinha tentado antes, use Redefinir senha.");
  }

  async function sendPasswordReset(formData: FormData) {
    if (!authService) return;
    const email = normalizeLoginEmail(formData.get("email"));
    setError("");
    setMessage("");
    if (!validateCorporateEmail(email)) {
      setError("Use seu e-mail corporativo @brq.com.");
      return;
    }
    setSending(true);
    const resetResult = await authService.sendPasswordReset(email, window.location.origin)
      .then(() => ({ ok: true }))
      .catch(() => ({ ok: false }));
    setSending(false);
    if (!resetResult.ok) {
      setError("Não foi possível enviar o link de redefinição. Confirme o e-mail corporativo ou peça apoio ao administrador.");
      return;
    }
    setMessage("Enviamos um link para redefinir sua senha. Abra o e-mail, crie a nova senha e depois entre normalmente.");
  }

  async function updateRecoveredPassword(formData: FormData) {
    if (!authService) return;
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
    const updateResult = await authService.updatePassword(password)
      .then(() => ({ ok: true }))
      .catch(() => ({ ok: false }));
    setSending(false);
    if (!updateResult.ok) {
      setError("Não foi possível salvar a nova senha. Abra novamente o link de redefinição recebido por e-mail.");
      return;
    }
    setRecoveringPassword(false);
    setAuthMode("password");
    setMessage("Senha redefinida. Entre com e-mail e a nova senha.");
    await authService.signOut();
    setUser(null);
    setAccessUser(null);
  }

  async function refreshAccess() {
    if (!authService || !user) return;
    const profile = await authService.fetchCurrentAccessUserWithRetry();
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

  if (!authService && authSelection.provider === "corporate-sso") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-purple-100 shadow-xl">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 text-brq-purple"><LockKeyhole /></div>
              <div><p className="text-2xl font-black tracking-[-0.08em]">brq</p><p className="text-sm text-slate-500">Delivery Coverage Hub</p></div>
            </div>
            <h1 className="text-2xl font-bold">SSO corporativo pendente</h1>
            <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              {authSelection.reason ?? "O provedor de autenticação corporativo ainda não está disponível neste ambiente."}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!authService) {
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
