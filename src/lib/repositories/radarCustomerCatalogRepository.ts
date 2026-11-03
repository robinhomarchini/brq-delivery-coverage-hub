import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ROLE_TYPES, isHunterRole, isSpecialistHunterRole, isDeliveryManagerRole, isCustomerManagerProfile } from "@/lib/roles";

export type CatalogCategory = "Hunter" | "Vendas Especializadas" | "Delivery Manager";
const personSchema = z.object({ id: z.string(), name: z.string(), role_type: z.enum(ROLE_TYPES), is_manager: z.boolean() });
const customerSchema = z.object({ id: z.string(), name: z.string() });
const coverageSchema = z.object({ person_id: z.string(), customer_id: z.string() });
const specialistSchema = z.object({ person_id: z.string(), studio_target_allocation_id: z.string(), target_year: z.number().int() });
const studioSchema = z.object({ id: z.string(), customer_id: z.string(), target_year: z.number().int() });

export function buildRadarCustomerCatalog(input: {
  people: unknown; customers: unknown; coverage: unknown; specialists: unknown; studios: unknown;
}, year: number) {
  const people = z.array(personSchema).parse(input.people).flatMap((person) => {
    const categories: CatalogCategory[] = [];
    if (isSpecialistHunterRole(person.role_type)) categories.push("Vendas Especializadas");
    else if (isHunterRole(person.role_type)) categories.push("Hunter");
    if (isDeliveryManagerRole(person.role_type) || isCustomerManagerProfile(person.role_type, person.is_manager)) categories.push("Delivery Manager");
    return categories.length ? [{ id: person.id, name: person.name, role: person.role_type, categories }] : [];
  });
  const personIds = new Set(people.map((person) => person.id));
  const customers = z.array(customerSchema).parse(input.customers);
  const customerIds = new Set(customers.map((customer) => customer.id));
  const studios = new Map(z.array(studioSchema).parse(input.studios).filter((row) => row.target_year === year).map((row) => [row.id, row.customer_id]));
  const links = new Map<string, { personId: string; customerId: string; coverage: boolean; specialist: boolean }>();
  function add(personId: string, customerId: string, kind: "coverage" | "specialist") {
    if (!personIds.has(personId) || !customerIds.has(customerId)) return;
    const key = JSON.stringify([personId, customerId]);
    const link = links.get(key) ?? { personId, customerId, coverage: false, specialist: false };
    link[kind] = true;
    links.set(key, link);
  }
  for (const link of z.array(coverageSchema).parse(input.coverage)) add(link.person_id, link.customer_id, "coverage");
  for (const link of z.array(specialistSchema).parse(input.specialists)) {
    const customerId = studios.get(link.studio_target_allocation_id);
    if (link.target_year === year && customerId) add(link.person_id, customerId, "specialist");
  }
  return { source: "OrgBRQDelivery" as const, year, retrievedAt: new Date().toISOString(), people, customers, assignments: [...links.values()] };
}

/** All reads use the source user's client and RLS. No administrative key. */
export class RadarCustomerCatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async read(year: number) {
    const results = await Promise.all([
      this.client.from("people").select("id,name,role_type,is_manager", { count: "exact" }).eq("active", true).eq("lifecycle_status", "active").order("id").limit(1000),
      this.client.from("customers").select("id,name", { count: "exact" }).order("id").limit(1000),
      this.client.from("person_customer_assignments").select("person_id,customer_id", { count: "exact" }).order("person_id").order("customer_id").limit(1000),
      this.client.from("specialist_hunter_studio_assignments").select("person_id,studio_target_allocation_id,target_year", { count: "exact" }).eq("target_year", year).order("id").limit(1000),
      this.client.from("studio_target_allocations").select("id,customer_id,target_year", { count: "exact" }).eq("target_year", year).order("id").limit(1000),
    ]);
    for (const result of results) {
      if (result.error) throw new Error("Nao foi possivel consultar o catalogo autorizado.");
      if (result.count == null || result.count > (result.data?.length ?? 0)) throw new Error("Catalogo excede o limite de leitura. Consulte o administrador.");
    }
    return buildRadarCustomerCatalog({ people: results[0].data, customers: results[1].data, coverage: results[2].data, specialists: results[3].data, studios: results[4].data }, year);
  }
}
