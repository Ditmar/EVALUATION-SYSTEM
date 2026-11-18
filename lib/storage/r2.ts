import { AwsClient } from "aws4fetch";

/**
 * Cliente mínimo para Cloudflare R2 (API compatible con S3). El bucket es
 * privado: se sube desde el servidor y el panel docente lee con URLs
 * firmadas de corta duración.
 *
 * Variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
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
  const res = await config.client.fetch(objectUrl(config, key), {
    method: "PUT",
    body: new Blob([body as Uint8Array<ArrayBuffer>], { type: contentType }),
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`R2 PUT falló (${res.status}): ${await res.text().catch(() => "")}`);
  }
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
