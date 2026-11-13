import { z } from "zod";
import type { RsvpField, RsvpFormConfig } from "@/lib/types";

export function defaultRsvpForm(): RsvpFormConfig {
  return {
    fields: [
      {
        id: "dietary", type: "select", required: false,
        label: { id: "Preferensi makanan", en: "Meal preference" },
        options: [
          { value: "regular", label: { id: "Reguler", en: "Regular" } },
          { value: "vegetarian", label: { id: "Vegetarian", en: "Vegetarian" } },
          { value: "tanpa-pedas", label: { id: "Tanpa pedas", en: "No chili" } },
        ],
      },
      {
        id: "relation", type: "radio", required: true,
        label: { id: "Hubungan dengan mempelai", en: "Relationship to the couple" },
        options: [
          { value: "keluarga", label: { id: "Keluarga", en: "Family" } },
          { value: "teman", label: { id: "Teman", en: "Friend" } },
          { value: "rekan-kerja", label: { id: "Rekan kerja", en: "Colleague" } },
        ],
      },
      {
        id: "accommodation", type: "checkbox", required: false,
        label: { id: "Saya membutuhkan bantuan akomodasi", en: "I need accommodation assistance" },
        showIf: { fieldId: "relation", operator: "in", value: ["keluarga", "teman"] },
      },
      {
        id: "message", type: "textarea", required: false,
        label: { id: "Pesan untuk mempelai", en: "Message for the couple" },
        placeholder: { id: "Tuliskan doa dan ucapan…", en: "Write your wishes…" },
      },
    ],
    deadlineAt: null,
    paxQuotaPerGuest: 4,
    isClosed: false,
    thankYouMessage: "Terima kasih! Konfirmasi kehadiran Anda sudah kami terima.",
    redirectUrl: null,
    settings: {
      allowMaybe: true,
      allowSessionChoice: true,
      sessions: [
        { id: "sesi-1", label: "Sesi I · 09.00 – 11.00", time: "09:00" },
        { id: "sesi-2", label: "Sesi II · 12.00 – 14.00", time: "12:00" },
      ],
      mealChoices: ["Ayam bakar", "Ikan bakar", "Vegetarian"],
      maxPax: 10,
      requirePhone: false,
      autoCloseAtDeadline: true,
      locales: ["id", "en"],
    },
    locales: {},
  };
}

export function parseRsvpForm(raw: unknown): RsvpFormConfig {
  const base = defaultRsvpForm();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<RsvpFormConfig>;
  return {
    ...base,
    ...input,
    fields: Array.isArray(input.fields) ? (input.fields as RsvpField[]) : base.fields,
    settings: { ...base.settings, ...(input.settings ?? {}) },
    locales: input.locales && typeof input.locales === "object" ? input.locales : {},
  };
}

export function conditionMatches(condition: RsvpField["showIf"], answers: Record<string, unknown>): boolean {
  if (!condition) return true;
  const raw = answers[condition.fieldId];
  const value = Array.isArray(raw) ? raw.join(",") : raw == null ? "" : String(raw);
  switch (condition.operator) {
    case "equals": return Array.isArray(condition.value) ? condition.value.includes(value) : value === condition.value;
    case "notEquals": return Array.isArray(condition.value) ? !condition.value.includes(value) : value !== condition.value;
    case "contains": return value.toLowerCase().includes(String(condition.value).toLowerCase());
    case "in": return (Array.isArray(condition.value) ? condition.value : [condition.value]).includes(value);
    default: return true;
  }
}

export function visibleFields(fields: readonly RsvpField[], answers: Record<string, unknown>): RsvpField[] {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const visible: RsvpField[] = [];
  for (const field of fields) {
    if (!field.showIf) { visible.push(field); continue; }
    const parent = byId.get(field.showIf.fieldId);
    if (!parent) continue;
    if (visible.some((candidate) => candidate.id === parent.id) && conditionMatches(field.showIf, answers)) visible.push(field);
  }
  return visible;
}

