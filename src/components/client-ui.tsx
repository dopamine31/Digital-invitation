"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun, Copy, Check, X, Menu } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui";

type ToastKind = "ok" | "err";
type ToastMessage = { id: number; text: string; kind: ToastKind };
const TOAST_EVENT = "rasa:toast";

export function toast(text: string, kind: ToastKind = "ok"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Omit<ToastMessage, "id">>(TOAST_EVENT, { detail: { text, kind } }));
}

export function Toaster() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, "id">>).detail;
      const id = Date.now() + Math.random();
      setMessages((current) => [...current, { ...detail, id }]);
      window.setTimeout(() => setMessages((current) => current.filter((item) => item.id !== id)), 4200);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);
  return (
    <div aria-live="polite" aria-atomic="false">
      {messages.map((message) => (
        <div key={message.id} className={clsx("toast", message.kind === "ok" ? "toast-ok" : "toast-err")} role="status">
          {message.text}
        </div>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDark(document.documentElement.getAttribute("data-theme") === "dark"));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("rasa-theme", next ? "dark" : "light");
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Aktifkan mode terang" : "Aktifkan mode gelap"} title="Mode gelap">
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </Button>
  );
}

export function CopyButton({ value, label = "Salin", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast("Tersalin ke clipboard");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Gagal menyalin", "err");
    }
  }, [value]);
  return (
    <Button size="sm" onClick={copy} className={className} aria-label={`${label}: ${value}`}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Tersalin" : label}
    </Button>
  );
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" style={wide ? { maxWidth: 860 } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between" style={{ marginBottom: 18 }}>
          <h3>{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={17} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" size="icon" onClick={onClick} aria-label="Buka menu" className="no-print"><Menu size={19} /></Button>;
}

export function ActionButton({
  action, label, variant = "primary", confirm, onDone, disabled, icon,
}: {
  action: () => Promise<{ ok: boolean; error?: string; code?: string; data?: unknown }>;
  label: string;
  variant?: "primary" | "default" | "ghost" | "danger";
  confirm?: string;
  onDone?: (result: { ok: boolean; error?: string; code?: string; data?: unknown }) => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      const result = await action();
      if (result.ok) toast("Berhasil");
      else toast(result.error ?? "Gagal", "err");
      onDone?.(result);
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "Gagal", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={variant} onClick={run} disabled={busy || disabled}>
      {busy ? <span className="spinner" /> : icon} {label}
    </Button>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} className="tab" data-active={active === tab.id} role="tab" aria-selected={active === tab.id} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
