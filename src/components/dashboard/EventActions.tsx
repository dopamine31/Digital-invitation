"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/client-ui";
import { Button } from "@/components/ui";
import { publishEventAction, duplicateEventAction, setEventStatusAction, deleteEventAction } from "@/server/actions/events";

export function EventActions({ id, slug, status }: { id: string; slug: string; status: string }) {
  const router = useRouter();
  const run = async (kind: "publish" | "duplicate" | "draft" | "archive") => {
    const result = kind === "publish" ? await publishEventAction(id)
      : kind === "duplicate" ? await duplicateEventAction(id)
      : kind === "draft" ? await setEventStatusAction(id, "DRAFT")
      : await deleteEventAction(id);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast(kind === "publish" ? "Undangan diterbitkan" : kind === "duplicate" ? "Acara diduplikasi" : "Status diperbarui");
    if (kind === "duplicate" && result.ok && "id" in result.data) router.push(`/app/events/${result.data.id}/editor`);
    else router.refresh();
  };
  return (
    <div className="row">
      <a href={`/i/${slug}`} target="_blank" rel="noreferrer" className="btn btn-sm">Lihat publik</a>
      {status !== "PUBLISHED" ? <Button size="sm" variant="primary" onClick={() => run("publish")}>Terbitkan</Button> : <Button size="sm" onClick={() => run("draft")}>Jadikan draf</Button>}
      <Button size="sm" onClick={() => run("duplicate")}>Duplikasi</Button>
      <Button size="sm" variant="danger" onClick={() => run("archive")}>Arsipkan</Button>
    </div>
  );
}
