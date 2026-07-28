import { z } from "zod";
import { createEmployeeImportClient } from "@/server/auth/employee-import-access";
import { applyEmployeeImportSalaryItem } from "@/server/employee-import/service";
import {
  EmployeeImportRequestError,
  handleEmployeeImportError,
} from "@/server/employee-import/http";

export const runtime = "nodejs";

const actionSchema = z.object({
  batchId: z.string().uuid(),
  personId: z.string().min(1).max(240),
});

export async function POST(request: Request) {
  try {
    const client = await createEmployeeImportClient(request);
    const action = actionSchema.safeParse(await request.json());
    if (!action.success) {
      throw new EmployeeImportRequestError("A ação salarial é inválida.", 400);
    }
    const result = await applyEmployeeImportSalaryItem({
      client,
      batchId: action.data.batchId,
      personId: action.data.personId,
    });
    return Response.json(result);
  } catch (error) {
    return handleEmployeeImportError(error);
  }
}
