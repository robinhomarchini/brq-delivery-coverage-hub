import { createEmployeeImportClient } from "@/server/auth/employee-import-access";
import { getWorkbookFile, handleEmployeeImportError } from "@/server/employee-import/http";
import { buildEmployeeImportPreview } from "@/server/employee-import/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const client = await createEmployeeImportClient(request);
    const file = getWorkbookFile(await request.formData());
    const preview = await buildEmployeeImportPreview({
      client,
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    return Response.json(preview);
  } catch (error) {
    return handleEmployeeImportError(error);
  }
}
