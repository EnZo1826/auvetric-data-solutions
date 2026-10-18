import { z } from "zod";

export const INTERESTS = [
  "Engineering & Development",
  "Data & Business Intelligence",
  "Automation & Intelligent Systems",
  "Technology Consultancy & Integration",
  "Not sure yet",
] as const;

export const INTENTS = {
  project: "Discuss a Project",
  consultation: "Request a Consultation",
  partnership: "Explore a Partnership",
  general: "General Enquiry",
} as const;
export type Intent = keyof typeof INTENTS;

export const BUDGETS = ["Not specified", "Under N$50 000", "N$50 000 – N$150 000", "N$150 000 – N$500 000", "Over N$500 000"] as const;
export const TIMELINES = ["Not specified", "As soon as possible", "Within 3 months", "3–6 months", "Exploring / no fixed date"] as const;

export const enquirySchema = z.object({
  intent: z.enum(Object.keys(INTENTS) as [Intent, ...Intent[]]),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  organisation: z.string().trim().max(160).optional().default(""),
  email: z.email("Please enter a valid email address.").max(200),
  phone: z.string().trim().max(40).regex(/^[+\d\s()\-]*$/, "Use digits, spaces, + ( ) or - only.").optional().default(""),
  interest: z.enum(INTERESTS, { message: "Please choose an area of interest." }),
  description: z.string().trim().min(20, "Please describe your project in at least 20 characters.").max(5000),
  budget: z.enum(BUDGETS).optional().default("Not specified"),
  timeline: z.enum(TIMELINES).optional().default("Not specified"),
  consent: z.literal("on", { message: "Please confirm you agree to us using these details to respond." }),
});

export type Enquiry = z.infer<typeof enquirySchema>;
