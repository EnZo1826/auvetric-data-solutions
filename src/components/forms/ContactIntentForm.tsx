"use client";

import { useEffect, useState } from "react";
import { ContactForm } from "./ContactForm";
import { INTENTS, INTERESTS, type Intent } from "@/lib/contact-schema";

/**
 * Pre-selects intent/interest from ?intent=&interest= without useSearchParams, so the form is
 * rendered into the static HTML (static export) and then adjusted after hydration.
 */
export function ContactIntentForm({ relayKey }: { relayKey?: string }) {
  const [preset, setPreset] = useState<{ intent: Intent; interest: string; key: string }>({ intent: "project", interest: "", key: "default" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawIntent = params.get("intent") || "project";
    const intent = rawIntent in INTENTS ? (rawIntent as Intent) : "project";
    const rawInterest = params.get("interest") || "";
    const interest = (INTERESTS as readonly string[]).includes(rawInterest) ? rawInterest : "";
    if (intent !== "project" || interest) setPreset({ intent, interest, key: `${intent}|${interest}` });
  }, []);

  return <ContactForm key={preset.key} initialIntent={preset.intent} initialInterest={preset.interest} relayKey={relayKey} />;
}
