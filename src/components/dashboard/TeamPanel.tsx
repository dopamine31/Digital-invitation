"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, MessageCircle, Check } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { toast } from "@/components/client-ui";
import { inviteMemberAction, removeMemberAction, addCommentAction, resolveCommentAction } from "@/server/actions/team";
import { formatDateTime } from "@/lib/format";

interface Member { id: string; name: string; email: string; role: string; eventId: string | null; createdAt: string }
interface Comment { id: string; body: string; author: string; createdAt: string; resolved: boolean }

export function TeamPanel({ members, comments, workspace }: { members: Member[]; comments: Comment[]; workspace: { id: string; title: string } }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "EDITOR" as "TENANT_ADMIN" | "EVENT_OWNER" | "CO_HOST" | "EDITOR" | "CHECKIN_STAFF" | "VIEWER", eventId: workspace.id });
  const [body, setBody] = useState("");
  const invite = async () => {
    const result = await inviteMemberAction(form);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast("Undangan terkirim via magic link (mock email)"); router.refresh();
    setForm({ ...form, name: "", email: "" });
  };
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Tim & kolaborasi</h1><p className="page-subtitle">Co-host, editor, panitia, komentar internal, dan log aktivitas.</p></div><Badge tone="primary">{members.length} anggota</Badge></div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card">
            <h3>Undang anggota</h3>
            <div className="grid grid-2" style={{ marginTop: 14 }}>
              <div className="field"><label className="label">Nama</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label className="label">Role</label><select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}><option value="TENANT_ADMIN">Admin Tenant</option><option value="EVENT_OWNER">Owner Acara</option><option value="CO_HOST">Co-Host</option><option value="EDITOR">Editor</option><option value="CHECKIN_STAFF">Panitia Check-in</option><option value="VIEWER">Viewer</option></select></div>
              <div className="field"><label className="label">Cakupan acara</label><select className="select" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}><option value={workspace.id}>{workspace.title}</option></select></div>
            </div>
            <Button variant="primary" onClick={invite} disabled={form.name.length < 2 || !form.email.includes("@")}><UserPlus size={15} /> Kirim undangan</Button>
          </div>
          <div className="card">
            <h3>Anggota</h3>
            {members.length === 0 ? <EmptyState title="Belum ada anggota" /> : (
              <div className="table-wrap" style={{ border: 0, marginTop: 12 }}><table className="table"><thead><tr><th>Nama</th><th>Role</th><th>Bergabung</th><th /></tr></thead><tbody>
                {members.map((row) => <tr key={row.id}><td><strong className="small">{row.name}</strong><div className="tiny muted">{row.email}</div></td><td><Badge tone="primary">{row.role}</Badge></td><td className="tiny muted">{formatDateTime(row.createdAt)}</td><td><Button size="sm" variant="danger" onClick={async () => { const r = await removeMemberAction(row.id); if (r.ok) { toast("Dihapus"); router.refresh(); } }}><Trash2 size={13} /></Button></td></tr>)}
              </tbody></table></div>
            )}
          </div>
        </div>
        <div className="card">
          <h3><MessageCircle size={16} style={{ verticalAlign: -3 }} /> Komentar internal · {workspace.title}</h3>
          <div className="row" style={{ margin: "14px 0" }}><input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Catatan untuk tim…" aria-label="Komentar" /><Button onClick={async () => { const r = await addCommentAction(workspace.id, body); if (r.ok) { setBody(""); router.refresh(); } else toast(r.error, "err"); }} disabled={body.length < 2}>Kirim</Button></div>
          {comments.length === 0 ? <EmptyState title="Belum ada komentar" /> : (
            <div className="stack">{comments.map((comment) => (
              <div className="row-between" key={comment.id} style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 10 }}>
                <div><strong className="small">{comment.author}</strong><p className="small">{comment.body}</p><span className="tiny muted">{formatDateTime(comment.createdAt)}</span></div>
                {!comment.resolved ? <Button size="sm" onClick={async () => { const r = await resolveCommentAction(workspace.id, comment.id); if (r.ok) router.refresh(); }}><Check size={13} /></Button> : <Badge tone="success">Selesai</Badge>}
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
