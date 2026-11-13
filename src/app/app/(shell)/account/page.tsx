import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { AccountForms } from "@/components/AccountForms";
import { PageHeader } from "@/components/ui";
import { logoutAction } from "@/server/actions/auth";

export const metadata = { title: "Akun Saya" };

export default async function AccountPage() {
  const u = await requireCustomer();
  return (
    <>
      <PageHeader title="Akun Saya" subtitle="Profil, keamanan, dan riwayat." />
      <AccountForms user={{ name: u.name, email: u.email, phone: u.phone ?? "", avatar: u.avatar ?? "" }} />
      <div className="mt-5 flex flex-wrap gap-2"><Link className="btn btn-ghost" href="/app/orders">Riwayat transaksi & pesanan</Link><Link className="btn btn-ghost" href="/app/templates?show=fav">Template favorit</Link><Link className="btn btn-ghost" href="/app/notifications">Notifikasi</Link>
        <form action={logoutAction}><button className="btn btn-danger">Keluar</button></form></div>
    </>
  );
}
