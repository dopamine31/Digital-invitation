import { EventWizard } from "@/components/dashboard/EventWizard";

export const metadata = { title: "Buat acara baru" };
export const dynamic = "force-dynamic";

export default function NewEventPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Buat acara baru</h1><p className="page-subtitle">Empat langkah cepat: jenis acara → tema → data & PIC → siap diedit.</p></div>
      </div>
      <EventWizard />
    </div>
  );
}
