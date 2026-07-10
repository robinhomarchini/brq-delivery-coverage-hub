/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const storePath = path.join(root, "src", "store", "delivery-store.tsx");
const providerPath = path.join(root, "src", "lib", "repositories", "provider.ts");
const accessRepositoryPath = path.join(root, "src", "lib", "repositories", "accessRepository.ts");
const indexPath = path.join(root, "src", "lib", "repositories", "index.ts");

const storeSource = fs.readFileSync(storePath, "utf8");
const providerSource = fs.readFileSync(providerPath, "utf8");
const accessRepositorySource = fs.readFileSync(accessRepositoryPath, "utf8");
const indexSource = fs.readFileSync(indexPath, "utf8");

const forbiddenStoreCouplings = [
  "createSupabaseDeliveryRepository",
  "localDeliveryRepository",
  "isSupabaseConfigured",
  "unavailableProductionRepository",
];

const leakedCouplings = forbiddenStoreCouplings.filter((token) => storeSource.includes(token));
if (leakedCouplings.length) {
  throw new Error(`Delivery store still selects persistence providers directly: ${leakedCouplings.join(", ")}`);
}

const requiredProviderTokens = [
  "export type PersistenceProvider",
  "\"supabase\"",
  "\"local-dev\"",
  "\"unavailable\"",
  "createDeliveryRepositorySelection",
  "resolvePersistenceProvider",
  "useEmptyInitialData",
];

const missingProviderTokens = requiredProviderTokens.filter((token) => !providerSource.includes(token));
if (missingProviderTokens.length) {
  throw new Error(`Persistence provider factory is missing expected tokens: ${missingProviderTokens.join(", ")}`);
}

if (!indexSource.includes("createDeliveryRepositorySelection") || !indexSource.includes("PersistenceProvider")) {
  throw new Error("Repository index does not expose the provider abstraction.");
}

const requiredAccessRepositoryTokens = [
  "export interface AccessRepository",
  "export type AccessRepositoryProvider",
  "\"supabase\"",
  "\"unavailable\"",
  "createAccessRepositorySelection",
  "createSupabaseAccessRepository",
];

const missingAccessRepositoryTokens = requiredAccessRepositoryTokens.filter((token) => !accessRepositorySource.includes(token));
if (missingAccessRepositoryTokens.length) {
  throw new Error(`Access repository abstraction is missing expected tokens: ${missingAccessRepositoryTokens.join(", ")}`);
}

if (!indexSource.includes("createAccessRepositorySelection") || !indexSource.includes("AccessRepositoryProvider")) {
  throw new Error("Repository index does not expose the access repository abstraction.");
}

console.log("Provider abstraction QA checks passed.");
