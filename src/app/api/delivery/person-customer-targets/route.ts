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
    const { client } = await createDeliveryCommandClient(request);
    const body = await request.json();
    const parsed = personCustomerTargetsCommandSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos para salvar metas." }, { status: 400 });
    }

    const repository = new SupabaseDeliveryRepository(client, {
      usePersonCustomerTargetsBff: false,
    });
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
