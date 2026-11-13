# Panduan Template
Template = **konfigurasi data** (`TemplateConfig`), bukan halaman statis. Renderer ada di `src/components/invitation/`.

| Properti | Pilihan |
|---|---|
| `cover` | center, split, frame, arch, stack, type, full, circle |
| `orn` (ornamen) | floral, leaf, geo, islamic, batik, wave, marble, line, dots, gold, stars, none |
| `gal` | grid, masonry, polaroid, slider, film, mosaic |
| `anim` | fade, rise, zoom, blur, slide, flip |
| `btn` | pill, square, outline, underline, soft |
| `ev` | cards, timeline, split, ticket |
| `pal` | bg, surface, text, muted, accent, accent2 |
| `head/body/script` | nama font Google Fonts |
| `dark`, `rad` | tema gelap, radius sudut |

## Menambah template
- **Via Admin**: Template → Tambah template (form memuat semua opsi di atas, section yang didukung, tier, harga, fitur).
- **Via kode**: tambahkan objek di `src/templates/registry.ts` (hanya untuk database baru; database yang sudah ter-seed tidak otomatis ter-update — gunakan Admin).
- Tier menentukan paket minimum untuk menerbitkan. `price` = biaya tambahan di atas harga paket.
- Tes `tests/integration/templates.test.ts` memastikan tidak ada dua template dengan kombinasi desain identik.

## Menambah varian baru
Tambah nilai pada tipe di `src/types/index.ts`, implementasi di `Cover.tsx` / `Sections.tsx` / `Ornaments.tsx` / `theme.ts`, dan daftarkan di form admin (`src/app/admin/templates/[id]/page.tsx`) serta editor (`panels.tsx`).

Font premium: pastikan Anda memiliki lisensi sebelum memakai font non-Google.
