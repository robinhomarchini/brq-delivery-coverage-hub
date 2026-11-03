import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const PURPOSE = "radar-customer-catalog-v1";
const payloadSchema = z.object({
  purpose: z.literal(PURPOSE),
  accessToken: z.string().min(20).max(16000),
  expiresAt: z.number().int().positive(),
});

function key() {
  const value = process.env.RADAR_CATALOG_DELEGATION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("Conexao com Radar nao configurada.");
  return Buffer.from(value, "hex");
}

/** Called only after validating the source session; its JWT never leaves this server. */
export function issueCatalogDelegation(accessToken: string, now = Date.now()) {
  const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
  const expiresAt = Math.min(now + 60 * 60 * 1000, Number(claims.exp) * 1000);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) throw new Error("Sessao expirada.");
  const payload = payloadSchema.parse({ purpose: PURPOSE, accessToken, expiresAt });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(PURPOSE));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return {
    token: ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join("."),
    expiresAt,
  };
}

export function readCatalogDelegation(token: string, now = Date.now()) {
  try {
    if (token.length > 24000) throw new Error();
    const [version, iv, tag, ciphertext, extra] = token.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(PURPOSE));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const text = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);
    const payload = payloadSchema.parse(JSON.parse(text.toString("utf8")));
    if (payload.expiresAt <= now || payload.expiresAt > now + 60 * 60 * 1000) throw new Error();
    return payload;
  } catch {
    throw new Error("Conexao com OrgBRQDelivery invalida ou expirada. Conecte novamente.");
  }
}
