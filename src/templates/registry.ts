import type { TemplateConfig, Tier, Palette } from "@/types";

export type TemplateSeed = {
  slug: string; name: string; cat: string; style: string; tier: Tier; price: number; desc: string;
  featured?: boolean; isNew?: boolean; pop: number; tags: string[]; cfg: TemplateConfig;
};

const P = (bg: string, surface: string, text: string, muted: string, accent: string, accent2: string): Palette => ({ bg, surface, text, muted, accent, accent2 });
const C = (pal: Palette, head: string, body: string, script: string, cover: TemplateConfig["cover"], orn: TemplateConfig["orn"],
  gal: TemplateConfig["gal"], anim: TemplateConfig["anim"], btn: TemplateConfig["btn"], ev: TemplateConfig["ev"], dark = false, rad = 12): TemplateConfig =>
  ({ pal, head, body, script, cover, orn, gal, anim, btn, ev, dark, rad });

// Setiap template memiliki kombinasi cover, ornamen, galeri, animasi, tombol, layout acara, tipografi & palet yang berbeda.
export const TEMPLATE_SEEDS: TemplateSeed[] = [
  { slug: "modern-minimalist", name: "Modern Minimalist", cat: "wedding", style: "Minimalis", tier: "free", price: 0, pop: 96, featured: true, tags: ["minimalis", "putih", "modern"], desc: "Tipografi besar, ruang putih lega, dan garis tipis yang bersih.",
    cfg: C(P("#fafafa", "#ffffff", "#111111", "#6b7280", "#111111", "#9ca3af"), "Jost", "Jost", "Jost", "type", "line", "grid", "fade", "underline", "split", false, 0) },
  { slug: "elegant-white", name: "Elegant White", cat: "wedding", style: "Elegan", tier: "free", price: 0, pop: 90, tags: ["putih", "elegan", "klasik"], desc: "Putih bersih dengan aksen emas tipis dan tulisan tangan yang anggun.",
    cfg: C(P("#fbfaf7", "#ffffff", "#2b2b2b", "#7a7468", "#b08d57", "#d9c7a3"), "Cormorant Garamond", "Lora", "Great Vibes", "center", "gold", "polaroid", "fade", "pill", "cards", false, 16) },
  { slug: "luxury-gold", name: "Luxury Gold", cat: "wedding", style: "Mewah", tier: "premium", price: 25000, pop: 99, featured: true, tags: ["emas", "mewah", "gelap"], desc: "Latar hitam pekat dengan ornamen emas berkilau untuk kesan eksklusif.",
    cfg: C(P("#0f0d0a", "#1a1712", "#f3e9d2", "#a89a7a", "#d4af37", "#8a6d1d"), "Cinzel", "Cormorant Garamond", "Pinyon Script", "frame", "gold", "slider", "zoom", "outline", "ticket", true, 4) },
  { slug: "royal-classic", name: "Royal Classic", cat: "wedding", style: "Kerajaan", tier: "premium", price: 25000, pop: 84, tags: ["biru tua", "kerajaan", "klasik"], desc: "Biru navy dan emas dengan bingkai kerajaan yang megah.",
    cfg: C(P("#0e1b3d", "#15275a", "#f4ecd8", "#b4b9cc", "#e0b65c", "#9c7a2e"), "Playfair Display", "Libre Baskerville", "Allura", "frame", "geo", "mosaic", "rise", "square", "timeline", true, 2) },
  { slug: "floral-romantic", name: "Floral Romantic", cat: "wedding", style: "Floral", tier: "basic", price: 0, pop: 93, featured: true, tags: ["bunga", "romantis", "pink"], desc: "Rangkaian bunga lembut yang membingkai setiap bagian undangan.",
    cfg: C(P("#fff5f5", "#ffffff", "#5a2a35", "#a1707b", "#c9546e", "#f2b8c6"), "Playfair Display", "Nunito", "Dancing Script", "arch", "floral", "polaroid", "rise", "pill", "cards", false, 24) },
  { slug: "botanical-garden", name: "Botanical Garden", cat: "wedding", style: "Botani", tier: "basic", price: 0, pop: 82, tags: ["hijau", "daun", "alami"], desc: "Daun hijau segar dengan nuansa kebun botani yang menenangkan.",
    cfg: C(P("#f3f6ef", "#ffffff", "#24382a", "#6a7d6e", "#3f7a52", "#a9c9a4"), "Fraunces", "Nunito", "Satisfy", "center", "leaf", "masonry", "rise", "soft", "timeline", false, 20) },
  { slug: "rustic-wood", name: "Rustic", cat: "wedding", style: "Rustic", tier: "basic", price: 0, pop: 70, tags: ["rustic", "coklat", "hangat"], desc: "Nuansa kayu hangat, tipografi tegas, dan sentuhan handmade.",
    cfg: C(P("#efe6d8", "#f8f1e5", "#4a3524", "#8b7358", "#9a5b2e", "#c9a67a"), "Abril Fatface", "Lora", "Caveat", "split", "dots", "polaroid", "slide", "square", "ticket", false, 6) },
  { slug: "vintage-letter", name: "Vintage", cat: "wedding", style: "Vintage", tier: "basic", price: 0, pop: 68, tags: ["vintage", "retro", "sepia"], desc: "Gaya surat tua dengan warna sepia dan tekstur kertas klasik.",
    cfg: C(P("#e9dcc3", "#f3e9d3", "#3f2f1d", "#85704f", "#8c3b2a", "#c79a5a"), "Libre Baskerville", "EB Garamond", "Sacramento", "frame", "marble", "film", "fade", "outline", "timeline", false, 3) },
  { slug: "contemporary-bold", name: "Contemporary", cat: "wedding", style: "Kontemporer", tier: "basic", price: 0, pop: 76, tags: ["modern", "tegas", "geometris"], desc: "Blok warna tegas dan bentuk geometris untuk pasangan modern.",
    cfg: C(P("#f4f1ea", "#ffffff", "#1f1f1f", "#6f6f6f", "#e4572e", "#f3a712"), "Syne", "DM Sans", "Syne", "split", "geo", "mosaic", "slide", "square", "cards", false, 8) },
  { slug: "korean-minimalist", name: "Korean Minimalist", cat: "wedding", style: "Korea", tier: "basic", price: 0, pop: 88, isNew: true, tags: ["korea", "soft", "minimalis"], desc: "Lembut, bersih, dan hangat ala foto pre-wedding Korea.",
    cfg: C(P("#f7f3ee", "#fffdfa", "#3a3631", "#8d867c", "#8a7a68", "#d9cfc2"), "Noto Serif KR", "Noto Sans KR", "Noto Serif KR", "circle", "dots", "grid", "blur", "soft", "split", false, 18) },
  { slug: "japanese-minimalist", name: "Japanese Minimalist", cat: "wedding", style: "Jepang", tier: "premium", price: 25000, pop: 74, tags: ["jepang", "zen", "sakura"], desc: "Ketenangan zen dengan sapuan merah dan ruang kosong yang disengaja.",
    cfg: C(P("#f6f2ea", "#fbf8f2", "#222222", "#7b756a", "#b3262e", "#d8d0c0"), "Noto Serif JP", "Noto Sans JP", "Noto Serif JP", "type", "stars", "film", "fade", "underline", "timeline", false, 0) },
  { slug: "islamic-elegant", name: "Islamic Elegant", cat: "wedding", style: "Islami", tier: "basic", price: 0, pop: 97, featured: true, tags: ["islami", "hijau", "emas"], desc: "Ornamen bintang islami dengan hijau zamrud dan emas lembut.",
    cfg: C(P("#f4f7f1", "#ffffff", "#17382b", "#5d7a6b", "#1f6b4f", "#c8a85a"), "Amiri", "Lora", "Scheherazade New", "arch", "islamic", "grid", "rise", "pill", "cards", false, 18) },
  { slug: "islamic-luxury", name: "Islamic Luxury", cat: "wedding", style: "Islami Mewah", tier: "exclusive", price: 50000, pop: 95, featured: true, tags: ["islami", "hitam", "emas"], desc: "Hijau tua pekat dengan pola arabesque emas dan efek berkilau.",
    cfg: C(P("#07231a", "#0d3326", "#f2e6c4", "#a9bfb2", "#d9b45a", "#8f7430"), "Cinzel", "Amiri", "Scheherazade New", "arch", "islamic", "slider", "zoom", "outline", "ticket", true, 10) },
  { slug: "traditional-indonesia", name: "Traditional Indonesia", cat: "wedding", style: "Nusantara", tier: "premium", price: 25000, pop: 80, tags: ["nusantara", "batik", "adat"], desc: "Perpaduan merah marun dan emas dengan motif batik nusantara.",
    cfg: C(P("#4a0f14", "#5e1a1f", "#f6e7c8", "#d1b48a", "#e6b84a", "#b8862b"), "Playfair Display", "Lora", "Pinyon Script", "frame", "batik", "mosaic", "rise", "square", "timeline", true, 4) },
  { slug: "javanese-traditional", name: "Javanese Traditional", cat: "wedding", style: "Jawa", tier: "premium", price: 25000, pop: 78, tags: ["jawa", "soga", "batik"], desc: "Warna soga klasik dengan motif kawung dan tata letak adat Jawa.",
    cfg: C(P("#3b2417", "#4d3020", "#f1dfbc", "#c4a77c", "#d6a24a", "#a2742a"), "Marcellus", "EB Garamond", "Tangerine", "center", "batik", "film", "slide", "outline", "ticket", true, 2) },
  { slug: "sundanese-traditional", name: "Sundanese Traditional", cat: "wedding", style: "Sunda", tier: "premium", price: 25000, pop: 66, tags: ["sunda", "hijau", "kujang"], desc: "Nuansa hijau daun dan krem dengan ornamen khas tatar Sunda.",
    cfg: C(P("#eef2e2", "#f8faef", "#2e3b1f", "#78876a", "#5b7f2b", "#c9a24b"), "Philosopher", "Cardo", "Satisfy", "split", "leaf", "masonry", "fade", "soft", "split", false, 14) },
  { slug: "modern-dark", name: "Modern Dark", cat: "wedding", style: "Gelap Modern", tier: "basic", price: 0, pop: 85, tags: ["gelap", "modern", "neon"], desc: "Tampilan gelap modern dengan aksen biru elektrik.",
    cfg: C(P("#0b0e14", "#141925", "#e8ecf4", "#8993a8", "#5b8cff", "#2a3a66"), "Space Grotesk", "Inter", "Space Grotesk", "full", "line", "grid", "blur", "outline", "cards", true, 14) },
  { slug: "black-gold", name: "Black Gold", cat: "wedding", style: "Hitam Emas", tier: "exclusive", price: 50000, pop: 92, isNew: true, tags: ["hitam", "emas", "eksklusif"], desc: "Kontras hitam dan emas dengan garis art deco yang berkelas.",
    cfg: C(P("#000000", "#111111", "#f5e7b8", "#9d8f63", "#f0c24b", "#7a5e12"), "Italiana", "Raleway", "Parisienne", "frame", "geo", "slider", "zoom", "pill", "ticket", true, 0) },
  { slug: "pastel-dream", name: "Pastel", cat: "baby-shower", style: "Pastel", tier: "free", price: 0, pop: 79, tags: ["pastel", "ceria", "bayi"], desc: "Warna pastel ceria dengan awan dan bintang kecil yang lucu.",
    cfg: C(P("#fdf4fb", "#ffffff", "#4b3a5a", "#9a86ab", "#b18ae0", "#9fd8e8"), "Quicksand", "Nunito", "Sacramento", "circle", "stars", "polaroid", "zoom", "pill", "cards", false, 28) },
  { slug: "soft-romantic", name: "Soft Romantic", cat: "engagement", style: "Romantis Lembut", tier: "basic", price: 0, pop: 83, tags: ["blush", "lembut", "tunangan"], desc: "Rona blush dan gelombang lembut untuk acara lamaran & tunangan.",
    cfg: C(P("#fdeeee", "#fff8f6", "#6b3a3a", "#b08585", "#d97c86", "#f6c9c4"), "Cormorant Garamond", "Nunito", "Allura", "stack", "wave", "masonry", "blur", "soft", "timeline", false, 22) },
  { slug: "editorial-magazine", name: "Editorial", cat: "wedding", style: "Editorial", tier: "premium", price: 25000, pop: 81, tags: ["majalah", "tipografi", "foto"], desc: "Tata letak majalah dengan judul serif raksasa dan foto penuh.",
    cfg: C(P("#f2efe9", "#ffffff", "#141414", "#6e6a62", "#141414", "#c9c2b4"), "DM Serif Display", "Inter", "DM Serif Display", "type", "line", "mosaic", "slide", "underline", "split", false, 0) },
  { slug: "artistic-brush", name: "Artistic", cat: "birthday", style: "Artistik", tier: "basic", price: 0, pop: 72, tags: ["seni", "warna", "ulang tahun"], desc: "Sapuan kuas penuh warna untuk ulang tahun yang ekspresif.",
    cfg: C(P("#fff8ec", "#ffffff", "#2d2a4a", "#7a7699", "#ff6b6b", "#4ecdc4"), "Abril Fatface", "Quicksand", "Caveat", "stack", "dots", "polaroid", "flip", "pill", "ticket", false, 20) },
  { slug: "watercolor-bloom", name: "Watercolor", cat: "aqiqah", style: "Cat Air", tier: "basic", price: 0, pop: 77, tags: ["cat air", "biru", "aqiqah"], desc: "Semburat cat air biru dan mint yang menenangkan untuk aqiqah.",
    cfg: C(P("#eef7fb", "#ffffff", "#2a4a5c", "#6f93a6", "#4a9bc0", "#bde3f0"), "Playfair Display", "Nunito", "Dancing Script", "arch", "wave", "grid", "blur", "soft", "cards", false, 26) },
  { slug: "luxury-marble", name: "Luxury Marble", cat: "anniversary", style: "Marmer", tier: "premium", price: 25000, pop: 75, tags: ["marmer", "abu", "emas"], desc: "Tekstur marmer putih berurat dengan detail emas untuk anniversary.",
    cfg: C(P("#eceae6", "#f8f7f4", "#2a2a2a", "#7d7a74", "#a88747", "#cfc8ba"), "Cormorant Garamond", "Raleway", "Pinyon Script", "center", "marble", "slider", "fade", "outline", "timeline", false, 2) },
  { slug: "cinematic-night", name: "Cinematic", cat: "event", style: "Sinematik", tier: "exclusive", price: 50000, pop: 87, isNew: true, tags: ["film", "malam", "event"], desc: "Layout lebar ala poster film dengan strip foto dan judul dramatis.",
    cfg: C(P("#0a0a0f", "#15151f", "#f2f2f2", "#8a8a99", "#ff4d4d", "#3b3b55"), "Bebas Neue", "Inter", "Bebas Neue", "full", "line", "film", "zoom", "square", "ticket", true, 0) },
  { slug: "modern-typography", name: "Modern Typography", cat: "graduation", style: "Tipografi", tier: "free", price: 0, pop: 73, tags: ["tipografi", "wisuda", "tegas"], desc: "Huruf besar tebal sebagai elemen utama, cocok untuk wisuda.",
    cfg: C(P("#fff200", "#ffffff", "#111111", "#444444", "#111111", "#ffe14a"), "Bebas Neue", "Space Grotesk", "Bebas Neue", "type", "none", "mosaic", "slide", "square", "cards", false, 0) },
  { slug: "garden-wedding", name: "Garden Wedding", cat: "wedding", style: "Garden Party", tier: "basic", price: 0, pop: 86, tags: ["taman", "outdoor", "hijau muda"], desc: "Pesta kebun outdoor dengan daun dan bunga liar yang segar.",
    cfg: C(P("#f6faf0", "#ffffff", "#314a2e", "#7c9478", "#6aa84f", "#f4c2c2"), "Fraunces", "Nunito", "Parisienne", "arch", "leaf", "masonry", "rise", "pill", "split", false, 22) },
  { slug: "beach-wedding", name: "Beach Wedding", cat: "wedding", style: "Pantai", tier: "premium", price: 25000, pop: 89, tags: ["pantai", "biru", "pasir"], desc: "Ombak biru, pasir hangat, dan angin laut untuk pernikahan pantai.",
    cfg: C(P("#fdf6ea", "#ffffff", "#0e4a63", "#6a95a8", "#1b8fb3", "#f2d9a8"), "Josefin Sans", "Nunito", "Sacramento", "full", "wave", "slider", "slide", "pill", "cards", false, 18) },
  { slug: "classic-european", name: "Classic European", cat: "wedding", style: "Eropa Klasik", tier: "exclusive", price: 50000, pop: 91, tags: ["eropa", "baroque", "burgundy"], desc: "Gaya baroque Eropa dengan burgundy, krem, dan bingkai berukir.",
    cfg: C(P("#f3ebdc", "#fbf5e8", "#4a1521", "#8b6a6f", "#7a1f33", "#c8a96a"), "Playfair Display", "EB Garamond", "Pinyon Script", "frame", "floral", "film", "flip", "outline", "timeline", false, 2) },
  { slug: "premium-exclusive", name: "Premium Exclusive", cat: "wedding", style: "Eksklusif", tier: "exclusive", price: 50000, pop: 98, featured: true, isNew: true, tags: ["eksklusif", "champagne", "premium"], desc: "Koleksi puncak: champagne, kaca buram, dan animasi sinematik halus.",
    cfg: C(P("#1c1917", "#292524", "#f5ede0", "#b3a794", "#e8c99b", "#8c6d3f"), "Marcellus", "Raleway", "Allura", "circle", "stars", "mosaic", "blur", "pill", "ticket", true, 20) },
  { slug: "khitan-ceria", name: "Khitan Ceria", cat: "khitan", style: "Khitanan", tier: "free", price: 0, pop: 71, tags: ["khitan", "biru", "anak"], desc: "Biru langit dan hijau segar dengan nuansa islami yang ceria untuk khitanan.",
    cfg: C(P("#eaf6ff", "#ffffff", "#17405f", "#5d86a3", "#1f7ac0", "#7fd1a8"), "Quicksand", "Nunito", "Satisfy", "circle", "islamic", "grid", "zoom", "pill", "cards", false, 24) },
];

export const TEMPLATE_COUNT = TEMPLATE_SEEDS.length;
