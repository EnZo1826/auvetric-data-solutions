"use client";

import { useSearchParams } from "next/navigation";
import { ContactForm } from "./ContactForm";
import { INTENTS, INTERESTS, type Intent } from "@/lib/contact-schema";

export function ContactIntentForm() {
  const params = useSearchParams();
  const rawIntent = params.get("intent") || "project";
  const intent = rawIntent in INTENTS ? rawIntent as Intent : "project";
  const rawInterest = params.get("interest") || "";
  const interest = (INTERESTS as readonly string[]).includes(rawInterest) ? rawInterest : "";
  return <ContactForm initialIntent={intent} initialInterest={interest} />;
}
