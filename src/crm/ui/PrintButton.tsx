"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button className="primary" onClick={() => window.print()}><Printer /> Print / Save PDF</button>;
}
