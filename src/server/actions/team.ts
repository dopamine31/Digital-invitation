"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { requireActor, requirePermission, audit, tenantIdOrThrow } from "@/server/context";
import { issueVerification } from "@/lib/auth";
import { emailAdapter } from "@/adapters/email";
import { stripTags } from "@/lib/sanitize";
import { err, ok, type Result } from "@/lib/result";

const inviteSchema = z.object({
  email: z.string().email(), name: z.string().min(2).max(120),
  role: z.enum(["TENANT_ADMIN", "EVENT_OWNER", "CO_HOST", "EDITOR", "CHECKIN_STAFF", "VIEWER"]),
  eventId: z.string().nullable().default(null),
});

export async function inviteMemberAction(input: z.infer<typeof inviteSchema>): Promise<Result<{ id: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data undangan tim tidak valid.");
  try {
    const actor = await requirePermission("team.manage");
    const tenantId = tenantIdOrThrow(actor);
    const email = parsed.data.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (user && user.tenantId !== tenantId) return err("CROSS_TENANT", "Email sudah terdaftar di tenant lain.");
    if (!user) {
      user = await prisma.user.create({
        data: { tenantId, email, name: parsed.data.name, platformRole: "USER", status: "INVITED" },
      });
    }
    const db = tenantClient(tenantId);
    const existing = await db.membership.findFirst({
      where: { tenantId, userId: user.id, role: parsed.data.role, eventId: parsed.data.eventId },
    });
    if (!existing) {
      await db.membership.create({
        data: { tenantId, userId: user.id, role: parsed.data.role, eventId: parsed.data.eventId, invitedBy: actor.actorId },
      });
    }
    const issued = await issueVerification({ identifier: email, channel: "EMAIL", purpose: "MAGIC_LINK", tenantId, meta: { email }, ttlMinutes: 60 * 24 });
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/magic?token=${issued.token}`;
    await emailAdapter().send({
      to: email, subject: `Bergabung ke ${actor.tenant?.name ?? "tim"} di Rasa Undangan`,
      html: `<p>${actor.user.name} mengundang Anda sebagai ${parsed.data.role}.</p><p><a href="${link}">Terima undangan</a></p>`,
      tenantId,
    });
    if (user.status === "INVITED") await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    await audit(actor, "team.invite", "Membership", user.id, undefined, { email, role: parsed.data.role });
    revalidatePath("/app/team");
    return ok({ id: user.id });
  } catch (error: unknown) {
    return err("INVITE_FAILED", error instanceof Error ? error.message : "Gagal mengundang anggota.");
  }
}

export async function listMembersAction(): Promise<Result<{ id: string; name: string; email: string; role: string; eventId: string | null; createdAt: string }[]>> {
  try {
    const actor = await requireActor();
    const db = tenantClient(actor.tenantId);
    const memberships = await db.membership.findMany({ where: { tenantId: actor.tenantId }, orderBy: { createdAt: "desc" } });
    const users = await prisma.user.findMany({ where: { id: { in: memberships.map((row) => row.userId) } } });
    const byId = new Map(users.map((user) => [user.id, user]));
    return ok(memberships.map((row) => ({
      id: row.id, name: byId.get(row.userId)?.name ?? "Pengguna",
      email: byId.get(row.userId)?.email ?? "", role: row.role,
      eventId: row.eventId, createdAt: row.createdAt.toISOString(),
    })));
  } catch (error: unknown) {
    return err("TEAM_FAILED", error instanceof Error ? error.message : "Gagal memuat tim.");
  }
}

export async function removeMemberAction(membershipId: string): Promise<Result<{ deleted: true }>> {
  try {
    const actor = await requirePermission("team.manage");
    await tenantClient(actor.tenantId).membership.delete({ where: { id: membershipId, tenantId: actor.tenantId } });
    await audit(actor, "team.remove", "Membership", membershipId);
    revalidatePath("/app/team");
    return ok({ deleted: true });
  } catch (error: unknown) {
    return err("TEAM_FAILED", error instanceof Error ? error.message : "Gagal menghapus anggota.");
  }
}

export async function addCommentAction(eventId: string, body: string, sectionKey?: string): Promise<Result<{ id: string }>> {
  if (body.trim().length < 2) return err("VALIDATION", "Komentar terlalu pendek.");
  try {
    const actor = await requirePermission("comment.write");
    const db = tenantClient(actor.tenantId);
    const comment = await db.comment.create({
      data: { tenantId: actor.tenantId, eventId, authorId: actor.actorId, body: stripTags(body).slice(0, 1000), sectionKey: sectionKey ?? null },
    });
    await audit(actor, "comment.create", "Comment", comment.id, undefined, { eventId });
    return ok({ id: comment.id });
  } catch (error: unknown) {
    return err("COMMENT_FAILED", error instanceof Error ? error.message : "Gagal menambah komentar.");
  }
}

export async function listCommentsAction(eventId: string): Promise<Result<{ id: string; body: string; author: string; createdAt: string; resolved: boolean }[]>> {
  try {
    const actor = await requirePermission("comment.read");
    const db = tenantClient(actor.tenantId);
    const comments = await db.comment.findMany({ where: { eventId, tenantId: actor.tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
    const authors = await prisma.user.findMany({ where: { id: { in: comments.map((row) => row.authorId) } } });
    const byId = new Map(authors.map((user) => [user.id, user.name]));
    return ok(comments.map((row) => ({
      id: row.id, body: row.body, author: byId.get(row.authorId) ?? "Anggota tim",
      createdAt: row.createdAt.toISOString(), resolved: row.resolved,
    })));
  } catch (error: unknown) {
    return err("COMMENT_FAILED", error instanceof Error ? error.message : "Gagal memuat komentar.");
  }
}

export async function resolveCommentAction(eventId: string, commentId: string): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("comment.write");
    await tenantClient(actor.tenantId).comment.update({ where: { id: commentId, tenantId: actor.tenantId }, data: { resolved: true } });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("COMMENT_FAILED", error instanceof Error ? error.message : "Gagal menyelesaikan komentar.");
  }
}
