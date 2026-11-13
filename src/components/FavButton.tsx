"use client";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useToast } from "@/components/ActionForm";
import { toggleFavorite } from "@/server/actions/customer";

export function FavButton({ templateId, initial, className = "" }: { templateId: number; initial: boolean; className?: string }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button type="button" disabled={pending} aria-pressed={fav} aria-label={fav ? "Hapus dari favorit" : "Tambah ke favorit"} className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow ${className}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); start(async () => { const r = await toggleFavorite(templateId); if (r.ok) setFav((f) => !f); toast(r.message, r.ok ? "ok" : "err"); }); }}>
      <Heart size={18} className={fav ? "fill-red-500 text-red-500" : "text-stone-500"} />
    </button>
  );
}
