import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseDeliveryRepository } from "@/lib/repositories/supabaseDeliveryRepository";
import { getSafeCommandErrorMessage } from "@/server/api/command-errors";
import { createDeliveryCommandClient, DeliveryCommandAccessError } from "@/server/auth/delivery-command-access";
import {
  categorizeTelemetryError,
  getCorrelationId,
  hashTelemetryValue,
  startOperation,
  withCorrelationHeader,
} from "@/server/observability/telemetry";

const personCustomerTargetsCommandSchema = z.object({
  customerId: z.string().trim().min(1).max(120),
  personId: z.string().trim().min(1).max(120),
  year: z.number().int().min(2020).max(2100),
  hunterAmount: z.number().finite().min(0).max(999999999999),
  hunterOwnAmount: z.number().finite().min(0).max(999999999999).optional(),
  farmerRenewalAmount: z.number().finite().min(0).max(999999999999),
  studioAmount: z.number().finite().min(0).max(999999999999),
  increaseCustomerTarget: z.boolean(),
  allowSpecialistHunterAsCustomerHunter: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const operation = startOperation({
    operationName: "delivery.personCustomerTargets.save",
    capability: "Targets",
    correlationId,
  });

  try {
    operation.startPhase("auth");
    const { client, accessUser } = await createDeliveryCommandClient(request, { allowHunterScopedWrite: true });
    operation.endPhase("auth");
    operation.setUser({
      userId: accessUser.userId,
      role: accessUser.role,
      emailHash: hashTelemetryValue(accessUser.email),
    });

    operation.startPhase("request.parse");
    const body = await request.json();
    const parsed = personCustomerTargetsCommandSchema.safeParse(body);
    operation.endPhase("request.parse");

    if (!parsed.success) {
      operation.fail({ errorCategory: "validation" });
      return withCorrelationHeader(
        NextResponse.json({ error: "Dados inválidos para salvar metas." }, { status: 400 }),
        correlationId,
      );
    }
    operation.setBusinessContext({
      customerId: parsed.data.customerId,
      personIdHash: hashTelemetryValue(parsed.data.personId),
      targetYear: parsed.data.year,
      targetType: "hunter_and_farmer_renewal",
    });

    const repository = new SupabaseDeliveryRepository(client, {
      usePersonCustomerTargetsBff: false,
    });

    if (accessUser.role === "hunter_viewer") {
      if (parsed.data.increaseCustomerTarget) {
        operation.fail({ errorCategory: "authorization" });
        return withCorrelationHeader(
          NextResponse.json(
            { error: "Consulta Hunter não pode alterar a meta total do cliente." },
            { status: 403 },
          ),
          correlationId,
        );
      }
      operation.startPhase("authorization.scope");
      const person = await repository.findPersonById(parsed.data.personId);
      operation.endPhase("authorization.scope");
      const personEmail = person?.email?.trim().toLowerCase() ?? "";
      if (!person || personEmail !== accessUser.email.trim().toLowerCase()) {
        operation.fail({ errorCategory: "authorization" });
        return withCorrelationHeader(
          NextResponse.json(
            { error: "Consulta Hunter só pode alterar metas vinculadas à própria pessoa." },
            { status: 403 },
          ),
          correlationId,
        );
      }
    }

    operation.startPhase("repository.save");
    const data = await repository.savePersonCustomerTargets(parsed.data);
    operation.endPhase("repository.save");
    operation.succeed({
      metrics: {
        targetComponents: 3,
        increaseCustomerTargetRequested: parsed.data.increaseCustomerTarget ? 1 : 0,
      },
    });

    return withCorrelationHeader(NextResponse.json(data), correlationId);
  } catch (error) {
    if (error instanceof DeliveryCommandAccessError) {
      operation.fail({ errorCategory: "authorization", error });
      return withCorrelationHeader(
        NextResponse.json(
          { error: "Acesso não autorizado para salvar metas." },
          { status: error.status },
        ),
        correlationId,
      );
    }

    operation.fail({ errorCategory: categorizeTelemetryError(error), error });
    return withCorrelationHeader(
      NextResponse.json(
        { error: getSafeCommandErrorMessage(error, "Não foi possível salvar as metas agora. Tente novamente em instantes.") },
        { status: 400 },
      ),
      correlationId,
    );
  }
}
