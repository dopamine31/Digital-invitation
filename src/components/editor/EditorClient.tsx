"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical, Eye, EyeOff, Plus, Trash2, Undo2, Redo2, Monitor, Tablet, Smartphone,
  History, Copy, Send, Code2,
} from "lucide-react";
import { SECTION_LIBRARY, sectionDefinition, sectionId } from "@/lib/sections";
import { THEMES, defaultThemeConfig, mergeThemeConfig, themeToJson } from "@/lib/themes";
import { toViewData } from "@/lib/view";
import { sanitizeHtml } from "@/lib/sanitize";
import { InvitationView } from "@/components/invitation/InvitationView";
import { Button, Badge } from "@/components/ui";
import { toast, Modal } from "@/components/client-ui";
import { saveEventDraftAction, createVersionAction, rollbackVersionAction, publishEventAction, duplicateEventAction } from "@/server/actions/events";
import type { EventWorkspace } from "@/server/queries";
import type { EventSettings, SectionConfig, SectionType, ThemeConfig } from "@/lib/types";

interface Snapshot {
  sections: SectionConfig[];
  themeId: string;
  themeConfig: ThemeConfig;
  settings: EventSettings;
  title: string;
}

export function EditorClient({ workspace }: { workspace: EventWorkspace }) {
  const router = useRouter();
  const initial = useMemo<Snapshot>(() => ({
    sections: workspace.sections,
    themeId: workspace.themeId,
    themeConfig: workspace.theme,
    settings: workspace.settings,
    title: workspace.title,
  }), [workspace]);
  const [state, setState] = useState<Snapshot>(initial);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(workspace.sections[0]?.id ?? null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("mobile");
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const lastSaved = useRef(JSON.stringify(initial));

  const commit = useCallback((next: Snapshot | ((current: Snapshot) => Snapshot)) => {
    setState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      setPast((history) => [...history.slice(-29), current]);
      setFuture([]);
      dirty.current = true;
      return value;
    });
  }, []);

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [state, ...items]);
    setState(previous);
    dirty.current = true;
  };
  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, state]);
    setState(next);
    dirty.current = true;
  };

  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(async () => {
      const payload = {
        eventId: workspace.id,
        title: state.title,
        themeId: state.themeId,
        themeConfig: themeToJson(state.themeConfig),
        sections: state.sections,
        settings: state.settings,
      };
      if (JSON.stringify(payload) === lastSaved.current) { setSaving("saved"); return; }
      setSaving("saving");
      const result = await saveEventDraftAction(payload);
      if (result.ok) { lastSaved.current = JSON.stringify(payload); setSaving("saved"); }
      else { setSaving("error"); toast(result.error, "err"); }
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [state, workspace.id]);

  const previewData = useMemo(() => toViewData({
    event: {
      id: workspace.id, slug: workspace.slug, title: state.title,
      startsAt: workspace.startsAt, endsAt: null, timezone: workspace.timezone, themeId: state.themeId,
    },
    guest: null,
    settings: state.settings,
    sections: state.sections,
    theme: mergeThemeConfig(state.themeId, themeToJson(state.themeConfig)),
    schedules: workspace.schedules,
    wishes: [], guestBook: [],
    rsvpForm: workspace.rsvpForm,
    rsvp: null, locale: "id", preview: true,
  }), [state, workspace]);

  const active = state.sections.find((section) => section.id === activeId) ?? null;

  const move = (from: string, to: string) => {
    if (from === to) return;
    commit((current) => {
      const list = [...current.sections];
      const fromIndex = list.findIndex((item) => item.id === from);
      const toIndex = list.findIndex((item) => item.id === to);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [item] = list.splice(fromIndex, 1);
      if (!item) return current;
      list.splice(toIndex, 0, item);
      return { ...current, sections: list };
    });
  };

  const updateSection = (id: string, patch: Partial<SectionConfig>) => commit((current) => ({
    ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section),
  }));

  const addSection = (type: SectionType) => {
    commit((current) => ({ ...current, sections: [...current.sections, { id: sectionId(type), type, visible: true, data: type === "custom" ? { html: "<p>Tulis konten kustom di sini…</p>" } : {} }] }));
    setLibraryOpen(false);
    toast("Section ditambahkan");
  };

  const createVersion = async () => {
    setBusy(true);
    const result = await createVersionAction(workspace.id, "Disimpan dari editor");
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast(`Versi ${result.data.version} tersimpan`);
    router.refresh();
  };

  return (
    <div className="editor-grid">
      <aside className="editor-panel">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <strong className="small">Susunan section</strong>
          <div className="row" style={{ gap: 4 }}>
            <Button size="icon" variant="ghost" onClick={undo} disabled={past.length === 0} aria-label="Undo"><Undo2 size={15} /></Button>
            <Button size="icon" variant="ghost" onClick={redo} disabled={future.length === 0} aria-label="Redo"><Redo2 size={15} /></Button>
          </div>
        </div>
        <div className="tiny muted" style={{ marginBottom: 12 }}>Geser untuk mengubah urutan. Klik untuk mengedit.</div>
        {state.sections.map((section, index) => {
          const definition = sectionDefinition(section.type);
          return (
            <div
              key={section.id}
              className="section-item"
              data-dragging={dragging === section.id}
              data-active={activeId === section.id}
              draggable
              onDragStart={() => setDragging(section.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); if (dragging) move(dragging, section.id); setDragging(null); }}
              onClick={() => setActiveId(section.id)}
            >
              <span className="drag-handle"><GripVertical size={15} /></span>
              <span className="tiny muted" style={{ width: 18 }}>{index + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 550 }}>{definition.labelKey.replace("section.", "").replace("cover.open", "Cover")}</span>
              <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26 }} onClick={(event) => { event.stopPropagation(); updateSection(section.id, { visible: !section.visible }); }} aria-label={section.visible ? "Sembunyikan" : "Tampilkan"}>
                {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26 }} onClick={(event) => { event.stopPropagation(); commit((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== section.id) })); }} aria-label="Hapus section"><Trash2 size={14} /></button>
            </div>
          );
        })}
        <Button size="sm" onClick={() => setLibraryOpen(true)} style={{ width: "100%", marginTop: 8 }}><Plus size={14} /> Tambah section</Button>
        <div className="divider" />
        <div className="stack" style={{ gap: 8 }}>
          <Button size="sm" onClick={createVersion} disabled={busy}><History size={14} /> Simpan versi</Button>
          <Button size="sm" variant="ghost" onClick={() => setVersionsOpen(true)}>Lihat riwayat ({workspace.versions.length})</Button>
          <Button size="sm" variant="primary" onClick={async () => { const result = await publishEventAction(workspace.id); if (result.ok) { toast("Diterbitkan"); router.refresh(); } else toast(result.error, "err"); }}><Send size={14} /> Terbitkan</Button>
        </div>
      </aside>

      <div className="editor-stage">
        <div className="row-between" style={{ width: "100%", maxWidth: 1100 }}>
          <div className="row" style={{ gap: 4 }}>
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([key, Icon]) => (
              <Button key={key} size="sm" variant={device === key ? "primary" : "ghost"} onClick={() => setDevice(key)} aria-label={key}><Icon size={14} /> {key}</Button>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Badge tone={saving === "error" ? "danger" : saving === "saved" ? "success" : "default"}>
              {saving === "saving" ? "Menyimpan…" : saving === "error" ? "Gagal simpan" : saving === "saved" ? "Tersimpan otomatis" : "Siap"}
            </Badge>
            <a href={`/i/${workspace.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm">Buka publik ↗</a>
          </div>
        </div>
        <div className="preview-frame" data-device={device}>
          <InvitationView data={previewData} preview />
        </div>
      </div>

      <aside className="editor-panel editor-panel-right">
        <strong className="small">Inspector</strong>
        <div className="divider" />
        {active ? (
          <div className="stack">
            <div className="tiny muted">{active.type}</div>
            <div className="field"><label className="label">Judul section (opsional)</label><input className="input" value={active.title ?? ""} onChange={(e) => updateSection(active.id, { title: e.target.value })} placeholder="Pakai judul bawaan" /></div>
            <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={active.visible} onChange={(e) => updateSection(active.id, { visible: e.target.checked })} /> Tampilkan section</label>
            {active.type === "custom" ? (
              <div className="field"><label className="label">HTML kustom (disanitasi)</label><textarea className="textarea mono" value={String(active.data.html ?? "")} onChange={(e) => updateSection(active.id, { data: { ...active.data, html: e.target.value } })} /><div className="field-hint">Tag & atribut berbahaya dibuang otomatis.</div><div className="notice small" dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(active.data.html ?? "")) }} /></div>
            ) : null}
            <div className="row" style={{ gap: 6 }}>
              <Button size="sm" onClick={() => commit((current) => ({ ...current, sections: [...current.sections, { ...active, id: sectionId(active.type) }] }))}><Copy size={13} /> Duplikasi</Button>
              <Button size="sm" variant="danger" onClick={() => commit((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== active.id) }))}><Trash2 size={13} /> Hapus</Button>
            </div>
            <div className="divider" />
            <div className="field"><label className="label">Judul undangan</label><input className="input" value={state.title} onChange={(e) => commit((current) => ({ ...current, title: e.target.value }))} /></div>
            <div className="field"><label className="label">Tema dasar</label><select className="select" value={state.themeId} onChange={(e) => commit((current) => ({ ...current, themeId: e.target.value, themeConfig: defaultThemeConfig(e.target.value) }))}>{THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></div>
            <Button size="sm" onClick={async () => { const result = await duplicateEventAction(workspace.id); if (result.ok) { toast("Acara diduplikasi"); router.push(`/app/events/${result.data.id}/editor`); } else toast(result.error, "err"); }}><Copy size={13} /> Duplikasi acara</Button>
          </div>
        ) : <p className="small muted">Pilih section untuk mengedit.</p>}
      </aside>

      {libraryOpen ? (
        <Modal title="Pustaka section" onClose={() => setLibraryOpen(false)} wide>
          <div className="grid grid-3">
            {SECTION_LIBRARY.map((item) => (
              <button key={item.type} className="card card-hover" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => addSection(item.type)}>
                <div className="row" style={{ gap: 8 }}><Code2 size={16} color="var(--ui-primary)" /><strong className="small">{item.labelKey}</strong></div>
                <p className="tiny muted" style={{ marginTop: 8 }}>{item.description}</p>
                {item.repeatable ? <Badge tone="primary">bisa diulang</Badge> : null}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {versionsOpen ? (
        <Modal title="Riwayat versi" onClose={() => setVersionsOpen(false)}>
          <div className="stack">
            {workspace.versions.length === 0 ? <p className="muted small">Belum ada versi.</p> : workspace.versions.map((version) => (
              <div className="row-between card" key={version.version} style={{ padding: 12 }}>
                <div><strong className="small">Versi {version.version}</strong><div className="tiny muted">{version.note || "Tanpa catatan"} · {new Date(version.createdAt).toLocaleString("id-ID")}</div></div>
                <Button size="sm" onClick={async () => { const result = await rollbackVersionAction(workspace.id, version.version); if (result.ok) { toast(`Versi ${version.version} dipulihkan`); router.refresh(); setVersionsOpen(false); } else toast(result.error, "err"); }}>Pulihkan</Button>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
