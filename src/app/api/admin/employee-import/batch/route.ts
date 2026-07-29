import { createEmployeeImportClient } from "@/server/auth/employee-import-access";
import { getEmployeeImportBatchById } from "@/server/employee-import/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    if (!batchId) {
      return Response.json({ error: "Informe o identificador do lote." }, { status: 400 });
    }
    const client = await createEmployeeImportClient(request);
    const preview = await getEmployeeImportBatchById(client, batchId);
    if (!preview) {
      return Response.json({ error: "Lote não encontrado ou não pertence ao período atual." }, { status: 404 });
    }
    return Response.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível recuperar o lote.";
    return Response.json({ error: message }, { status: 500 });
  }
}
