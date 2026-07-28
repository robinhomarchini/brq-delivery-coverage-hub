import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDeliveryCommandClient,
  DeliveryCommandAccessError,
} from "@/server/auth/delivery-command-access";

export async function createEmployeeImportClient(request: Request): Promise<SupabaseClient> {
  const { client, accessUser } = await createDeliveryCommandClient(request);
  if (accessUser.role !== "admin") {
    throw new DeliveryCommandAccessError("Employee import access denied.", 403);
  }

  const { data, error } = await client.rpc("can_manage_person_compensation");
  if (error || data !== true) {
    throw new DeliveryCommandAccessError("Employee import access denied.", 403);
  }
  return client;
}
