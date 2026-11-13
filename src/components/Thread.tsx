import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketMessages, users } from "@/db/schema";
import { dateID } from "@/lib/format";

export async function Thread({ ticketId }: { ticketId: number }) {
  const msgs = await db.select({ m: ticketMessages, name: users.name }).from(ticketMessages).leftJoin(users, eq(ticketMessages.userId, users.id)).where(eq(ticketMessages.ticketId, ticketId)).orderBy(asc(ticketMessages.createdAt));
  return (
    <div className="space-y-3">
      {msgs.map(({ m, name }) => (
        <div key={m.id} className={`flex ${m.isStaff ? "justify-start" : "justify-end"}`}>
          <div className={`max-w-[88%] rounded-2xl p-3 text-sm ${m.isStaff ? "bg-white shadow-sm ring-1 ring-stone-200" : "bg-stone-900 text-white"}`}>
            <p className={`text-[11px] font-semibold ${m.isStaff ? "text-amber-700" : "text-amber-300"}`}>{name} {m.isStaff && "· Tim Support"}</p>
            <p className="mt-1 whitespace-pre-line">{m.body}</p>
            {m.attachment && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.attachment} alt="Lampiran" className="mt-2 max-h-48 rounded-lg" />}
            <p className="mt-1 text-[10px] opacity-60">{dateID(m.createdAt, true)}</p>
          </div>
        </div>))}
    </div>
  );
}
