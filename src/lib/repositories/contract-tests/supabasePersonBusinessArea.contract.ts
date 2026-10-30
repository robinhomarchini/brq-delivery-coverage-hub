import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Person, PersonBusinessArea } from "@/data/mockData";
import { SupabaseDeliveryRepository } from "../supabaseDeliveryRepository";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value));
  return value;
}

function businessArea(value: unknown): PersonBusinessArea | null {
  assert.ok(value === null || value === "Vendas" || value === "Delivery" || value === "Outras");
  return value;
}

export async function runSupabasePersonBusinessAreaContractTests() {
  const person: Person = {
    id: "person-contract-test", name: "Contract person", email: "contract@example.test",
    jobTitle: "Test role", roleType: "Staff", clientIds: [], active: true,
    lifecycleStatus: "active", isManager: false, hierarchyLevel: 3,
  };
  let row = {
    id: person.id, name: person.name, email: person.email, job_title: person.jobTitle,
    role_type: person.roleType, active: true, is_manager: false, hierarchy_level: 3,
    director_id: null, manager_id: null, area_id: null, territory_ids: [], client_ids: [],
    photo_url: null, notes: null, business_area: null as PersonBusinessArea | null,
  };
  let mode: "rpc" | "fallback" | "denied" = "rpc";
  const calls: Array<{ method: string; path: string; payload: Record<string, unknown> }> = [];
  const mockFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const pathname = new URL(request.url).pathname;
    const source = await request.text();
    const payload = source ? record(JSON.parse(source)) : {};
    calls.push({ method: request.method, path: pathname, payload });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { "Content-Type": "application/json" },
    });
    if (pathname.endsWith("/rpc/save_person_with_assignments")) {
      if (mode === "denied") return json({ code: "42501", message: "Denied classification change" }, 403);
      if (mode === "fallback") return json({ code: "PGRST202", message: "Missing RPC" }, 404);
      row = { ...row, business_area: businessArea(payload.p_business_area) };
      return new Response(null, { status: 204 });
    }
    if (pathname.endsWith("/rpc/get_full_delivery_data")) return json({ people: [row] });
    if (pathname.endsWith("/people")) {
      if (request.method === "GET") return json(row);
      if (request.method === "POST") row = { ...row, business_area: businessArea(payload.business_area) };
      return new Response(null, { status: 204 });
    }
    if (pathname.endsWith("/person_customer_assignments") && request.method === "DELETE") return new Response(null, { status: 204 });
    throw new Error(`Unexpected adapter request: ${request.method} ${pathname}`);
  };
  const client = createClient("http://127.0.0.1:54321", "contract-test-key", {
    global: { fetch: mockFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const repository = new SupabaseDeliveryRepository(client);

  assert.equal((await repository.findPersonById(person.id))?.businessArea, undefined, "legacy NULL must remain unclassified");
  const values: Array<PersonBusinessArea | undefined> = ["Vendas", "Delivery", "Outras", undefined];
  for (const testMode of ["rpc", "fallback"] as const) {
    mode = testMode;
    for (const value of values) {
      calls.length = 0;
      const saved = await repository.savePerson({ ...person, businessArea: value });
      assert.equal(saved.people[0]?.businessArea, value, `${mode}: hydrated save must preserve classification`);
      assert.equal((await repository.findPersonById(person.id))?.businessArea, value, `${mode}: fresh lookup must preserve classification`);
      assert.equal(calls.find((call) => call.path.endsWith("/rpc/save_person_with_assignments"))?.payload.p_business_area, value ?? null);
      const fallback = calls.find((call) => call.path.endsWith("/people") && call.method === "POST");
      if (mode === "fallback") assert.equal(fallback?.payload.business_area, value ?? null, "fallback maps optional classification to nullable column");
      else assert.equal(fallback, undefined, "successful RPC must not duplicate person upsert");
    }
  }

  mode = "denied";
  calls.length = 0;
  await assert.rejects(repository.savePerson({ ...person, businessArea: "Vendas" }), (error: unknown) => record(error).code === "42501");
  assert.equal(calls.length, 1, "authorization errors must not fall back or perform subsequent writes");
  assert.equal((await repository.findPersonById(person.id))?.businessArea, undefined, "denied save must not change classification");
  console.log("Supabase person business-area adapter contract checks passed.");
}
