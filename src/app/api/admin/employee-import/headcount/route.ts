import { z } from "zod";
import { createEmployeeImportClient } from "@/server/auth/employee-import-access";
import { confirmEmployeeImportHeadcount } from "@/server/employee-import/service";
import { EmployeeImportRequestError, handleEmployeeImportError } from "@/server/employee-import/http";

export const runtime = "nodejs";

const requestSchema = z.object({
  batchId: z.string().uuid(),
  mappings: z.array(z.object({
    sourceKey: z.string().min(1).max(240),
    sourceName: z.string().min(1).max(240),
    personId: z.string().min(1).max(240),
    employeeCount: z.number().int().nonnegative().max(100000),
  })).min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const client = await createEmployeeImportClient(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new EmployeeImportRequestError("O de-para de HC é inválido.", 400);
    }
    return Response.json(await confirmEmployeeImportHeadcount({
      client,
      batchId: parsed.data.batchId,
      mappings: parsed.data.mappings,
    }));
  } catch (error) {
    return handleEmployeeImportError(error);
  }
}
