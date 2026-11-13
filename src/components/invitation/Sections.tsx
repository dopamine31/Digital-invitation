"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, MapPin, Play, MessageCircleHeart, PenLine, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { t } from "@/lib/i18n";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar";
import { whatsappLink } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import { Ornament } from "@/components/invitation/Ornaments";
import { getTheme } from "@/lib/themes";
import { submitWishAction, submitGuestBookAction, recordSectionViewAction } from "@/server/actions/public";
import { toast, CopyButton } from "@/components/client-ui";
import type { InvitationViewData } from "@/lib/view";
import type { Locale, SectionConfig } from "@/lib/types";

function Reveal({ children, enabled, className = "" }: { children: React.ReactNode; enabled: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!enabled);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: .12 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled]);
  return <div ref={ref} className={`reveal ${className}`} data-visible={visible}>{children}</div>;
}

function Countdown({ target, locale }: { target: string; locale: Locale }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return (
    <div className="countdown" role="timer" aria-label={t(locale, "countdown.aria")} aria-live="off">
      {[
        [days, t(locale, "countdown.days")], [hours, t(locale, "countdown.hours")],
        [minutes, t(locale, "countdown.minutes")], [seconds, t(locale, "countdown.seconds")],
      ].map(([value, label]) => (
        <div className="countdown-cell" key={String(label)}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>
      ))}
    </div>
  );
}

