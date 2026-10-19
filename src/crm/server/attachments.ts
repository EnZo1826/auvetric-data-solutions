/** File attachments on clients, projects, documents, leads, expenses and enquiries. Bytes live in the file store. */
import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
import { fileStore } from "./files";
import { HttpError } from "./http";

export const ATTACH_ENTITIES = ["client", "project", "document", "lead", "expense", "enquiry"] as const;
export type AttachEntity = (typeof ATTACH_ENTITIES)[number];
const TABLE: Record<AttachEntity, string> = { client: "clients", project: "projects", document: "documents", lead: "leads", expense: "expenses", enquiry: "enquiries" };

/** Netlify's synchronous function request limit is 6 MB including encoding overhead. */
export const MAX_UPLOAD = 4 * 1024 * 1024;

/** Allowed extensions → the content type we store and serve (the browser-supplied type is ignored). */
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", heic: "image/heic",
  txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8", md: "text/markdown; charset=utf-8", json: "application/json", xml: "application/xml",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet",
  zip: "application/zip", dwg: "application/acad", dxf: "application/dxf", kml: "application/vnd.google-earth.kml+xml", kmz: "application/vnd.google-earth.kmz",
  eml: "message/rfc822", msg: "application/vnd.ms-outlook",
};
const INLINE = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  pdf: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8, jpeg: (b) => b[0] === 0xff && b[1] === 0xd8,
  gif: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  webp: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

export const extOf = (name: string) => (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "").toLowerCase();
export const canInline = (name: string) => INLINE.has(extOf(name));

export async function assertEntity(entity: string, entityId: string) {
  if (!(ATTACH_ENTITIES as readonly string[]).includes(entity)) throw new HttpError(400, "Files can't be attached to that record.");
  const [r] = await db()`select 1 from ${db()(TABLE[entity as AttachEntity])} where id = ${entityId}`;
  if (!r) throw new HttpError(404, "Record not found.");
}

export async function storeAttachment(entity: AttachEntity, entityId: string, file: File, userId: string) {
  const name = file.name.replace(/[\u0000-\u001f\\/]/g, "_").trim().slice(0, 200);
  const ext = extOf(name);
  const type = FILE_TYPES[ext];
  if (!name || !type) throw new HttpError(415, `That file type isn't allowed. Allowed: ${Object.keys(FILE_TYPES).join(", ")}.`);
  if (file.size === 0) throw new HttpError(400, "The file is empty.");
  if (file.size > MAX_UPLOAD) throw new HttpError(413, "Files can be at most 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (MAGIC[ext] && !MAGIC[ext](bytes)) throw new HttpError(415, `The file's contents don't match “.${ext}”.`);
  const key = `att/${entity}/${entityId}/${randomUUID()}`;
  await fileStore("crm-files").put(key, bytes, type);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const [row] = await db()`insert into attachments (entity, entity_id, name, content_type, size, sha256, blob_key, uploaded_by)
    values (${entity}, ${entityId}, ${name}, ${type}, ${bytes.byteLength}, ${sha}, ${key}, ${userId}) returning id, entity, entity_id, name, content_type, size, created_at`;
  return row;
}

export async function loadAttachment(attId: string) {
  const [a] = await db()`select * from attachments where id = ${attId}`;
  if (!a) throw new HttpError(404, "File not found.");
  const data = await fileStore("crm-files").get(a.blob_key);
  if (!data) throw new HttpError(410, "The file is missing from storage.");
  return { meta: a, data };
}

/** Removes the rows and their bytes for deleted parent records. Storage errors are logged, not thrown. */
export async function purgeAttachments(entity: AttachEntity, ids: string[]) {
  if (!ids.length) return;
  const rows = await db()`delete from attachments where entity = ${entity} and entity_id in ${db()(ids)} returning blob_key`;
  if (!rows.length) return;
  const store = fileStore("crm-files");
  for (const r of rows) await store.del(r.blob_key).catch((e) => console.error("[crm] attachment purge", r.blob_key, e));
}
