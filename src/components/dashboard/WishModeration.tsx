"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { toast } from "@/components/client-ui";
import { moderateWishAction } from "@/server/actions/public";
import { formatDateTime } from "@/lib/format";

interface WishRow { id: string; authorName: string; message: string; status: string; reply: string | null; createdAt: string }

export function WishModeration({ eventId, wishes }: { eventId: string; wishes: WishRow[] }) {
  const router = useRouter();
  const [reply, setReply] = useState<Record<string, string>>({});
  const act = async (id: string, status: "APPROVED" | "REJECTED") => {
    const result = await moderateWishAction(eventId, id, status, reply[id] ?? "");
    if (!result.ok) { toast(result.error, "err"); return; }
    toast(status === "APPROVED" ? "Ucapan disetujui" : "Ucapan ditolak");
    router.refresh();
  };
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Ucapan & buku tamu</h1><p className="page-subtitle">Moderasi ucapan, balasan publik, dan pertanyaan tamu.</p></div><Badge tone="warn">{wishes.filter((w) => w.status === "PENDING").length} menunggu</Badge></div>
      {wishes.length === 0 ? <div className="card"><EmptyState title="Belum ada ucapan" /></div> : (
        <div className="grid grid-2">
          {wishes.map((wish) => (
            <div className="card" key={wish.id}>
              <div className="row-between"><div><strong>{wish.authorName}</strong><div className="tiny muted">{formatDateTime(wish.createdAt)}</div></div><Badge tone={wish.status === "APPROVED" ? "success" : wish.status === "PENDING" ? "warn" : "danger"}>{wish.status}</Badge></div>
              <p className="small" style={{ margin: "12px 0" }}>{wish.message}</p>
              {wish.reply ? <p className="tiny muted">Balasan: {wish.reply}</p> : null}
              <div className="row" style={{ marginTop: 12 }}>
                <input className="input" placeholder="Balasan (opsional)" value={reply[wish.id] ?? ""} onChange={(e) => setReply({ ...reply, [wish.id]: e.target.value })} aria-label={`Balasan untuk ${wish.authorName}`} />
                <Button size="sm" onClick={() => act(wish.id, "APPROVED")} aria-label="Setujui"><Check size={14} /></Button>
                <Button size="sm" variant="danger" onClick={() => act(wish.id, "REJECTED")} aria-label="Tolak"><X size={14} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
