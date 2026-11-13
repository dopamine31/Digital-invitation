"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { Tabs, toast } from "@/components/client-ui";
import { saveRsvpFormAction } from "@/server/actions/rsvp";
import type { EventWorkspace } from "@/server/queries";
import type { Locale, RsvpField, RsvpFieldType, RsvpFormConfig } from "@/lib/types";

const FIELD_TYPES: RsvpFieldType[] = ["text", "textarea", "phone", "email", "number", "date", "select", "radio", "multiselect", "checkbox", "file", "address"];

export function RsvpFormBuilder({ workspace }: { workspace: EventWorkspace }) {
  const router = useRouter();
  const [form, setForm] = useState<RsvpFormConfig>(workspace.rsvpForm);
  const [tab, setTab] = useState("fields");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateField = (id: string, patch: Partial<RsvpField>) => setForm((current) => ({ ...current, fields: current.fields.map((field) => field.id === id ? { ...field, ...patch } : field) }));
  const addField = () => {
    const id = `field-${Date.now().toString(36)}`;
    setForm((current) => ({ ...current, fields: [...current.fields, { id, type: "text", label: { id: "Pertanyaan baru", en: "New question" }, required: false }] }));
  };
  const save = async () => {
    setBusy(true); setError("");
    const result = await saveRsvpFormAction({ ...form, eventId: workspace.id });
    setBusy(false);
    if (!result.ok) { setError(result.error); toast(result.error, "err"); return; }
    toast("Form RSVP tersimpan"); router.refresh();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Form builder RSVP</h1><p className="page-subtitle">≤3 langkah untuk tamu, conditional logic, kuota pax, sesi, makanan, deadline & multi-bahasa.</p></div>
        <Button variant="primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <Save size={15} />} Simpan form</Button>
      </div>
      {error ? <div className="notice notice-error">{error}</div> : null}
      <div className="card">
        <Tabs tabs={[{ id: "fields", label: "Pertanyaan" }, { id: "settings", label: "Pengaturan" }, { id: "locales", label: "Bahasa & Ucapan" }]} active={tab} onChange={setTab} />
        <div style={{ marginTop: 20 }}>
          {tab === "fields" ? (
            <div className="stack">
              {form.fields.map((field, index) => (
                <div className="card" key={field.id} style={{ padding: 14 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <GripVertical size={15} className="muted" />
                    <Badge tone="primary">{index + 1}</Badge>
                    <input className="input" style={{ flex: 1 }} value={field.label.id} onChange={(e) => updateField(field.id, { label: { ...field.label, id: e.target.value } })} aria-label={`Label ID ${index + 1}`} />
                    <input className="input" style={{ flex: 1 }} value={field.label.en} onChange={(e) => updateField(field.id, { label: { ...field.label, en: e.target.value } })} aria-label={`Label EN ${index + 1}`} />
                    <select className="select" style={{ width: 145 }} value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as RsvpFieldType })}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
                    <label className="row tiny" style={{ gap: 5 }}><input type="checkbox" className="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} /> wajib</label>
                    <Button size="icon" variant="danger" onClick={() => setForm((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== field.id) }))} aria-label="Hapus pertanyaan"><Trash2 size={14} /></Button>
                  </div>
                  <div className="grid grid-2" style={{ marginTop: 10 }}>
                    {["select", "radio", "multiselect"].includes(field.type) ? (
                      <div className="field"><label className="label">Opsi (pisahkan dengan koma, format value|label)</label><input className="input" value={(field.options ?? []).map((option) => `${option.value}|${option.label.id}`).join(", ")} onChange={(e) => updateField(field.id, { options: e.target.value.split(",").map((part) => { const [value, label] = part.split("|"); return { value: (value ?? "").trim(), label: { id: (label ?? value ?? "").trim(), en: (label ?? value ?? "").trim() } }; }).filter((option) => option.value) })} /></div>
                    ) : <div className="field"><label className="label">Placeholder / bantuan</label><input className="input" value={field.helpText ?? ""} onChange={(e) => updateField(field.id, { helpText: e.target.value })} placeholder="Teks bantuan" /></div>}
                    <div className="field"><label className="label">Conditional logic — tampil jika</label>
                      <div className="row">
                        <select className="select" value={field.showIf?.fieldId ?? ""} onChange={(e) => updateField(field.id, { showIf: e.target.value ? { fieldId: e.target.value, operator: "equals", value: "" } : undefined })}><option value="">Selalu tampil</option>{form.fields.filter((item) => item.id !== field.id).map((item) => <option key={item.id} value={item.id}>{item.label.id}</option>)}</select>
                        {field.showIf ? <select className="select" value={field.showIf.operator} onChange={(e) => { const current = field.showIf; if (!current) return; updateField(field.id, { showIf: { ...current, operator: e.target.value as "equals" | "notEquals" | "contains" | "in" } }); }}><option value="equals">=</option><option value="notEquals">≠</option><option value="contains">mengandung</option><option value="in">termasuk</option></select> : null}
                        {field.showIf ? <input className="input" value={String(field.showIf.value)} onChange={(e) => { const current = field.showIf; if (!current) return; updateField(field.id, { showIf: { ...current, value: e.target.value } }); }} placeholder="nilai" /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={addField}><Plus size={15} /> Tambah pertanyaan</Button>
            </div>
          ) : null}

          {tab === "settings" ? (
            <div className="stack">
              <div className="grid grid-3">
                <div className="field"><label className="label">Kuota pax per tamu</label><input className="input" type="number" min={1} max={20} value={form.paxQuotaPerGuest} onChange={(e) => setForm({ ...form, paxQuotaPerGuest: Number(e.target.value) })} /></div>
                <div className="field"><label className="label">Maksimum pax global</label><input className="input" type="number" min={1} max={20} value={form.settings.maxPax} onChange={(e) => setForm({ ...form, settings: { ...form.settings, maxPax: Number(e.target.value) } })} /></div>
                <div className="field"><label className="label">Deadline RSVP</label><input className="input" type="datetime-local" value={form.deadlineAt ? form.deadlineAt.slice(0, 16) : ""} onChange={(e) => setForm({ ...form, deadlineAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <div className="grid grid-2">
                {([["allowMaybe", "Izinkan jawaban 'Mungkin'"], ["allowSessionChoice", "Pilih sesi kedatangan"], ["requirePhone", "Wajib nomor telepon"], ["autoCloseAtDeadline", "Tutup otomatis saat deadline"]] as const).map(([key, label]) => (
                  <label key={key} className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={key === "allowMaybe" || key === "allowSessionChoice" ? form.settings[key] : key === "requirePhone" ? form.settings.requirePhone : form.settings.autoCloseAtDeadline} onChange={(e) => setForm({ ...form, settings: { ...form.settings, [key]: e.target.checked } })} /> {label}</label>
                ))}
                <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={form.isClosed} onChange={(e) => setForm({ ...form, isClosed: e.target.checked })} /> Tutup form secara manual</label>
              </div>
              <div className="grid grid-2">
                <div className="field"><label className="label">Sesi (satu per baris: id|label|jam)</label><textarea className="textarea mono" value={form.settings.sessions.map((item) => `${item.id}|${item.label}|${item.time}`).join("\n")} onChange={(e) => setForm({ ...form, settings: { ...form.settings, sessions: e.target.value.split("\n").filter(Boolean).map((line) => { const [id, label, time] = line.split("|"); return { id: id ?? "", label: label ?? "", time: time ?? "" }; }) } })} /></div>
                <div className="field"><label className="label">Pilihan menu (satu per baris)</label><textarea className="textarea" value={form.settings.mealChoices.join("\n")} onChange={(e) => setForm({ ...form, settings: { ...form.settings, mealChoices: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) } })} /></div>
              </div>
            </div>
          ) : null}

          {tab === "locales" ? (
            <div className="stack">
              <div className="field"><label className="label">Ucapan terima kasih</label><textarea className="textarea" value={form.thankYouMessage} onChange={(e) => setForm({ ...form, thankYouMessage: e.target.value })} /></div>
              <div className="grid grid-2">
                <div className="field"><label className="label">Redirect setelah RSVP (opsional)</label><input className="input" value={form.redirectUrl ?? ""} onChange={(e) => setForm({ ...form, redirectUrl: e.target.value || null })} placeholder="https://..." /></div>
                <div className="field"><label className="label">Bahasa aktif</label><div className="row">{(["id", "en"] as Locale[]).map((item) => <label key={item} className="row small" style={{ gap: 6 }}><input type="checkbox" className="checkbox" checked={form.settings.locales.includes(item)} onChange={(e) => setForm({ ...form, settings: { ...form.settings, locales: e.target.checked ? [...form.settings.locales, item] : form.settings.locales.filter((lang) => lang !== item) } })} /> {item.toUpperCase()}</label>)}</div></div>
              </div>
              <div className="field"><label className="label">{"Translasi kustom (JSON: {\"en\": {\"rsvp.title\": \"RSVP\"}})"}</label><textarea className="textarea mono" value={JSON.stringify(form.locales, null, 2)} onChange={(e) => { try { setForm({ ...form, locales: JSON.parse(e.target.value) as Record<string, Record<string, string>> }); setError(""); } catch { setError("JSON tidak valid"); } }} /></div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
