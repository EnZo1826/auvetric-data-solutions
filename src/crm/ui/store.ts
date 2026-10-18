"use client";

/** Reference data shared across CRM screens (Zustand). Loaded lazily, refreshed after edits. */
import { create } from "zustand";
import { crmFetch } from "./api";
import type { BoardColumn, Client, Company, Service, UserRow } from "@/crm/shared/types";

export type ClientRow = Client & { doc_count: number; outstanding_nad: number; open_projects: number; primary_contact: { name: string; email: string } | null };
type Key = "company" | "clients" | "services" | "users" | "columns";
export interface Toast { id: number; text: string; kind: "ok" | "err" }

interface State {
  me: { id: string; name: string; email: string; role: "admin" | "member" | "readonly" } | null;
  company: Company | null;
  clients: ClientRow[];
  services: Service[];
  users: UserRow[];
  columns: BoardColumn[];
  loaded: Partial<Record<Key, boolean>>;
  toasts: Toast[];
  setMe: (me: State["me"]) => void;
  ensure: (keys: Key[]) => Promise<void>;
  reload: (key: Key) => Promise<void>;
  toast: (text: string, kind?: "ok" | "err") => void;
}

let toastSeq = 1;
const loaders: Record<Key, () => Promise<Partial<State>>> = {
  company: async () => ({ company: await crmFetch<Company>("/api/crm/company") }),
  clients: async () => ({ clients: await crmFetch<ClientRow[]>("/api/crm/clients") }),
  services: async () => ({ services: await crmFetch<Service[]>("/api/crm/services") }),
  users: async () => ({ users: await crmFetch<UserRow[]>("/api/crm/users") }),
  columns: async () => ({ columns: await crmFetch<BoardColumn[]>("/api/crm/settings/project_columns") }),
};
const inflight = new Map<Key, Promise<void>>();

export const useCrm = create<State>((set, get) => ({
  me: null,
  company: null,
  clients: [],
  services: [],
  users: [],
  columns: [],
  loaded: {},
  toasts: [],
  setMe: (me) => set({ me }),
  ensure: async (keys) => {
    await Promise.all(keys.filter((k) => !get().loaded[k]).map((k) => get().reload(k)));
  },
  reload: (key) => {
    const running = inflight.get(key);
    if (running) return running;
    const p = loaders[key]()
      .then((patch) => set({ ...patch, loaded: { ...get().loaded, [key]: true } }))
      .catch((e: Error & { status?: number }) => {
        if (e.status === 401) window.location.assign("/crm/login");
        else get().toast(e.message, "err");
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  },
  toast: (text, kind = "ok") => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === "err" ? 7000 : 3500);
  },
}));

export const canWrite = (role?: string) => role === "admin" || role === "member";
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
