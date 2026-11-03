import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { issueCatalogDelegation, readCatalogDelegation } from "../src/server/auth/radar-catalog-delegation";
import { buildRadarCustomerCatalog, RadarCustomerCatalogRepository } from "../src/lib/repositories/radarCustomerCatalogRepository";
import { createDeliveryCommandClient } from "../src/server/auth/delivery-command-access";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const originalKey = process.env.RADAR_CATALOG_DELEGATION_KEY;
  process.env.RADAR_CATALOG_DELEGATION_KEY = randomBytes(32).toString("hex");
  const now = Date.now();
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + 300 })).toString("base64url")}.private-source-signature`;
  const delegation = issueCatalogDelegation(token, now);
  assert.equal(delegation.token.includes(token), false);
  assert.equal(readCatalogDelegation(delegation.token, now).accessToken, token);
  assert.ok(delegation.expiresAt <= now + 300_000);
  assert.throws(() => readCatalogDelegation(delegation.token, delegation.expiresAt));
  const parts = delegation.token.split(".");
  const ciphertext = Buffer.from(parts[3], "base64url");
  ciphertext[0] ^= 1;
  parts[3] = ciphertext.toString("base64url");
  assert.throws(() => readCatalogDelegation(parts.join("."), now));
  assert.throws(() => readCatalogDelegation(token, now));
  process.env.RADAR_CATALOG_DELEGATION_KEY = randomBytes(32).toString("hex");
  assert.throws(() => readCatalogDelegation(delegation.token, now));
  delete process.env.RADAR_CATALOG_DELEGATION_KEY;
  assert.throws(() => issueCatalogDelegation(token, now));
  if (originalKey !== undefined) process.env.RADAR_CATALOG_DELEGATION_KEY = originalKey;

  const data = buildRadarCustomerCatalog({
    people: [
      { id: "h", name: "Hunter teste", role_type: "Hunter", is_manager: false, email: "excluded@example.test" },
      { id: "s", name: "Especialista teste", role_type: "Hunter Especializado", is_manager: false },
      { id: "d", name: "Delivery teste", role_type: "Delivery", is_manager: true },
      { id: "x", name: "Diretor teste", role_type: "Director", is_manager: false },
    ],
    customers: [{ id: "a", name: "Cliente teste", margin: 99 }],
    coverage: [{ person_id: "h", customer_id: "a" }, { person_id: "s", customer_id: "a" }, { person_id: "missing", customer_id: "a" }],
    specialists: [
      { person_id: "s", studio_target_allocation_id: "studio1", target_year: 2026 },
      { person_id: "s", studio_target_allocation_id: "studio2", target_year: 2026 },
      { person_id: "d", studio_target_allocation_id: "studio1", target_year: 2025 },
    ],
    studios: [{ id: "studio1", customer_id: "a", target_year: 2026 }, { id: "studio2", customer_id: "a", target_year: 2026 }],
  }, 2026);
  assert.equal(data.people.length, 3);
  assert.deepEqual(data.people.find((person) => person.id === "s")?.categories, ["Vendas Especializadas"]);
  assert.deepEqual(data.people.find((person) => person.id === "d")?.categories, ["Delivery Manager"]);
  assert.equal(data.assignments.length, 2);
  assert.deepEqual(data.assignments.find((link) => link.personId === "s"), { personId: "s", customerId: "a", coverage: true, specialist: true });
  assert.equal(JSON.stringify(data).includes("excluded@example.test"), false);
  assert.equal("margin" in data.customers[0], false);

  const originalFetch = globalThis.fetch;
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://source.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public";
  let role = "viewer", active = true, status = "active", validUser = true;
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify(validUser ? { id: "test-user", email: "test@example.test" } : { msg: "invalid" }), { status: validUser ? 200 : 401, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ user_id: "test-user", email: "test@example.test", role, active, status }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const request = new Request("https://source.example.test/api", { headers: { Authorization: "Bearer test-session" } });
    assert.equal((await createDeliveryCommandClient(request, { allowReadOnly: true })).accessUser.role, "viewer");
    await assert.rejects(createDeliveryCommandClient(request));
    role = "hunter_viewer";
    await createDeliveryCommandClient(request, { allowReadOnly: true });
    active = false;
    await assert.rejects(createDeliveryCommandClient(request, { allowReadOnly: true }));
    active = true; status = "blocked";
    await assert.rejects(createDeliveryCommandClient(request, { allowReadOnly: true }));
    status = "active"; validUser = false;
    await assert.rejects(createDeliveryCommandClient(request, { allowReadOnly: true }));
    await assert.rejects(createDeliveryCommandClient(new Request("https://source.example.test/api"), { allowReadOnly: true }));

    const queries: string[] = [];
    const userClient = createClient("https://source.example.test", "public", { global: { fetch: async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      queries.push(url);
      return new Response("[]", { headers: { "Content-Type": "application/json", "Content-Range": "*/1001" } });
    } } });
    await assert.rejects(new RadarCustomerCatalogRepository(userClient).read(2026), /limite/);
    assert.equal(queries.length, 5);
    assert.ok(queries.every((url) => !url.includes("select=*") && url.includes("limit=1000")));
  } finally {
    globalThis.fetch = originalFetch;
    if (envUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = envUrl;
    if (envAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envAnon;
  }
  console.log("Radar catalog: delegacao, expiracao, adulteracao, projecao, deduplicacao, ano, acesso e truncamento aprovados.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
