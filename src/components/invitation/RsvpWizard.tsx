"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CalendarPlus, Share2, XCircle, ClipboardCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import { visibleFields } from "@/lib/rsvp";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar";
import { submitRsvpAction, updateRsvpAction, cancelRsvpAction } from "@/server/actions/rsvp";
import { toast, CopyButton } from "@/components/client-ui";
import type { InvitationViewData } from "@/lib/view";
import type { Locale, RsvpField } from "@/lib/types";

type Status = "ATTENDING" | "DECLINED" | "MAYBE";

export function RsvpWizard({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const form = data.rsvpForm;
  const existing = data.rsvp;
  const [step, setStep] = useState(existing ? 2 : 0);
  const [status, setStatus] = useState<Status>((existing?.status as Status) ?? "ATTENDING");
  const [pax, setPax] = useState(existing?.pax || 1);
  const [sessionId, setSessionId] = useState(existing?.sessionId ?? form.settings.sessions[0]?.id ?? "");
  const [mealChoice, setMealChoice] = useState(existing?.mealChoice ?? form.settings.mealChoices[0] ?? "");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>(existing?.answers ?? {});
  const [consent, setConsent] = useState(Boolean(existing));
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ editUrl: string; status: string; pax: number; thankYouMessage: string; redirectUrl: string | null } | null>(null);

  const fields = useMemo(() => visibleFields(form.fields, answers), [form.fields, answers]);
  const maxPax = Math.min(form.paxQuotaPerGuest, form.settings.maxPax, data.guest?.paxAllocated ?? form.paxQuotaPerGuest);
  const closed = form.isClosed || (form.deadlineAt && new Date(form.deadlineAt) < new Date());
  const utm = useMemo(() => {
    if (typeof window === "undefined") return { source: null, medium: null, campaign: null };
    const params = new URLSearchParams(window.location.search);
    return { source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign") };
  }, []);

  const submit = async () => {
    setBusy(true); setError("");
    const payload = {
      slug: data.event.slug, token: data.guest?.token ?? "", locale, status, pax,
      answers, sessionId, mealChoice, attendanceNote, consent, website, utm,
    };
    const response = data.editToken && existing
      ? await updateRsvpAction(data.editToken, payload)
      : await submitRsvpAction(payload);
    setBusy(false);
    if (!response.ok) { setError(response.error); return; }
    setResult({
      editUrl: response.data.editUrl, status: response.data.status, pax: response.data.pax,
      thankYouMessage: response.data.thankYouMessage, redirectUrl: response.data.redirectUrl,
    });
    setStep(2);
    toast("RSVP berhasil dikirim");
    if (response.data.redirectUrl) window.setTimeout(() => { window.location.href = response.data.redirectUrl as string; }, 2500);
  };

  const cancel = async () => {
    if (!data.editToken || !window.confirm(t(locale, "rsvp.cancel") + "?")) return;
    const response = await cancelRsvpAction(data.editToken);
    if (!response.ok) { toast(response.error, "err"); return; }
    setStatus("DECLINED"); setResult(null); setStep(0);
    setAnswers({}); toast("Kehadiran dibatalkan");
  };

  const renderField = (field: RsvpField) => {
    const label = field.label[locale] ?? field.label.id;
    const value = answers[field.id];
    const set = (next: unknown) => setAnswers({ ...answers, [field.id]: next });
    const common = { id: `rsvp-${field.id}`, className: "inv-input", "aria-label": label };
    if (["text", "phone", "email", "date", "number", "file", "address"].includes(field.type)) {
      return <input {...common} type={field.type === "phone" ? "tel" : field.type === "file" ? "text" : field.type === "address" ? "text" : field.type} value={typeof value === "string" ? value : ""} placeholder={field.placeholder?.[locale] ?? ""} onChange={(e) => set(field.type === "number" ? Number(e.target.value) : e.target.value)} />;
    }
    if (field.type === "textarea") return <textarea {...common} style={{ minHeight: 88 }} value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} placeholder={field.placeholder?.[locale] ?? ""} />;
    if (field.type === "select") return <select {...common} value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)}><option value="">—</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label[locale] ?? option.label.id}</option>)}</select>;
    if (field.type === "radio") return <div className="pill-row">{(field.options ?? []).map((option) => <label key={option.value} className="row tiny" style={{ gap: 6, border: "1px solid var(--inv-border)", borderRadius: 999, padding: "7px 12px", cursor: "pointer" }}><input type="radio" name={field.id} checked={value === option.value} onChange={() => set(option.value)} />{option.label[locale] ?? option.label.id}</label>)}</div>;
    if (field.type === "multiselect") return <div className="pill-row">{(field.options ?? []).map((option) => <label key={option.value} className="row tiny" style={{ gap: 6, border: "1px solid var(--inv-border)", borderRadius: 999, padding: "7px 12px", cursor: "pointer" }}><input type="checkbox" checked={Array.isArray(value) && value.includes(option.value)} onChange={(e) => { const list = Array.isArray(value) ? value.map(String) : []; set(e.target.checked ? [...list, option.value] : list.filter((item) => item !== option.value)); }} />{option.label[locale] ?? option.label.id}</label>)}</div>;
    if (field.type === "checkbox") return <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} /> {label}</label>;
    return null;
  };

  const calendarEvent = {
    title: data.event.title, description: `Undangan ${data.event.title}`,
    location: [data.schedules[0]?.venueName, data.schedules[0]?.address].filter(Boolean).join(", "),
    startsAt: new Date(data.schedules[0]?.startsAt ?? data.event.startsAt),
    endsAt: new Date(data.schedules[0]?.endsAt ?? new Date(data.event.startsAt).getTime() + 4 * 3600_000),
    timezone: data.event.timezone,
  };

  if (closed) return <div className="inv-card center"><p>{t(locale, "rsvp.closed")}</p></div>;

  return (
    <div className="inv-card stack" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((index) => <div key={index} className="progress" style={{ flex: 1, height: 4 }}><span style={{ width: step >= index ? "100%" : "0%" }} /></div>)}
      </div>
      <div className="tiny center" style={{ letterSpacing: ".16em", textTransform: "uppercase", opacity: .7 }}>{t(locale, `rsvp.step${step + 1}`)}</div>

      {step === 0 ? (
        <div className="stack">
          <p className="small center" style={{ opacity: .75 }}>{t(locale, "rsvp.subtitle")}</p>
          <div className="grid grid-3">
            {(["ATTENDING", "DECLINED", "MAYBE"] as Status[]).filter((item) => item !== "MAYBE" || form.settings.allowMaybe).map((item) => (
              <button key={item} className="inv-card center" style={{ cursor: "pointer", borderColor: status === item ? "var(--inv-primary)" : undefined, background: status === item ? "var(--inv-surface)" : undefined }} onClick={() => setStatus(item)} aria-pressed={status === item}>
                <span style={{ fontSize: 22 }}>{item === "ATTENDING" ? "✓" : item === "DECLINED" ? "✕" : "?"}</span>
                <strong className="small" style={{ display: "block", marginTop: 6 }}>{t(locale, item === "ATTENDING" ? "rsvp.attending" : item === "DECLINED" ? "rsvp.declined" : "rsvp.maybe")}</strong>
              </button>
            ))}
          </div>
          {status !== "DECLINED" ? (
            <div className="field"><label className="inv-label" htmlFor="rsvp-pax">{t(locale, "rsvp.pax")} · {t(locale, "rsvp.quota")} {maxPax}</label><input id="rsvp-pax" className="inv-input" type="number" min={1} max={maxPax} value={pax} onChange={(e) => setPax(Math.min(maxPax, Math.max(1, Number(e.target.value))))} /></div>
          ) : null}
          <p className="tiny" style={{ opacity: .7 }}>{t(locale, "rsvp.autoFill")}: {data.guest?.name ?? "—"}</p>
          {form.deadlineAt ? <p className="tiny" style={{ opacity: .7 }}>{t(locale, "rsvp.deadline")}: {new Date(form.deadlineAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US")}</p> : null}
          <button className="inv-btn" onClick={() => setStep(1)}>{t(locale, "common.continue")} <ChevronRight size={15} /></button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="stack">
          {form.settings.allowSessionChoice && form.settings.sessions.length > 0 ? (
            <div className="field"><label className="inv-label" htmlFor="rsvp-session">{t(locale, "rsvp.session")}</label><select id="rsvp-session" className="inv-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>{form.settings.sessions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}</select></div>
          ) : null}
          {form.settings.mealChoices.length > 0 ? (
            <div className="field"><label className="inv-label" htmlFor="rsvp-meal">{t(locale, "rsvp.meal")}</label><select id="rsvp-meal" className="inv-input" value={mealChoice} onChange={(e) => setMealChoice(e.target.value)}>{form.settings.mealChoices.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          ) : null}
          <div className="inv-field-row">
            {fields.map((field) => field.type === "checkbox" ? <div key={field.id} style={{ gridColumn: "1 / -1" }}>{renderField(field)}</div> : (
              <div className="field" key={field.id}><label className="inv-label" htmlFor={`rsvp-${field.id}`}>{field.label[locale] ?? field.label.id}{field.required ? " *" : ""}</label>{renderField(field)}{field.helpText ? <span className="tiny" style={{ opacity: .65 }}>{field.helpText}</span> : null}</div>
            ))}
          </div>
          <div className="field"><label className="inv-label" htmlFor="rsvp-note">{t(locale, "rsvp.note")}</label><textarea id="rsvp-note" className="inv-input" style={{ minHeight: 70 }} value={attendanceNote} onChange={(e) => setAttendanceNote(e.target.value)} /></div>
          <label className="row tiny" style={{ gap: 8, alignItems: "flex-start" }}><input type="checkbox" className="checkbox" aria-label="Persetujuan Kebijakan Privasi" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> <span>{t(locale, "privacy.consent")}</span></label>
          <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
          {error ? <div className="notice notice-error">{error}</div> : null}
          <div className="row"><button className="inv-btn inv-btn-outline" onClick={() => setStep(0)}><ChevronLeft size={15} /> {t(locale, "common.back")}</button><button className="inv-btn" onClick={submit} disabled={busy || !consent} style={{ flex: 1 }}>{busy ? <span className="spinner" /> : <ClipboardCheck size={15} />} {existing ? t(locale, "rsvp.update") : t(locale, "rsvp.submit")}</button></div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="center stack">
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--inv-primary)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto" }}><Check size={26} /></div>
          <h3 style={{ fontFamily: "var(--inv-font-display)", fontSize: 28 }}>{t(locale, "rsvp.thanks")}</h3>
          <p className="small" style={{ opacity: .78 }}>{result?.thankYouMessage ?? form.thankYouMessage}</p>
          {data.guest ? (
            <div className="inv-qr" style={{ margin: "12px auto" }}>
              <img src={`/api/qr/${encodeURIComponent(data.guest.id)}?token=${encodeURIComponent(data.guest.token)}`} alt="QR e-ticket" width={170} height={170} loading="lazy" />
            </div>
          ) : null}
          <div className="small"><strong>{t(locale, "rsvp.ticket")}</strong> · {data.guest?.name} · {result?.status ?? existing?.status} · {result?.pax ?? existing?.pax} tamu</div>
          {result?.editUrl ? (
            <div className="row" style={{ justifyContent: "center" }}>
              <CopyButton value={result.editUrl} label="Salin link ubah RSVP" />
              <button className="inv-btn inv-btn-outline btn-sm" onClick={cancel}><XCircle size={14} /> {t(locale, "rsvp.cancel")}</button>
            </div>
          ) : null}
          <p className="tiny" style={{ opacity: .7 }}>{t(locale, "rsvp.editLink")}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <a className="inv-btn inv-btn-outline btn-sm" href={googleCalendarUrl(calendarEvent)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={14} /> {t(locale, "schedule.addCalendar")}</a>
            <button className="inv-btn inv-btn-outline btn-sm" onClick={async () => {
              const blob = new Blob([buildIcs(calendarEvent)], { type: "text/calendar" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a");
              a.href = url; a.download = `${data.event.slug}.ics`; a.click(); URL.revokeObjectURL(url);
            }}>.ics</button>
            <button className="inv-btn inv-btn-outline btn-sm" onClick={async () => {
              const url = `${window.location.origin}/i/${data.event.slug}?to=${data.guest?.token ?? ""}`;
              if (navigator.share) await navigator.share({ title: data.event.title, url }).catch(() => undefined);
              else await navigator.clipboard.writeText(url).then(() => toast("Link disalin")).catch(() => toast("Gagal menyalin", "err"));
            }}><Share2 size={14} /> {t(locale, "rsvp.share")}</button>
          </div>
          {!result && existing ? <button className="inv-btn" onClick={() => setStep(0)}>{t(locale, "rsvp.update")}</button> : null}
        </div>
      ) : null}
    </div>
  );
}
