import type { InvitationData, SectionItem } from "@/types";

type Cat = { heading: string; opening: string; closing: string; eventNames: string[]; single: boolean; one: string; two: string };

const WEDDING_OPEN = "Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan acara pernikahan putra-putri kami.";
const CATS: Record<string, Cat> = {
  wedding: { heading: "The Wedding Of", opening: WEDDING_OPEN, closing: "Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu. Terima kasih atas perhatian dan doanya.", eventNames: ["Akad Nikah", "Resepsi"], single: false, one: "Andi Pratama", two: "Siti Nurhaliza" },
  engagement: { heading: "Our Engagement", opening: "Dengan penuh syukur, kami mengundang Anda untuk menjadi saksi acara lamaran dan pertunangan kami.", closing: "Kehadiran dan doa Anda akan menjadi kebahagiaan tersendiri bagi kami.", eventNames: ["Lamaran", "Makan Bersama"], single: false, one: "Rafi Ahmad", two: "Dewi Lestari" },
  anniversary: { heading: "Happy Anniversary", opening: "Dua puluh lima tahun bersama dalam suka dan duka. Mari rayakan perjalanan cinta kami.", closing: "Terima kasih telah menjadi bagian dari perjalanan kami.", eventNames: ["Ibadah Syukur", "Perayaan"], single: false, one: "Hendra", two: "Marlina" },
  khitan: { heading: "Tasyakuran Khitanan", opening: "Assalamu'alaikum Wr. Wb. Dengan rahmat Allah SWT, kami mengundang Bapak/Ibu/Saudara/i pada acara khitanan putra kami.", closing: "Atas kehadiran dan doa restunya kami ucapkan terima kasih. Wassalamu'alaikum Wr. Wb.", eventNames: ["Khitanan", "Syukuran"], single: true, one: "Muhammad Fadhil", two: "" },
  aqiqah: { heading: "Aqiqah & Tasyakuran", opening: "Dengan rasa syukur atas kelahiran buah hati kami, kami mengundang Anda untuk hadir pada acara aqiqah.", closing: "Semoga anak kami menjadi anak yang sholeh/sholehah. Terima kasih atas doa dan kehadiran Anda.", eventNames: ["Aqiqah", "Makan Bersama"], single: true, one: "Aisyah Zahra", two: "" },
  birthday: { heading: "You're Invited", opening: "Yuk rayakan hari ulang tahun yang istimewa bersama kami! Akan ada banyak keseruan.", closing: "Sampai jumpa di pesta! Jangan lupa bawa senyum terbaikmu.", eventNames: ["Pesta Ulang Tahun", "Tiup Lilin"], single: true, one: "Kayla Putri", two: "" },
  graduation: { heading: "Graduation Day", opening: "Dengan bangga kami mengundang Anda untuk merayakan kelulusan dan wisuda.", closing: "Terima kasih atas dukungan dan doa yang tak pernah putus.", eventNames: ["Prosesi Wisuda", "Syukuran Kelulusan"], single: true, one: "Rizky Maulana, S.T.", two: "" },
  "baby-shower": { heading: "Baby Shower", opening: "Kami menantikan hadirnya buah hati. Mari berbagi kebahagiaan dan doa bersama kami.", closing: "Terima kasih telah menjadi bagian dari kebahagiaan kami.", eventNames: ["Baby Shower", "Games & Makan"], single: false, one: "Rina", two: "Bagas" },
  event: { heading: "You Are Invited", opening: "Kami dengan hormat mengundang Anda untuk hadir pada acara kami.", closing: "Kami menantikan kehadiran Anda. Terima kasih.", eventNames: ["Acara Utama", "Networking"], single: true, one: "Annual Gathering 2026", two: "" },
};

export const catDefaults = (slug: string) => CATS[slug] ?? CATS.event;
export const IMG_COUPLE = "/images/couple.jpg";

function nextWeekend(days = 30) {
  const d = new Date(Date.now() + days * 86400_000);
  return d.toISOString().slice(0, 10);
}

export function defaultInvitationData(catSlug: string, names?: [string, string]): InvitationData {
  const c = catDefaults(catSlug);
  const one = names?.[0] || c.one;
  const two = names?.[1] ?? c.two;
  const date = nextWeekend(30);
  const host = (name: string, parents: string): InvitationData["host1"] => ({ name: name.split(" ")[0], fullName: name, parents, bio: "", photo: "" });
  return {
    eventType: catSlug,
    heading: c.heading,
    opening: c.opening,
    host1: host(one, c.single ? "Putra/putri dari Bapak Fulan & Ibu Fulanah" : "Putra dari Bapak Budi Santoso & Ibu Ratna Dewi"),
    host2: host(two, c.single ? "" : "Putri dari Bapak Hasan Basri & Ibu Aminah"),
    date: `${date}T08:00`,
    coverPhoto: "",
    events: c.eventNames.map((n, i) => ({
      name: n, date, time: i === 0 ? "08:00" : "11:00", endTime: i === 0 ? "10:00" : "14:00",
      place: "Gedung Serbaguna Melati", address: "Jl. Merdeka No. 12, Jakarta Pusat",
      mapUrl: "https://maps.google.com/?q=Monas+Jakarta", note: i === 0 ? "Mohon hadir tepat waktu." : "Menu prasmanan dan dessert.",
    })),
    story: c.single ? [] : [
      { date: "2019", title: "Pertama Bertemu", text: "Kami bertemu di sebuah acara kampus dan memulai obrolan yang tak pernah selesai.", photo: "" },
      { date: "2022", title: "Menjalin Komitmen", text: "Setelah tiga tahun saling mengenal, kami memutuskan untuk melangkah lebih serius.", photo: "" },
      { date: "2026", title: "Menikah", text: "Dengan restu keluarga, kami melangkah ke jenjang pernikahan.", photo: "" },
    ],
    gallery: [],
    videoUrl: "", videoPoster: "",
    streamUrl: "", streamPlatform: "YouTube", streamSchedule: "",
    locationName: "Gedung Serbaguna Melati", address: "Jl. Merdeka No. 12, Jakarta Pusat",
    mapUrl: "https://maps.google.com/?q=Monas+Jakarta",
    mapEmbed: "https://www.google.com/maps?q=Monas+Jakarta&output=embed",
    directions: "Parkir tersedia di basement. Dekat stasiun MRT terdekat (5 menit jalan kaki).",
    gifts: [
      { type: "bank", provider: "BCA", number: "1234567890", holder: one, qr: "" },
      { type: "ewallet", provider: "GoPay", number: "081234567890", holder: one, qr: "" },
    ],
    giftAddress: "",
    musicUrl: "", musicTitle: "",
    rsvpDeadline: new Date(Date.now() + 25 * 86400_000).toISOString().slice(0, 10),
    closing: c.closing,
    family: c.single ? "Keluarga Besar" : "Keluarga Besar Kedua Mempelai",
    footerText: "",
  };
}

export const DEFAULT_SECTION_ORDER = ["cover", "intro", "countdown", "events", "calendar", "story", "gallery", "video", "location", "live", "rsvp", "wishes", "gift", "closing", "footer"];
export const defaultSections = (): SectionItem[] =>
  DEFAULT_SECTION_ORDER.map((key) => ({ key, enabled: !["video", "live"].includes(key) }));
