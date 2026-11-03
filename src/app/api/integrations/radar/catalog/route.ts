import { NextResponse } from "next/server";
import { z } from "zod";
import { readCatalogDelegation } from "@/server/auth/radar-catalog-delegation";
import { createDeliveryCommandClient, DeliveryCommandAccessError } from "@/server/auth/delivery-command-access";
import { RadarCustomerCatalogRepository } from "@/lib/repositories/radarCustomerCatalogRepository";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const year = z.coerce.number().int().min(2020).max(2100).safeParse(new URL(request.url).searchParams.get("year"));
  if (!year.success) return NextResponse.json({ error: "Ano invalido." }, { status: 400, headers });
  let sourceToken: string;
  try {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
    sourceToken = readCatalogDelegation(bearer).accessToken;
  } catch {
    return NextResponse.json({ error: "Conexao invalida ou expirada. Conecte novamente." }, { status: 401, headers });
  }
  try {
    const { client } = await createDeliveryCommandClient(new Request(request.url, { headers: { Authorization: `Bearer ${sourceToken}` } }), { allowReadOnly: true });
    const catalog = await new RadarCustomerCatalogRepository(client).read(year.data);
    return NextResponse.json(catalog, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Nao foi possivel consultar o catalogo autorizado." }, { status: error instanceof DeliveryCommandAccessError ? error.status : 503, headers });
  }
}
