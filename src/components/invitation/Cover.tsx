"use client";

import { useState } from "react";
import { MessageCircle, ArrowDown, Sparkles, PhoneCall } from "lucide-react";
import { getTheme } from "@/lib/themes";
import { t, SUPPORTED_LOCALES } from "@/lib/i18n";
import { whatsappLink } from "@/lib/format";
import { Ornament } from "@/components/invitation/Ornaments";
import { requestLinkAction } from "@/server/actions/public";
import { toast } from "@/components/client-ui";
import type { InvitationViewData } from "@/lib/view";
import type { Locale } from "@/lib/types";

export function Cover({
  data, locale, onOpen, onLocaleChange, compact = false,
}: {
  data: InvitationViewData;
  locale: Locale;
  onOpen: () => void;
  onLocaleChange: (locale: Locale) => void;
  compact?: boolean;
}) {
  const theme = getTheme(data.event.themeId);
  const { pic } = data.settings;
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const guestName = data.guest?.name ?? "Bapak/Ibu/Saudara/i";
  const picMessage = pic.prefillMessage.replace("{acara}", data.event.title);
  const contactUrl = whatsappLink(pic.phone, picMessage);

  const requestLink = async () => {
    setBusy(true);
    const result = await requestLinkAction({ slug: data.event.slug, name: requestName, phone: requestPhone });
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    window.open(result.data.waUrl, "_blank", "noopener,noreferrer");
    setRequestOpen(false);
  };

  const picBlock = pic.showOnCover ? (
    <div className="inv-pic" data-position={pic.coverPosition} style={{ marginTop: 22 }}>
      <span className="tiny" style={{ letterSpacing: ".14em", textTransform: "uppercase", opacity: .7 }}>{pic.label || t(locale, "cover.pic")}</span>
      <strong>{pic.name}</strong>
      <span className="muted">· {pic.phone}</span>
      <a className="btn btn-sm btn-primary" href={contactUrl} target="_blank" rel="noopener noreferrer" aria-label={t(locale, "cover.contactPic")} style={{ borderRadius: 999 }}>
        <MessageCircle size={14} /> {t(locale, "cover.contactPic")}
      </a>
    </div>
  ) : null;

  const guestBlock = (
    <div style={{ margin: "18px 0" }}>
      <div className="inv-kicker">{t(locale, "cover.to")}</div>
      <div className="inv-guest-name">{guestName}</div>
    </div>
  );

  const titleBlock = (
    <div>
      <div className="inv-kicker">{data.event.title}</div>
      <h1 style={{ fontFamily: "var(--inv-font-display)", fontSize: "clamp(2.8rem,8vw,6rem)", lineHeight: 1, margin: "14px 0" }}>
        {theme.layout === "art-deco-dark" ? data.event.title.toUpperCase() : `${data.settings.bride.name} & ${data.settings.groom.name}`}
      </h1>
      <p style={{ opacity: .78, maxWidth: 520, margin: "0 auto" }}>{data.settings.coverSubtitle}</p>
    </div>
  );

  const actions = compact ? null : (
    <div className="row" style={{ justifyContent: "center", marginTop: 28 }}>
      <button className="inv-btn" onClick={onOpen}><Sparkles size={16} /> {t(locale, "cover.open")}</button>
      <button className="inv-btn inv-btn-outline" onClick={() => setRequestOpen(true)}><PhoneCall size={15} /> {t(locale, "cover.requestLink")}</button>
    </div>
  );

  return (
    <section className="inv-cover" data-layout={theme.layout} aria-label="Sampul undangan">
      <div className="inv-cover-inner">
        <div style={{ color: "var(--inv-primary)", opacity: .8, maxWidth: 240, margin: "0 auto 10px" }}><Ornament kind={theme.ornament} /></div>
        {theme.layout === "split-typographic" ? (
          <div className="row" style={{ gap: 24 }}>
            <div>{titleBlock}{guestBlock}</div>
            <div>{guestBlock}<p className="small" style={{ opacity: .7 }}>{data.settings.openingQuote}</p>{picBlock}{actions}</div>
          </div>
        ) : theme.layout === "editorial-grid" ? (
          <div>
            <div>{titleBlock}</div>
            <div>
              <span style={{ fontSize: "clamp(4rem,12vw,9rem)", fontFamily: "var(--inv-font-display)", lineHeight: 1, opacity: .12, display: "block" }}>{new Date(data.event.startsAt).getFullYear()}</span>
              {guestBlock}
              <p className="tiny" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>{new Date(data.event.startsAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>{picBlock}{actions}</div>
          </div>
        ) : (
          <>{titleBlock}{guestBlock}{picBlock}{actions}</>
        )}
        <div style={{ color: "var(--inv-primary)", opacity: .55, maxWidth: 240, margin: "22px auto 0" }}><Ornament kind={theme.ornament} /></div>
        <button onClick={onOpen} className="inv-btn inv-btn-outline btn-sm" style={{ marginTop: 16, borderRadius: 999, border: 0, background: "transparent", fontSize: 12 }}>
          <ArrowDown size={13} /> {t(locale, "cover.scroll")}
        </button>
        <div className="row" style={{ justifyContent: "center", gap: 6, marginTop: 18 }}>
          {SUPPORTED_LOCALES.map((item) => (
            <button key={item} onClick={() => onLocaleChange(item)} data-active={locale === item} className="btn btn-sm" style={{ padding: "4px 10px", borderRadius: 999, background: locale === item ? "var(--inv-primary)" : "transparent", color: locale === item ? "#fff" : "var(--inv-text)", borderColor: "var(--inv-border)" }} aria-label={item === "id" ? "Bahasa Indonesia" : "English"}>
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {!compact && requestOpen ? (
        <div className="modal-backdrop" style={{ background: "rgba(20,18,14,.7)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) setRequestOpen(false); }}>
          <div className="modal" style={{ background: "var(--inv-surface)", color: "var(--inv-text)" }} role="dialog" aria-modal="true">
            <h3>{t(locale, "cover.requestLink")}</h3>
            <p className="small muted" style={{ margin: "8px 0 18px" }}>Pesan WhatsApp ke PIC {pic.name} akan disiapkan untuk Anda.</p>
            <div className="stack">
              <div className="field"><label className="label">{t(locale, "common.name")}</label><input className="input" value={requestName} onChange={(e) => setRequestName(e.target.value)} /></div>
              <div className="field"><label className="label">{t(locale, "common.phone")}</label><input className="input" value={requestPhone} onChange={(e) => setRequestPhone(e.target.value)} placeholder="0812..." /></div>
              <div className="row"><button className="btn btn-primary" onClick={requestLink} disabled={busy || requestName.length < 2 || requestPhone.length < 8}>Kirim via WhatsApp</button><button className="btn" onClick={() => setRequestOpen(false)}>{t(locale, "common.cancel")}</button></div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
