import { createEmployeeImportClient } from "@/server/auth/employee-import-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const client = await createEmployeeImportClient(request);
    const { data, error } = await client
      .from("employee_import_batches")
      .select("id,source_file_name,source_row_count,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw new Error("Não foi possível consultar os lotes de importação.");
    const batches = (data ?? []).map((batch) => ({
      id: batch.id,
      sourceFileName: batch.source_file_name,
      sourceRowCount: batch.source_row_count,
      status: batch.status,
      createdAt: batch.created_at,
    }));
    return Response.json({ batches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar o histórico de importação.";
    return Response.json({ error: message }, { status: 500 });
  }
}
