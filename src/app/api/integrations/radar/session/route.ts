import { NextResponse } from "next/server";
import { createDeliveryCommandClient, DeliveryCommandAccessError } from "@/server/auth/delivery-command-access";
import { issueCatalogDelegation } from "@/server/auth/radar-catalog-delegation";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origem nao permitida." }, { status: 403, headers });
  try {
    await createDeliveryCommandClient(request, { allowReadOnly: true });
    const token = request.headers.get("authorization")!.replace(/^Bearer\s+/i, "").trim();
    return NextResponse.json(issueCatalogDelegation(token), { headers });
  } catch (error) {
    return NextResponse.json({ error: "Nao foi possivel autorizar a conexao. Verifique sua sessao do OrgBRQDelivery." }, { status: error instanceof DeliveryCommandAccessError ? error.status : 503, headers });
  }
}
