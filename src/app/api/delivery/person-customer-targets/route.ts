import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseDeliveryRepository } from "@/lib/repositories/supabaseDeliveryRepository";
import { getSafeCommandErrorMessage } from "@/server/api/command-errors";
import { createDeliveryCommandClient, DeliveryCommandAccessError } from "@/server/auth/delivery-command-access";

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
  try {
    const { client, accessUser } = await createDeliveryCommandClient(request, { allowHunterScopedWrite: true });
    const body = await request.json();
    const parsed = personCustomerTargetsCommandSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos para salvar metas." }, { status: 400 });
    }

    const repository = new SupabaseDeliveryRepository(client, {
      usePersonCustomerTargetsBff: false,
    });

    if (accessUser.role === "hunter_viewer") {
      if (parsed.data.increaseCustomerTarget) {
        return NextResponse.json(
          { error: "Consulta Hunter não pode alterar a meta total do cliente." },
          { status: 403 },
        );
      }
      const person = await repository.findPersonById(parsed.data.personId);
      const personEmail = person?.email?.trim().toLowerCase() ?? "";
      if (!person || personEmail !== accessUser.email.trim().toLowerCase()) {
        return NextResponse.json(
          { error: "Consulta Hunter só pode alterar metas vinculadas à própria pessoa." },
          { status: 403 },
        );
      }
    }

    const data = await repository.savePersonCustomerTargets(parsed.data);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DeliveryCommandAccessError) {
      return NextResponse.json(
        { error: "Acesso não autorizado para salvar metas." },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: getSafeCommandErrorMessage(error, "Não foi possível salvar as metas agora. Tente novamente em instantes.") },
      { status: 400 },
    );
  }
}
