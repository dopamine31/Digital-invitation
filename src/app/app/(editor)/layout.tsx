import type { ReactNode } from "react";
import { requireCustomer } from "@/lib/auth";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  await requireCustomer();
  return <>{children}</>;
}
