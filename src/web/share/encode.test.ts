import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_URL_LENGTH,
  buildShareUrl,
  decodeShare,
  encodeShare,
  isShareUrlTooLong,
  shareDataFromHash,
} from "./encode";
import type { SharedWireframe } from "./schema";

const data: SharedWireframe = {
  v: 1,
  name: "Log in",
  wireframe: 'Page "Log in" id=login\n  Text "Ünïcödé ✓ 日本語 😀"\n  Box @User.Name\n',
  macros: 'Def Field $label\n  Text "$label"\n',
  dataDictionary: [{ entity: "User", field: "Name", dataType: "string", label: "Full name", mockValues: "Ann;Bob" }],
};

const base64Url = (bytes: number[]) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const compress = async (text: string) => {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return base64Url([...new Uint8Array(await new Response(stream).arrayBuffer())]);
};

describe("encodeShare and decodeShare", () => {
  it("gives back the same data, including non-ASCII text and multi-line sources", async () => {
    expect(await decodeShare(await encodeShare(data))).toEqual(data);
  });

  it("round-trips empty macros and an empty data dictionary", async () => {
    const empty: SharedWireframe = { ...data, macros: "", dataDictionary: [] };
    expect(await decodeShare(await encodeShare(empty))).toEqual(empty);
  });

  it("writes base64url only", async () => {
    expect(await encodeShare(data)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns undefined for an empty string", async () => {
    expect(await decodeShare("")).toBeUndefined();
  });

  it("returns undefined for text that is not base64url", async () => {
    expect(await decodeShare("not base64url!")).toBeUndefined();
    expect(await decodeShare("abc+def/ghi=")).toBeUndefined();
    expect(await decodeShare("a")).toBeUndefined();
  });

  it("returns undefined for valid base64url that is not compressed data", async () => {
    expect(await decodeShare(base64Url([7, 7, 7, 7, 7, 7, 7, 7]))).toBeUndefined();
  });

  it("returns undefined for compressed data that is not JSON", async () => {
    expect(await decodeShare(await compress("this is not json"))).toBeUndefined();
  });

  it("returns undefined for JSON that does not match the schema", async () => {
    expect(await decodeShare(await compress(JSON.stringify({ ...data, v: 2 })))).toBeUndefined();
    expect(await decodeShare(await compress(JSON.stringify({ ...data, extra: true })))).toBeUndefined();
    expect(await decodeShare(await compress(JSON.stringify({ v: 1, name: "x" })))).toBeUndefined();
    expect(await decodeShare(await compress("[]"))).toBeUndefined();
  });

  it("returns undefined for a link that was cut off", async () => {
    const text = await encodeShare(data);
    expect(await decodeShare(text.slice(0, Math.floor(text.length / 2)))).toBeUndefined();
  });
});

describe("buildShareUrl", () => {
  it("is <origin>/share#d=<data>", async () => {
    const url = await buildShareUrl("https://example.com", data);
    expect(url).toBe(`https://example.com/share#d=${await encodeShare(data)}`);
    expect(await decodeShare(shareDataFromHash(new URL(url).hash))).toEqual(data);
  });
});

describe("isShareUrlTooLong", () => {
  it("is false for a link at or below the limit and true above it", () => {
    expect(MAX_SHARE_URL_LENGTH).toBe(30_000);
    expect(isShareUrlTooLong("x".repeat(MAX_SHARE_URL_LENGTH - 1))).toBe(false);
    expect(isShareUrlTooLong("x".repeat(MAX_SHARE_URL_LENGTH))).toBe(false);
    expect(isShareUrlTooLong("x".repeat(MAX_SHARE_URL_LENGTH + 1))).toBe(true);
  });

  it("is true for a real link of a big wire frame", async () => {
    let seed = 12345;
    const random = Array.from({ length: 40_000 }, () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return String.fromCharCode(33 + (seed >>> 16) % 90);
    });
    const big = { ...data, wireframe: random.join("") };
    expect(isShareUrlTooLong(await buildShareUrl("https://example.com", big))).toBe(true);
    expect(isShareUrlTooLong(await buildShareUrl("https://example.com", data))).toBe(false);
  });
});

describe("shareDataFromHash", () => {
  it("reads the data after #d= and gives an empty string for anything else", () => {
    expect(shareDataFromHash("#d=abc_-")).toBe("abc_-");
    expect(shareDataFromHash("")).toBe("");
    expect(shareDataFromHash("#")).toBe("");
    expect(shareDataFromHash("#x=abc")).toBe("");
  });
});
