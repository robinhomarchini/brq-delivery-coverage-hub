import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const retentionPerSourceYear = parsePositiveInteger(process.env.BASELINE_SNAPSHOT_RETENTION, 2);
const applyCleanup = process.env.CONFIRM_BASELINE_SNAPSHOT_CLEANUP === "delete-old-snapshots";

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cleanup was not executed.");
  process.exit(1);
}

if (retentionPerSourceYear < 1) {
  console.error("BASELINE_SNAPSHOT_RETENTION must be at least 1.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await supabase
  .from("studio_baseline_snapshots")
  .select("id, baseline_year, source_code, source_name, file_name, created_at")
  .order("baseline_year", { ascending: false })
  .order("source_code", { ascending: true })
  .order("created_at", { ascending: false });

if (error) {
  console.error(`Failed to read studio_baseline_snapshots: ${error.message}`);
  process.exit(1);
}

const snapshots = data ?? [];
const groups = groupSnapshots(snapshots);
const staleSnapshots = Array.from(groups.values()).flatMap((items) => items.slice(retentionPerSourceYear));
const staleIds = staleSnapshots.map((snapshot) => snapshot.id);

console.log(`Studio baseline snapshot cleanup ${applyCleanup ? "APPLY" : "DRY-RUN"}`);
console.log(`Retention: keeping ${retentionPerSourceYear} snapshot(s) per baseline_year + source_code.`);
console.log(`Found ${snapshots.length} snapshot(s), ${groups.size} group(s), ${staleSnapshots.length} stale snapshot(s).`);

for (const [key, items] of groups.entries()) {
  const [year, sourceCode] = key.split("|");
  const sourceName = items[0]?.source_name ?? sourceCode;
  const staleCount = Math.max(items.length - retentionPerSourceYear, 0);
  console.log(`- ${year} / ${sourceName} (${sourceCode}): total ${items.length}, stale ${staleCount}`);
}

if (!staleSnapshots.length) {
  console.log("Nothing to delete.");
  process.exit(0);
}

console.log("Stale snapshots:");
for (const snapshot of staleSnapshots) {
  console.log(`- ${snapshot.created_at} | ${snapshot.baseline_year} | ${snapshot.source_code} | ${snapshot.file_name} | ${snapshot.id}`);
}

if (!applyCleanup) {
  console.log("Dry-run only. Set CONFIRM_BASELINE_SNAPSHOT_CLEANUP=delete-old-snapshots to delete stale snapshots.");
  process.exit(0);
}

const { error: deleteError } = await supabase
  .from("studio_baseline_snapshots")
  .delete()
  .in("id", staleIds);

if (deleteError) {
  console.error(`Failed to delete stale snapshots: ${deleteError.message}`);
  process.exit(1);
}

console.log(`Deleted ${staleIds.length} stale studio baseline snapshot(s).`);

function groupSnapshots(items) {
  const groupsBySourceYear = new Map();
  for (const item of items) {
    const key = `${item.baseline_year}|${item.source_code ?? "studio_general"}`;
    const group = groupsBySourceYear.get(key) ?? [];
    group.push(item);
    groupsBySourceYear.set(key, group);
  }
  return groupsBySourceYear;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
