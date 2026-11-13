export interface BlastVariables {
  nama: string;
  link: string;
  acara: string;
  pic_nama: string;
  pic_hp: string;
  tanggal: string;
  grup: string;
  pax: string;
}

export const BLAST_VARIABLE_KEYS: readonly (keyof BlastVariables)[] = [
  "nama", "link", "acara", "pic_nama", "pic_hp", "tanggal", "grup", "pax",
] as const;

export function renderTemplate(template: string, variables: Partial<BlastVariables>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (!BLAST_VARIABLE_KEYS.includes(key as keyof BlastVariables)) return match;
    return variables[key as keyof BlastVariables] ?? "";
  });
}

export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const key = match[1];
    if (key) found.add(key);
  }
  return [...found];
}

export function defaultBlastTemplate(): string {
  return "Assalamu'alaikum {{nama}},\n\nDengan hormat kami mengundang Bapak/Ibu/Saudara/i ke acara {{acara}}.\n\nUndangan personal: {{link}}\n\nKonfirmasi kehadiran dapat dibalas melalui pesan ini atau menghubungi {{pic_nama}} di {{pic_hp}}.\n\nTerima kasih atas perhatiannya.";
}
