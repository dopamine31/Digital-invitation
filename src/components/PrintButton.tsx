"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}><Printer size={14} /> Cetak invoice</button>;
}
