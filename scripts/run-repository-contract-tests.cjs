/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const Module = require("node:module");

require("sucrase/register");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { runLocalDeliveryRepositoryContractTests } = require("../src/lib/repositories/contract-tests/localDeliveryRepository.contract.ts");

runLocalDeliveryRepositoryContractTests()
  .then(() => {
    console.log("DeliveryRepository contract tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