function CalendarButtons({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const schedule = data.schedules[0];
  const start = new Date(schedule?.startsAt ?? data.event.startsAt);
  const end = new Date(schedule?.endsAt ?? start.getTime() + 4 * 3600_000);
  const event = {
    title: data.event.title, description: `Undangan ${data.event.title}`,
    location: [schedule?.venueName, schedule?.address].filter(Boolean).join(", "),
    startsAt: start, endsAt: end, timezone: data.event.timezone,
  };
  const ics = buildIcs(event);
  const downloadIcs = () => {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${data.event.slug}.ics`; link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="row" style={{ justifyContent: "center" }}>
      <a className="inv-btn inv-btn-outline" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={15} /> {t(locale, "schedule.google")}</a>
      <button className="inv-btn inv-btn-outline" onClick={downloadIcs}><CalendarPlus size={15} /> {t(locale, "schedule.ics")}</button>
    </div>
  );
}

function Gallery({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const [active, setActive] = useState<number | null>(null);
  const items = data.settings.gallery;
  if (items.length === 0) return <p className="small center" style={{ opacity: .65 }}>Galeri foto akan segera hadir.</p>;
  return (
    <>
      <div className="inv-gallery">
        {items.map((item, index) => (
          <button key={`${item.url}-${index}`} onClick={() => setActive(index)} aria-label={`${t(locale, "gallery.aria")} ${index + 1}`} style={{ border: 0, padding: 0, background: "none" }}>
            {item.type === "video" ? <video src={item.url} muted preload="metadata" /> : <img src={item.url} alt={item.caption || `Foto ${index + 1}`} loading="lazy" decoding="async" />}
          </button>
        ))}
      </div>
      {active !== null && items[active] ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Galeri" onClick={() => setActive(null)}>
          <button className="inv-btn inv-btn-outline" style={{ position: "absolute", top: 20, right: 20 }} onClick={() => setActive(null)} aria-label="Tutup">✕</button>
          <button className="inv-btn inv-btn-outline" style={{ position: "absolute", left: 20 }} onClick={(event) => { event.stopPropagation(); setActive((active - 1 + items.length) % items.length); }} aria-label={t(locale, "gallery.prev")}><ChevronLeft size={18} /></button>
          {items[active].type === "video" ? <video src={items[active].url} controls autoPlay onClick={(e) => e.stopPropagation()} /> : <img src={items[active].url} alt={items[active].caption} onClick={(e) => e.stopPropagation()} />}
          <button className="inv-btn inv-btn-outline" style={{ position: "absolute", right: 20 }} onClick={(event) => { event.stopPropagation(); setActive((active + 1) % items.length); }} aria-label={t(locale, "gallery.next")}><ChevronRight size={18} /></button>
          <p style={{ position: "absolute", bottom: 24, color: "#fff", fontSize: 13 }}>{items[active].caption}</p>
        </div>
      ) : null}
    </>
  );
}

function GiftSection({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const { gift } = data.settings;
  return (
    <div className="stack">
      <p className="small center" style={{ opacity: .75 }}>{gift.note}</p>
      <div className="grid grid-2">
        {gift.accounts.map((account) => (
          <div className="inv-card" key={account.id} style={{ padding: 18 }}>
            <div className="row-between"><strong>{account.label}</strong><span className="badge badge-primary">{account.kind === "qris" ? t(locale, "gift.qris") : account.bank}</span></div>
            {account.qrisUrl ? <img src={account.qrisUrl} alt="QRIS" style={{ width: 160, margin: "12px auto", display: "block" }} loading="lazy" /> : (
              <>
                <div className="mono" style={{ fontSize: 20, margin: "12px 0" }}>{account.number}</div>
                <div className="tiny" style={{ opacity: .7 }}>a.n. {account.holder}</div>
                <div style={{ marginTop: 12 }}><CopyButton value={account.number} label={t(locale, "gift.copy")} /></div>
              </>
            )}
          </div>
        ))}
      </div>
      {gift.shippingAddress ? <p className="small center" style={{ marginTop: 12, opacity: .75 }}>{t(locale, "gift.shipping")}: {gift.shippingAddress}</p> : null}
    </div>
  );
}

function WishesSection({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const [name, setName] = useState(data.guest?.name ?? "");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [local, setLocal] = useState(data.wishes.map((wish, index) => ({ ...wish, id: `wish-${index}` })));
  const submit = async () => {
    setBusy(true);
    const result = await submitWishAction({ slug: data.event.slug, token: data.guest?.token ?? null, name, message, consent: true, website });
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    if (!result.data.moderated) setLocal([{ authorName: name, message, reply: null, id: result.data.id }, ...local]);
    setMessage(""); setSent(true);
    toast(result.data.moderated ? "Ucapan terkirim, menunggu moderasi" : "Ucapan terkirim");
  };
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div className="inv-card stack">
        <strong>{t(locale, "wishes.send")}</strong>
        <input className="inv-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, "common.name")} aria-label={t(locale, "common.name")} />
        <textarea className="inv-input" style={{ minHeight: 96 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t(locale, "wishes.placeholder")} aria-label={t(locale, "wishes.placeholder")} />
        <input className="hidden" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
        <label className="row tiny" style={{ gap: 7 }}><input type="checkbox" className="checkbox" defaultChecked disabled /> {t(locale, "privacy.consent")}</label>
        <button className="inv-btn" onClick={submit} disabled={busy || name.length < 2 || message.length < 2}><MessageCircleHeart size={15} /> {t(locale, "wishes.send")}</button>
        {sent && data.settings.wishesModerated ? <p className="tiny" style={{ opacity: .7 }}>{t(locale, "wishes.moderation")}</p> : null}
      </div>
      <div className="inv-wishes" aria-label="Daftar ucapan">
        {local.length === 0 ? <div className="inv-card small center" style={{ opacity: .7 }}>Belum ada ucapan.</div> : local.map((wish) => (
          <div className="wish-card" key={wish.id}><strong className="small">{wish.authorName}</strong><p className="small" style={{ marginTop: 4 }}>{wish.message}</p>{wish.reply ? <p className="tiny" style={{ marginTop: 8, opacity: .75 }}>↳ {wish.reply}</p> : null}</div>
        ))}
      </div>
    </div>
  );
}

function GuestBookSection({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const [name, setName] = useState(data.guest?.name ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState(data.guestBook.map((item, index) => ({ ...item, id: `gb-${index}` })));
  const submit = async () => {
    setBusy(true);
    const result = await submitGuestBookAction({ slug: data.event.slug, token: data.guest?.token ?? null, name, message });
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    setEntries([{ name, message, id: result.data.id }, ...entries]);
    setMessage(""); toast("Buku tamu ditandatangani");
  };
  return (
    <div className="inv-card stack">
      <div className="grid grid-2">
        <input className="inv-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, "common.name")} aria-label={t(locale, "common.name")} />
        <input className="inv-input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t(locale, "guestbook.placeholder")} aria-label={t(locale, "guestbook.placeholder")} />
      </div>
      <button className="inv-btn" onClick={submit} disabled={busy || name.length < 2}><PenLine size={15} /> {t(locale, "guestbook.send")}</button>
      <div className="tiny" style={{ opacity: .7 }}>{entries.length} tanda tangan · yang terbaru: {entries[0]?.name ?? "—"}</div>
    </div>
  );
}

function ContactSection({ data, locale }: { data: InvitationViewData; locale: Locale }) {
  const { pic } = data.settings;
  const contacts = [{ name: pic.name, role: pic.role, phone: pic.phone }, ...data.settings.contacts];
  return (
    <div className="grid grid-2">
      {contacts.map((contact, index) => (
        <div className="inv-card" key={`${contact.name}-${index}`} style={{ textAlign: "center" }}>
          <div className="inv-kicker">{contact.role || "PIC"}</div>
          <h3 style={{ fontFamily: "var(--inv-font-display)", fontSize: 26, margin: "8px 0" }}>{contact.name}</h3>
          <p className="small mono">{contact.phone}</p>
          <a className="inv-btn inv-btn-outline btn-sm" style={{ marginTop: 14 }} href={whatsappLink(contact.phone, pic.prefillMessage.replace("{acara}", data.event.title))} target="_blank" rel="noopener noreferrer">
            <MessageCircleHeart size={14} /> {t(locale, "cover.contactPic")}
          </a>
        </div>
      ))}
    </div>
  );
}

export function InvitationSections({
  data, locale, onRsvp, rsvpNode,
}: {
  data: InvitationViewData;
  locale: Locale;
  onRsvp: () => void;
  rsvpNode: React.ReactNode;
}) {
  const theme = getTheme(data.event.themeId);
  const animationEnabled = data.theme.animation.enabled && data.theme.animation.reveal;
  const visible = useMemo(() => data.sections.filter((section) => section.visible), [data.sections]);
  const title = (section: SectionConfig) => section.title ?? t(locale, `section.${section.type}` as string);

  useEffect(() => {
    if (data.preview) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.sectionKey;
        if (key && entry.isIntersecting) void recordSectionViewAction({ slug: data.event.slug, token: data.guest?.token ?? null, sectionKey: key });
      }
    }, { threshold: .5 });
    document.querySelectorAll<HTMLElement>("[data-section-key]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [data.preview, data.event.slug, data.guest?.token, visible.length]);

  return (
    <div className="inv-content">
      {visible.map((section) => {
        if (section.type === "cover" || section.type === "footer") return null;
        return (
          <section key={section.id} className="inv-section" data-section-key={section.type} aria-labelledby={`heading-${section.id}`}>
            <Reveal enabled={animationEnabled}>
              <div className="center" style={{ color: "var(--inv-primary)", opacity: .65, maxWidth: 180, margin: "0 auto 16px" }}><Ornament kind={theme.ornament} /></div>
              <h2 id={`heading-${section.id}`} className="inv-title center">{title(section)}</h2>
              <div style={{ height: 22 }} />
              {section.type === "couple" ? (
                <div className="grid grid-2">
                  {[data.settings.bride, data.settings.groom].map((person, index) => (
                    <div className="inv-card center" key={person.name}>
                      <div style={{ width: 74, height: 74, borderRadius: "50%", margin: "0 auto 14px", background: "var(--inv-primary)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--inv-font-display)", fontSize: 32 }}>{person.name.slice(0, 1)}</div>
                      <h3 style={{ fontFamily: "var(--inv-font-display)", fontSize: 30 }}>{person.fullName || person.name}</h3>
                      <p className="small" style={{ marginTop: 8, opacity: .75 }}>{person.parentNames}</p>
                      {index === 0 ? <p className="small" style={{ marginTop: 14 }}>&amp;</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {section.type === "saveDate" ? (
                <div className="stack center">
                  <p style={{ fontFamily: "var(--inv-font-display)", fontSize: 28 }}>{new Date(data.event.startsAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                  <Countdown target={data.schedules[0]?.startsAt ?? data.event.startsAt} locale={locale} />
                  <CalendarButtons data={data} locale={locale} />
                </div>
              ) : null}
              {section.type === "schedule" ? (
                <div className="stack">
                  {data.schedules.map((schedule) => (
                    <div className="inv-card" key={schedule.title}>
                      <div className="inv-kicker">{schedule.title}</div>
                      <h3 style={{ fontFamily: "var(--inv-font-display)", fontSize: 26, margin: "6px 0" }}>{new Date(schedule.startsAt).toLocaleString(locale === "id" ? "id-ID" : "en-US", { dateStyle: "full", timeStyle: "short", timeZone: schedule.timezone })}</h3>
                      <p className="small" style={{ opacity: .8 }}><MapPin size={13} style={{ verticalAlign: -2 }} /> {schedule.venueName} · {schedule.address}</p>
                      <div className="row" style={{ marginTop: 14 }}>
                        <a className="inv-btn inv-btn-outline btn-sm" href={schedule.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${schedule.venueName} ${schedule.address}`)}`} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> {t(locale, "schedule.maps")}</a>
                        <span className="tiny" style={{ opacity: .65 }}>{t(locale, "schedule.timezone")}: {schedule.timezone}</span>
                      </div>
                    </div>
                  ))}
                  <CalendarButtons data={data} locale={locale} />
                </div>
              ) : null}
              {section.type === "loveStory" ? (
                <div style={{ maxWidth: 620, margin: "0 auto" }}>
                  {data.settings.loveStory.map((item) => (
                    <div className="timeline-item" key={item.year}><div className="inv-kicker">{item.year}</div><h3 style={{ fontFamily: "var(--inv-font-display)", fontSize: 24 }}>{item.title}</h3><p className="small" style={{ opacity: .78, marginTop: 4 }}>{item.description}</p></div>
                  ))}
                </div>
              ) : null}
              {section.type === "gallery" ? <Gallery data={data} locale={locale} /> : null}
              {section.type === "livestream" ? (
                <div className="grid grid-2">
                  {data.settings.livestream.length === 0 ? <p className="small center" style={{ opacity: .7, gridColumn: "1 / -1" }}>Siaran langsung akan diumumkan menjelang acara.</p> : data.settings.livestream.map((item) => (
                    <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="inv-card center"><Play size={22} /><strong style={{ display: "block", marginTop: 8 }}>{item.label || item.platform}</strong><span className="tiny">Buka siaran <ExternalLink size={11} style={{ verticalAlign: -1 }} /></span></a>
                  ))}
                </div>
              ) : null}
              {section.type === "quotes" ? data.settings.quotes.map((quote, index) => (
                <blockquote key={index} style={{ textAlign: "center", fontFamily: "var(--inv-font-display)", fontSize: "clamp(1.3rem,3vw,2rem)", fontStyle: "italic", margin: 0 }}>“{quote.text}”<footer className="tiny" style={{ fontFamily: "var(--inv-font-body)", fontStyle: "normal", marginTop: 12, opacity: .7 }}>{quote.source}</footer></blockquote>
              )) : null}
              {section.type === "dressCode" ? (
                <div className="inv-card center"><h3>{data.settings.dressCode.title}</h3><p className="small" style={{ margin: "10px 0 16px", opacity: .8 }}>{data.settings.dressCode.description}</p><div className="swatches" style={{ justifyContent: "center" }}>{data.settings.dressCode.swatches.map((color) => <span key={color} className="swatch" style={{ background: color }} title={color} />)}</div></div>
              ) : null}
              {section.type === "gift" ? <GiftSection data={data} locale={locale} /> : null}
              {section.type === "wishes" ? <WishesSection data={data} locale={locale} /> : null}
              {section.type === "guestBook" ? <GuestBookSection data={data} locale={locale} /> : null}
              {section.type === "health" ? <div className="inv-card"><ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{data.settings.health.items.map((item) => <li key={item} style={{ marginBottom: 6 }}>{item}</li>)}</ul></div> : null}
              {section.type === "turutMengundang" ? <div className="inv-card center stack" style={{ gap: 7 }}>{data.settings.turutMengundang.map((item) => <p className="small" key={item}>{item}</p>)}</div> : null}
              {section.type === "faq" ? <div className="stack">{data.settings.faq.map((item, index) => <details key={index} className="inv-card"><summary style={{ cursor: "pointer", fontWeight: 600 }}>{item.question}</summary><p className="small" style={{ marginTop: 10, opacity: .8 }}>{item.answer}</p></details>)}</div> : null}
              {section.type === "rundown" ? <div className="stack">{data.settings.rundown.map((item) => <div className="row-between inv-card" key={item.time}><strong className="mono">{item.time}</strong><span className="small">{item.agenda}</span></div>)}</div> : null}
              {section.type === "contact" ? <ContactSection data={data} locale={locale} /> : null}
              {section.type === "rsvp" ? <div onFocus={onRsvp}>{rsvpNode}</div> : null}
              {section.type === "custom" ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(section.data.html ?? "<p>Konten kustom</p>")) }} /> : null}
            </Reveal>
          </section>
        );
      })}
      <footer className="inv-footer">
        <div style={{ color: "var(--inv-primary)", opacity: .6, maxWidth: 160, margin: "0 auto 14px" }}><Ornament kind={theme.ornament} /></div>
        <h2 className="inv-title">{t(locale, "section.footer")}</h2>
        <p className="small" style={{ margin: "12px auto", maxWidth: 520, opacity: .78 }}>{data.settings.footer.text}</p>
        <p className="tiny">— {data.settings.bride.name} &amp; {data.settings.groom.name} —</p>
        {data.settings.footer.showBranding ? <p className="tiny" style={{ marginTop: 22, opacity: .55 }}>Dibuat dengan Rasa Undangan</p> : null}
        <button className="inv-btn inv-btn-outline btn-sm" style={{ marginTop: 20 }} onClick={onRsvp}>{t(locale, "rsvp.title")}</button>
      </footer>
    </div>
  );
}
