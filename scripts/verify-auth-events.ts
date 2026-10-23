import assert from "node:assert/strict";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createClient, type AuthChangeEvent, type Session } from "@supabase/supabase-js";
import { createSupabaseAuthService } from "../src/lib/auth/auth-service";

async function main() {
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let emit: (event: AuthChangeEvent, session: Session | null) => void = () => {
    throw new Error("Missing auth subscription");
  };
  let unsubscribed = false;
  mock.method(client.auth, "onAuthStateChange", (callback: typeof emit) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
  });
  let authLockHeld = false;
  const events: string[] = [];
  const unsubscribe = createSupabaseAuthService(client).onAuthStateChange((event, user) => {
    assert.equal(authLockHeld, false, "Subscribers must run after the auth lock is released");
    assert.equal(user, null);
    events.push(event);
  });
  authLockHeld = true;
  emit("INITIAL_SESSION", null);
  emit("SIGNED_OUT", null);
  assert.deepEqual(events, [], "Do not invoke subscribers inside the Supabase callback");
  authLockHeld = false;
  await delay(20);
  assert.deepEqual(events, ["INITIAL_SESSION", "SIGNED_OUT"], "Preserve event order");
  emit("SIGNED_IN", null);
  unsubscribe();
  await delay(20);
  assert.equal(unsubscribed, true);
  assert.deepEqual(events, ["INITIAL_SESSION", "SIGNED_OUT"], "Discard pending events after unmount");
  mock.restoreAll();
  console.log("Auth event regression checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
