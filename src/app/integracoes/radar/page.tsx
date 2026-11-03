"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const RADAR_ORIGIN = "https://brqrsalescompare.lovable.app";

export default function RadarConnectionPage() {
  return <Suspense fallback={<p className="p-6">Carregando conexão…</p>}><RadarConnection /></Suspense>;
}

function RadarConnection() {
  const params = useSearchParams();
  const candidateState = params.get("state") ?? "";
  const state = /^[a-f0-9]{64}$/.test(candidateState) ? candidateState : "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      if (!window.opener || !state) throw new Error();
      const { data } = await getSupabaseBrowserClient()!.auth.getSession();
      if (!data.session) throw new Error();
      const response = await fetch("/api/integrations/radar/session", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (!response.ok) throw new Error();
      const delegation: { token: string; expiresAt: number } = await response.json();
      window.opener.postMessage({ type: "org-delivery-catalog", state, delegation }, RADAR_ORIGIN);
      setMessage("Conexão autorizada. Volte ao Radar para consultar as carteiras.");
    } catch {
      setMessage("Não foi possível conectar. Verifique sua sessão e tente novamente.");
    } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Conectar carteira ao Radar BRQ</h1>
      <p>Autorizar leitura dos nomes de pessoas, papéis, clientes e vínculos que sua conta pode consultar no OrgBRQDelivery.</p>
      <p>Validade de até uma hora, limitada pela sua sessão. A integração não altera cadastros nem compartilha sua senha, dados de remuneração ou metas.</p>
      {!state && <p role="alert">Abra esta tela pelo botão Conectar OrgBRQDelivery no Radar.</p>}
      <Button onClick={connect} disabled={!state || busy}>{busy ? "Autorizando…" : "Autorizar leitura no Radar"}</Button>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
