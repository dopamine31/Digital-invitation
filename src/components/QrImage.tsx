"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 180, className = "", dark = "#111111", light = "#ffffff" }: { value: string; size?: number; className?: string; dark?: string; light?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark, light } }).then((u) => alive && setSrc(u)).catch(() => undefined);
    return () => { alive = false; };
  }, [value, size, dark, light]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR Code" width={size} height={size} className={className} /> : <div style={{ width: size, height: size }} className={`animate-pulse rounded bg-black/10 ${className}`} />;
}

/** Unduh QR resolusi tinggi (1024px) sebagai PNG */
export async function downloadQR(value: string, filename: string) {
  const url = await QRCode.toDataURL(value, { width: 1024, margin: 2 });
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".png") ? filename : `${filename}.png`; a.click();
}
