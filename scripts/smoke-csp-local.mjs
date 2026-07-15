const baseUrl = (process.env.CSP_SMOKE_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");

const response = await fetch(`${baseUrl}/`);
const html = await response.text();
const csp = response.headers.get("content-security-policy") ?? "";
const nonce = csp.match(/'nonce-([^']+)'/)?.[1] ?? "";

assert(response.ok, `Expected / to return 2xx, got ${response.status}.`);
assert(csp, "Missing Content-Security-Policy header.");
assert(nonce, "CSP script-src must include a nonce.");
assert(!csp.includes("script-src 'self' 'unsafe-inline'"), "script-src must not allow unsafe-inline.");
assert(csp.includes("'strict-dynamic'"), "script-src must include strict-dynamic.");
assert(html.includes(`nonce="${nonce}"`), "Rendered HTML must include a script/style nonce matching CSP.");
assert(!html.toLowerCase().includes("application error"), "Rendered HTML should not expose a Next.js application error.");

const routeChecks = ["/clientes", "/relatorio-metas", "/metas-pessoas"];
for (const route of routeChecks) {
  const routeResponse = await fetch(`${baseUrl}${route}`);
  const routeCsp = routeResponse.headers.get("content-security-policy") ?? "";
  assert(routeResponse.ok, `Expected ${route} to return 2xx, got ${routeResponse.status}.`);
  assert(routeCsp.includes("'nonce-"), `Expected ${route} to include CSP nonce.`);
}

console.log("Local CSP smoke checks passed.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
