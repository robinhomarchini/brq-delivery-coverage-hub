import { z } from "zod";
import { createEmployeeImportClient } from "@/server/auth/employee-import-access";
import { applyEmployeeImport } from "@/server/employee-import/service";
import {
  EmployeeImportRequestError,
  getWorkbookFile,
  handleEmployeeImportError,
} from "@/server/employee-import/http";

export const runtime = "nodejs";

const mappingsSchema = z.record(
  z.string().min(1).max(240),
  z.string().min(1).max(240),
);

export async function POST(request: Request) {
  try {
    const client = await createEmployeeImportClient(request);
    const formData = await request.formData();
    const file = getWorkbookFile(formData);
    const rawMappings = String(formData.get("managerMappings") ?? "{}");
    let parsedMappings: unknown;
    try {
      parsedMappings = JSON.parse(rawMappings);
    } catch {
      throw new EmployeeImportRequestError("O de-para de gestores é inválido.", 400);
    }
    const mappings = mappingsSchema.safeParse(parsedMappings);
    if (!mappings.success) {
      throw new EmployeeImportRequestError("O de-para de gestores contém valores inválidos.", 400);
    }
    const result = await applyEmployeeImport({
      client,
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      manualMappings: mappings.data,
    });
    return Response.json(result);
  } catch (error) {
    return handleEmployeeImportError(error);
  }
}
