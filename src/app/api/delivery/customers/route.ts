import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseDeliveryRepository } from "@/lib/repositories/supabaseDeliveryRepository";
import { getSafeCommandErrorMessage } from "@/server/api/command-errors";
import { createDeliveryCommandClient, DeliveryCommandAccessError } from "@/server/auth/delivery-command-access";

const lifecycleFieldsSchema = {
  lifecycleStatus: z.enum(["active", "inactive", "closed"]).default("active"),
  closedAt: z.preprocess((value) => value ?? "", z.string().max(40)).transform((value) => value || undefined),
  closedReason: z.preprocess((value) => value ?? "", z.string().max(500)).transform((value) => value || undefined),
};

const customerCommandSchema = z.object({
  customer: z.object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    industry: z.string().trim().min(1).max(120),
    directorResponsibleId: z.string().trim().min(1).max(120),
    managerResponsibleIds: z.array(z.string().trim().min(1).max(120)).max(20),
    hunterTarget: z.number().finite().min(0).max(999999999999),
    farmerRenewalTarget: z.number().finite().min(0).max(999999999999),
    studioHunterTarget: z.number().finite().min(0).max(999999999999),
    studioTarget: z.number().finite().min(0).max(999999999999),
    revenue: z.number().finite().min(0).max(999999999999),
    margin: z.number().finite().min(0).max(100),
    strategicAccount: z.boolean(),
    ...lifecycleFieldsSchema,
  }),
  targetYear: z.number().int().min(2020).max(2100).default(2026),
});

export async function POST(request: Request) {
  try {
    const { client } = await createDeliveryCommandClient(request);
    const body = await request.json();
    const parsed = customerCommandSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos para salvar cliente." }, { status: 400 });
    }

    const repository = new SupabaseDeliveryRepository(client, {
      useCustomerBff: false,
      usePersonCustomerTargetsBff: false,
    });
    const data = await repository.saveCustomer(parsed.data.customer, parsed.data.targetYear);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DeliveryCommandAccessError) {
      return NextResponse.json(
        { error: "Acesso não autorizado para salvar cliente." },
        { status: error.status },
      );
    }

    console.error("delivery.customers.save.failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: getSafeCommandErrorMessage(error, "Não foi possível salvar o cliente agora. Tente novamente em instantes.") },
      { status: 400 },
    );
  }
}
