"use client";

import { CheckCircle2, LoaderCircle, Pencil, ShieldAlert, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  accessRoles,
  approveAccessUser,
  deactivateAccessUser,
  deleteAccessUser,
  isBrqEmail,
  listAccessUsers,
  normalizeAccessEmail,
  saveAccessUser,
  translateAccessRole,
  type AccessRole,
  type AccessStatus,
  type AccessUser,
} from "@/lib/access-control";
import { useAccess } from "@/lib/access-context";
import { notifyAccessUsersChanged } from "@/lib/access-events";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const initialForm = {
  email: "",
  role: "viewer" as AccessRole,
  active: true,
};

export default function SettingsPage() {
  const client = getSupabaseBrowserClient();
  const { accessUser, isAdmin, loadingAccess, refreshAccess } = useAccess();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const sortedUsers = useMemo(
    () => users.slice().sort((first, second) => first.email.localeCompare(second.email, "pt-BR")),
    [users],
  );

  useEffect(() => {
    if (!client || !isAdmin) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isAdmin]);

  if (loadingAccess) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-brq-purple" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          eyebrow="Administração"
          title="Configurações"
          description="Esta área é restrita a administradores do Delivery Coverage Hub."
        />
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Acesso restrito</p>
              <p className="mt-1 leading-6">Peça a um administrador para revisar seu papel de acesso caso precise gerenciar usuários.</p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  async function loadUsers() {
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      setUsers(await listAccessUsers(client));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Não foi possível carregar os usuários."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshUsersAndAccess() {
    await Promise.all([loadUsers(), refreshAccess()]);
    notifyAccessUsersChanged();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;

    const email = normalizeAccessEmail(form.email);
    setNotice("");
    setError("");

    if (!isBrqEmail(email)) {
      setError("Informe um e-mail corporativo @brq.com.");
      return;
    }

    setSaving(true);
    try {
      const mustRemainActive = editingEmail === accessUser?.email;
      await saveAccessUser(client, {
        email,
        role: form.role,
        active: mustRemainActive ? true : form.active,
      });
      await refreshUsersAndAccess();
      setNotice(editingEmail ? "Acesso atualizado com sucesso." : "Usuário pré-cadastrado com sucesso.");
      setForm(initialForm);
      setEditingEmail(null);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Não foi possível salvar o acesso."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(user: AccessUser) {
    if (!client) return;
    if (user.email === accessUser?.email) {
      setError("O usuário ativo atual deve ser mantido. Peça a outro administrador para alterar seu acesso, se necessário.");
      return;
    }
    setNotice("");
    setError("");
    setSaving(true);
    try {
      await deactivateAccessUser(client, user.email, user.role);
      await refreshUsersAndAccess();
      setNotice("Usuário desativado com sucesso.");
      if (editingEmail === user.email) {
        setForm({ ...form, active: false });
      }
    } catch (deactivateError) {
      setError(getErrorMessage(deactivateError, "Não foi possível desativar o usuário."));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(user: AccessUser) {
    if (!client) return;
    setNotice("");
    setError("");
    setSaving(true);
    try {
      await approveAccessUser(client, user);
      await refreshUsersAndAccess();
      setNotice(`Acesso de ${user.email} aprovado com sucesso.`);
      if (editingEmail === user.email) {
        setForm({ ...form, active: true });
      }
    } catch (approveError) {
      setError(getErrorMessage(approveError, "Não foi possível aprovar o usuário."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AccessUser) {
    if (!client) return;
    if (user.email === accessUser?.email) {
      setError("O usuário ativo atual deve ser mantido. Não é possível excluir a própria conta em uso.");
      return;
    }
    const confirmed = window.confirm(`Excluir o acesso de ${user.email}?\n\nSe for uma conta já autenticada, ela perderá acesso ao hub. O sistema manterá pelo menos um administrador ativo.`);
    if (!confirmed) return;

    setNotice("");
    setError("");
    setSaving(true);
    try {
      await deleteAccessUser(client, user.email);
      await refreshUsersAndAccess();
      setNotice("Usuário excluído com sucesso.");
      if (editingEmail === user.email) {
        resetForm();
      }
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Não foi possível excluir o usuário."));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(user: AccessUser) {
    setEditingEmail(user.email);
    setForm({
      email: user.email,
      role: user.role,
      active: user.email === accessUser?.email ? true : user.active,
    });
    setNotice("");
    setError("");
  }

  function resetForm() {
    setEditingEmail(null);
    setForm(initialForm);
    setNotice("");
    setError("");
  }

  const editingCurrentUser = editingEmail === accessUser?.email;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Gerencie o acesso corporativo ao Delivery Coverage Hub com pré-cadastro, primeiro login e aprovação final."
      />

      {notice && <SuccessNotice message={notice} floating />}
      {error && <ErrorNotice message={error} floating onClose={() => setError("")} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-brq-purple">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{editingEmail ? "Editar usuário" : "Pré-cadastrar usuário"}</CardTitle>
                <CardDescription className="mt-1">Use apenas e-mails corporativos BRQ. O usuário ainda precisará do seu OK após o primeiro login.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="access-email">E-mail</label>
                <Input
                  id="access-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="nome@brq.com"
                  autoComplete="email"
                  maxLength={254}
                  disabled={saving || Boolean(editingEmail)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="access-role">Papel</label>
                <Select
                  id="access-role"
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AccessRole }))}
                  disabled={saving}
                >
                  {accessRoles.map((role) => (
                    <option key={role} value={role}>{translateAccessRole(role)}</option>
                  ))}
                </Select>
              </div>

              <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brq-purple focus:ring-brq-purple"
                  checked={editingCurrentUser ? true : form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                  disabled={saving || editingCurrentUser}
                />
                {editingCurrentUser ? "Usuário atual mantido ativo" : "Convite habilitado / usuário aprovado"}
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {saving ? "Salvando..." : "Salvar acesso"}
                </Button>
                {editingEmail && (
                  <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Cancelar edição</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Usuários e convites</CardTitle>
              <CardDescription className="mt-1">Pré-cadastrado aguarda primeiro login. Aguardando aprovação exige seu OK final para liberar acesso.</CardDescription>
            </div>
            <Button type="button" variant="secondary" onClick={loadUsers} disabled={loading || saving}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                        <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-brq-purple" />
                        Carregando acessos...
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && sortedUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                        Nenhum usuário cadastrado.
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && sortedUsers.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{user.email}</div>
                        <div className="text-xs text-slate-400">{getAccessHelperText(user)}</div>
                      </TableCell>
                      <TableCell>{translateAccessRole(user.role)}</TableCell>
                      <TableCell>
                        <Badge variant={getAccessStatusVariant(user.status)}>
                          {translateAccessStatus(user.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "success" : user.status === "approval_pending" ? "warning" : "secondary"}>
                          {user.active ? "Liberado" : user.status === "approval_pending" ? "Aguardando OK" : "Sem acesso"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {user.status === "approval_pending" && (
                            <Button type="button" variant="default" onClick={() => handleApprove(user)} disabled={saving}>
                              <CheckCircle2 className="h-4 w-4" />
                              Aprovar
                            </Button>
                          )}
                          <Button type="button" variant="secondary" onClick={() => startEditing(user)} disabled={saving}>
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                          {user.email === accessUser?.email && (
                            <Badge variant="secondary" className="self-center">Usuário atual</Badge>
                          )}
                          {user.active && user.email !== accessUser?.email && (
                            <Button type="button" variant="destructive" onClick={() => handleDeactivate(user)} disabled={saving}>
                              Desativar
                            </Button>
                          )}
                          {user.email !== accessUser?.email && (
                            <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(user)} disabled={saving}>
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}

function translateAccessStatus(status: AccessStatus) {
  const labels: Record<AccessStatus, string> = {
    active: "Ativo",
    invited: "Pré-cadastrado",
    approval_pending: "Aguardando aprovação",
    blocked: "Bloqueado",
    pending: "Pré-cadastrado",
  };

  return labels[status] ?? "Pendente";
}

function getAccessStatusVariant(status: AccessStatus) {
  if (status === "active") return "success";
  if (status === "approval_pending") return "warning";
  if (status === "blocked") return "destructive";
  return "secondary";
}

function getAccessHelperText(user: AccessUser) {
  if (user.status === "active") return "Conta autenticada e aprovada";
  if (user.status === "approval_pending") return "Primeiro login realizado; aguardando aprovação";
  if (user.status === "blocked") return user.userId ? "Conta autenticada sem acesso" : "Convite bloqueado";
  return "Aguardando primeiro login";
}
