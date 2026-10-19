/**
 * Binary storage for attachments and backups.
 * Production: Netlify Blobs (strong consistency), available automatically inside Netlify functions.
 * Local dev / CI: a folder, ONLY when CRM_FILE_DIR is set explicitly (never set it on Netlify: function disks are temporary).
 */
import { getStore } from "@netlify/blobs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http";

export type StoreName = "crm-files" | "crm-backups";
export interface FileStore {
  kind: "netlify-blobs" | "folder";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  del(key: string): Promise<void>;
}

const KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/;
function checkKey(key: string) {
  if (!KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error(`Invalid storage key: ${key}`);
}

function folderStore(root: string): FileStore {
  const full = (key: string) => { checkKey(key); return path.join(root, ...key.split("/")); };
  return {
    kind: "folder",
    async put(key, data) { const f = full(key); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, data); },
    async get(key) { try { return new Uint8Array(await readFile(full(key))); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; } },
    async del(key) { await rm(full(key), { force: true }); },
  };
}

export function fileStore(name: StoreName): FileStore {
  const dir = process.env.CRM_FILE_DIR;
  if (dir) return folderStore(path.resolve(dir, name));
  let s: ReturnType<typeof getStore>;
  try {
    s = getStore({ name, consistency: "strong" });
  } catch {
    throw new HttpError(503, "File storage is not available here. On Netlify it uses Netlify Blobs; locally set CRM_FILE_DIR.");
  }
  return {
    kind: "netlify-blobs",
    async put(key, data, contentType) { checkKey(key); await s.set(key, new Blob([data as BlobPart], { type: contentType })); },
    async get(key) { checkKey(key); const b = await s.get(key, { type: "arrayBuffer" }); return b ? new Uint8Array(b) : null; },
    async del(key) { checkKey(key); await s.delete(key); },
  };
}

export function storageKind(): FileStore["kind"] | "unavailable" {
  try { return fileStore("crm-files").kind; } catch { return "unavailable"; }
}

/** A binary download response that browsers never render as a page from our origin. */
export function fileResponse(data: Uint8Array, name: string, contentType: string, inline = false) {
  const safe = name.replace(/[^\w.\- ()]/g, "_").slice(0, 150) || "file";
  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      "Cache-Control": "private, no-store",
    },
  });
}
