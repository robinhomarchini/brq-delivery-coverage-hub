import { z } from "zod";
import { createEmployeeImportClient } from "@/server/auth/employee-import-access";
import { applyAllEmployeeImportBatch } from "@/server/employee-import/service";
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
  managerMappings: z.record(z.string().min(1).max(120), z.string().min(1).max(120)).optional(),
  previewSnapshot: z.object({
    matchedPeople: z.array(z.object({
      personId: z.string().min(1).max(240),
      status: z.enum(["change", "unchanged", "updated"]),
    })),
  }),
});

export async function POST(request: Request) {
  try {
    const client = await createEmployeeImportClient(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new EmployeeImportRequestError("A solicitação de efetivação é inválida.", 400);
    }
    const result = await applyAllEmployeeImportBatch({
      client,
      batchId: parsed.data.batchId,
      mappings: parsed.data.mappings,
      managerMappings: parsed.data.managerMappings ?? {},
      previewSnapshot: parsed.data.previewSnapshot,
    });
    return Response.json(result);
  } catch (error) {
    return handleEmployeeImportError(error);
  }
}