function fieldSchema(field: RsvpField, locale: "id" | "en"): z.ZodTypeAny {
  const label = field.label[locale] ?? field.label.id ?? field.id;
  let base: z.ZodTypeAny;
  switch (field.type) {
    case "number": {
      let schema = z.coerce.number({ invalid_type_error: `${label} harus berupa angka.` });
      if (field.min !== undefined) schema = schema.min(field.min, `${label} minimal ${field.min}.`) as z.ZodNumber;
      if (field.max !== undefined) schema = schema.max(field.max, `${label} maksimal ${field.max}.`) as z.ZodNumber;
      base = schema;
      break;
    }
    case "checkbox": base = z.boolean(); break;
    case "multiselect": base = z.array(z.string()).max(30); break;
    case "email": base = z.string().email(`${label} tidak valid.`); break;
    case "phone": base = z.string().regex(/^[+0-9\s()-]{6,20}$/, `${label} tidak valid.`); break;
    case "date": base = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} tidak valid.`); break;
    case "file": base = z.string().max(500); break;
    default: base = z.string().max(2000);
  }
  if (field.pattern && field.type !== "number" && field.type !== "checkbox" && field.type !== "multiselect") {
    try {
      const regex = new RegExp(field.pattern);
      base = (base as z.ZodString).regex(regex, `${label} tidak sesuai format.`);
    } catch {
      // Pattern tidak valid diabaikan daripada menolak seluruh RSVP.
    }
  }
  if (field.options && field.options.length > 0 && ["select", "radio"].includes(field.type)) {
    const allowed = field.options.map((option) => option.value);
    base = z.string().refine((value) => allowed.includes(value), `${label} tidak termasuk pilihan.`);
  }
  if (!field.required) return base.optional().or(z.literal("")).or(z.literal(false));
  if (field.type === "checkbox") return z.literal(true, { errorMap: () => ({ message: `${label} wajib dicentang.` }) });
  if (field.type === "multiselect") return z.array(z.string()).min(1, `${label} wajib dipilih.`);
  return z.string().min(1, `${label} wajib diisi.`).pipe(base);
}

export function buildAnswersSchema(fields: readonly RsvpField[], answers: Record<string, unknown>, locale: "id" | "en" = "id"): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const field of visibleFields(fields, answers)) shape[field.id] = fieldSchema(field, locale);
  return z.object(shape);
}

export const rsvpBaseSchema = z.object({
  status: z.enum(["ATTENDING", "DECLINED", "MAYBE"]),
  pax: z.coerce.number().int().min(1).max(20),
  sessionId: z.string().max(80).optional().nullable(),
  mealChoice: z.string().max(120).optional().nullable(),
  attendanceNote: z.string().max(1000).optional().nullable(),
  answers: z.record(z.unknown()).default({}),
  consent: z.literal(true, { errorMap: () => ({ message: "Persetujuan privasi wajib dicentang." }) }),
  website: z.string().max(0).optional(), // honeypot bot protection
});

export type RsvpBaseInput = z.infer<typeof rsvpBaseSchema>;

export interface QuotaInput {
  paxQuotaPerGuest: number;
  paxAllocated: number;
  maxPax: number;
  requestedPax: number;
}

export function validatePaxQuota(input: QuotaInput): { valid: boolean; reason?: string; effective: number } {
  const { paxQuotaPerGuest, paxAllocated, maxPax, requestedPax } = input;
  const effective = Math.min(Math.max(paxQuotaPerGuest, 1), Math.max(paxAllocated, 1), Math.max(maxPax, 1));
  if (!Number.isInteger(requestedPax) || requestedPax < 1) return { valid: false, reason: "Jumlah tamu minimal 1.", effective };
  if (requestedPax > effective) return { valid: false, reason: `Kuota undangan ini ${effective} orang.`, effective };
  return { valid: true, effective };
}

export function isRsvpOpen(form: RsvpFormConfig, now: Date = new Date()): boolean {
  if (form.isClosed) return false;
  if (!form.deadlineAt) return true;
  const deadline = new Date(form.deadlineAt);
  return Number.isNaN(deadline.getTime()) || now < deadline;
}

export function validateRsvpSubmission(
  form: RsvpFormConfig,
  input: unknown,
  paxAllocated: number,
  now: Date = new Date(),
  locale: "id" | "en" = "id",
): { success: true; data: RsvpBaseInput & { effectiveQuota: number } } | { success: false; errors: string[] } {
  const parsed = rsvpBaseSchema.safeParse(input);
  if (!parsed.success) return { success: false, errors: parsed.error.issues.map((issue) => issue.message) };
  if (!isRsvpOpen(form, now)) return { success: false, errors: ["Form RSVP sudah ditutup."] };
  const data = parsed.data;
  const quota = validatePaxQuota({
    paxQuotaPerGuest: form.paxQuotaPerGuest,
    paxAllocated,
    maxPax: form.settings.maxPax,
    requestedPax: data.status === "DECLINED" ? 1 : data.pax,
  });
  if (!quota.valid) return { success: false, errors: [quota.reason ?? "Kuota tidak mencukupi."] };
  const answers = data.answers as Record<string, unknown>;
  const answersResult = buildAnswersSchema(form.fields, answers, locale).safeParse(answers);
  if (!answersResult.success) {
    return { success: false, errors: answersResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  return { success: true, data: { ...data, answers: answersResult.data as Record<string, unknown>, effectiveQuota: quota.effective } };
}
