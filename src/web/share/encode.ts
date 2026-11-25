import { SharedWireframeSchema, type SharedWireframe } from "./schema";

export const SHARE_PATH = "/share";
export const MAX_SHARE_URL_LENGTH = 30_000;

const HASH_PREFIX = "#d=";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | undefined {
  if (!BASE64URL_PATTERN.test(text)) return undefined;
  try {
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
}

export async function encodeShare(data: SharedWireframe): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(data));
  return toBase64Url(await transform(json, new CompressionStream("deflate-raw")));
}

/** The data of a link, or `undefined` for anything that is not a valid link payload. */
export async function decodeShare(text: string): Promise<SharedWireframe | undefined> {
  const compressed = fromBase64Url(text);
  if (compressed === undefined) return undefined;
  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(
      await transform(compressed, new DecompressionStream("deflate-raw")),
    );
    const parsed = SharedWireframeSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function buildShareUrl(origin: string, data: SharedWireframe): Promise<string> {
  return `${origin}${SHARE_PATH}${HASH_PREFIX}${await encodeShare(data)}`;
}

export function isShareUrlTooLong(url: string): boolean {
  return url.length > MAX_SHARE_URL_LENGTH;
}

/** The encoded data of a `location.hash` (`#d=<data>`), or `""` when there is none. */
export function shareDataFromHash(hash: string): string {
  return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : "";
}
