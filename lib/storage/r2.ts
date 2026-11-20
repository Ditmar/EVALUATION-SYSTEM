import https from "node:https";
import { AwsClient } from "aws4fetch";

/**
 * Cliente mínimo para Cloudflare R2 (API compatible con S3). El bucket es
 * privado: se sube desde el servidor y el panel docente lee con URLs
 * firmadas de corta duración.
 *
 * Variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * Opcional: R2_PUBLIC_URL (dominio del CDN de Cloudflare conectado al bucket,
 * p. ej. https://cdn.midominio.com). Si está definida, `getReadUrl` devuelve
 * URLs del CDN en lugar de URLs firmadas.
 */

interface R2Config {
  client: AwsClient;
  bucketUrl: string;
}

let cached: R2Config | null = null;

function getConfig(): R2Config | null {
  if (cached) return cached;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

  cached = {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    bucketUrl: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
  };
  return cached;
}

export function isR2Configured(): boolean {
  return getConfig() !== null;
}

function objectUrl(config: R2Config, key: string): string {
  return `${config.bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const config = getConfig();
  if (!config) throw new Error("R2 no está configurado.");
  const blob = new Blob([body as Uint8Array<ArrayBuffer>], { type: contentType });

  // Se firma con aws4fetch pero se envía con node:https y Content-Length
  // explícito. Con `client.fetch` (o el fetch que Next.js parchea en las
  // rutas) el cuerpo salía como stream "chunked" sin Content-Length y R2
  // respondía 411 MissingContentLength.
  const signed = await config.client.sign(objectUrl(config, key), {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });

  const headers: Record<string, string> = {};
  signed.headers.forEach((value, name) => {
    headers[name] = value;
  });
  headers["content-length"] = String(body.byteLength);

  const { status, text } = await httpsRequest("PUT", signed.url, headers, body);
  if (status < 200 || status >= 300) {
    throw new Error(`R2 PUT falló (${status}): ${text}`);
  }
}

function httpsRequest(
  method: "PUT" | "DELETE",
  url: string,
  headers: Record<string, string>,
  body?: Uint8Array
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers, timeout: 30_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error(`R2 ${method}: tiempo de espera agotado`)));
    req.on("error", reject);
    req.end(body ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : undefined);
  });
}

/** URL GET firmada, válida `expiresInSeconds` segundos. */
export async function presignGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error("R2 no está configurado.");
  const url = new URL(objectUrl(config, key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signed = await config.client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
  return signed.url;
}

export async function deleteObject(key: string): Promise<void> {
  const config = getConfig();
  if (!config) throw new Error("R2 no está configurado.");
  const signed = await config.client.sign(objectUrl(config, key), { method: "DELETE" });
  const headers: Record<string, string> = {};
  signed.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const { status, text } = await httpsRequest("DELETE", signed.url, headers);
  // 404 = ya no existe: para un borrado eso también es éxito.
  if ((status < 200 || status >= 300) && status !== 404) {
    throw new Error(`R2 DELETE falló (${status}): ${text}`);
  }
}

/**
 * URL para que el navegador lea un objeto: la del CDN (R2_PUBLIC_URL) si está
 * configurado, si no una URL firmada de corta duración contra el bucket privado.
 */
export async function getReadUrl(key: string, expiresInSeconds = 600): Promise<string> {
  const publicBase = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (publicBase) {
    return `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  return presignGetUrl(key, expiresInSeconds);
}
