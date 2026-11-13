import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("customer"), // owner | staff | customer
  phone: text("phone").default(""),
  avatar: text("avatar").default(""),
  status: text("status").notNull().default("active"), // active | blocked
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  note: text("note").default(""),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  icon: text("icon").default("✨"),
  sortOrder: integer("sort_order").default(0),
}, (t) => [uniqueIndex("categories_slug_idx").on(t.slug)]);

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  style: text("style").default(""),
  description: text("description").default(""),
  price: integer("price").notNull().default(0), // biaya tambahan template
  tier: text("tier").notNull().default("free"), // free | basic | premium | exclusive
  featured: boolean("featured").default(false),
  isNew: boolean("is_new").default(false),
  popularity: integer("popularity").default(0),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  sections: jsonb("sections").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("published"),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("templates_slug_idx").on(t.slug), index("templates_cat_idx").on(t.categoryId)]);

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  price: integer("price").notNull().default(0),
  promoPrice: integer("promo_price"),
  durationDays: integer("duration_days").notNull().default(30),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  entitlements: jsonb("entitlements").$type<Record<string, unknown>>().notNull().default({}),
  isAddon: boolean("is_addon").default(false),
  highlight: boolean("highlight").default(false),
  active: boolean("active").default(true),
  sortOrder: integer("sort_order").default(0),
}, (t) => [uniqueIndex("packages_code_idx").on(t.code)]);

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  templateId: integer("template_id").notNull().references(() => templates.id),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  packageCode: text("package_code").notNull().default("free"),
  addons: jsonb("addons").$type<string[]>().notNull().default([]),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  design: jsonb("design").$type<Record<string, any>>().notNull().default({}),
  sections: jsonb("sections").$type<any[]>().notNull().default([]),
  settings: jsonb("settings").$type<Record<string, any>>().notNull().default({}),
  password: text("password").default(""),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  expireAt: timestamp("expire_at", { withTimezone: true }),
  views: integer("views").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [uniqueIndex("invitations_slug_idx").on(t.slug), index("invitations_user_idx").on(t.userId)]);

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").default(""),
  category: text("category").default("Umum"),
  groupName: text("group_name").default(""),
  code: text("code").notNull(),
  shared: boolean("shared").default(false),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  opens: integer("opens").notNull().default(0),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  attendance: text("attendance").notNull().default("pending"), // pending | hadir | tidak
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedInBy: text("checked_in_by"),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("guests_code_idx").on(t.code), index("guests_inv_idx").on(t.invitationId)]);

export const rsvps = pgTable("rsvps", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  guestId: integer("guest_id"),
  name: text("name").notNull(),
  attending: boolean("attending").notNull(),
  count: integer("count").notNull().default(1),
  message: text("message").default(""),
  createdAt: ts("created_at"),
}, (t) => [index("rsvps_inv_idx").on(t.invitationId)]);

export const wishes = pgTable("wishes", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  message: text("message").notNull(),
  approved: boolean("approved").notNull().default(true),
  createdAt: ts("created_at"),
}, (t) => [index("wishes_inv_idx").on(t.invitationId)]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  templateId: integer("template_id").references(() => templates.id),
  invitationId: integer("invitation_id"),
  packageCode: text("package_code").notNull(),
  addons: jsonb("addons").$type<string[]>().notNull().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull().default(0),
  voucherCode: text("voucher_code"),
  status: text("status").notNull().default("menunggu_pembayaran"),
  note: text("note").default(""),
  customerNote: text("customer_note").default(""),
  assignedTo: integer("assigned_to"),
  isCustomDesign: boolean("is_custom_design").default(false),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
}, (t) => [uniqueIndex("orders_number_idx").on(t.number), index("orders_user_idx").on(t.userId)]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  method: text("method").notNull().default("transfer"),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending | menunggu_verifikasi | berhasil | ditolak | refund
  proof: text("proof").default(""),
  provider: text("provider").default("manual"),
  createdAt: ts("created_at"),
  verifiedBy: integer("verified_by"),
});

export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  type: text("type").notNull().default("percent"), // percent | fixed
  value: integer("value").notNull(),
  minTotal: integer("min_total").notNull().default(0),
  quota: integer("quota").notNull().default(100),
  used: integer("used").notNull().default(0),
  packageCode: text("package_code"),
  userId: integer("user_id"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").default(true),
}, (t) => [uniqueIndex("vouchers_code_idx").on(t.code)]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").default(""),
  link: text("link").default(""),
  read: boolean("read").notNull().default(false),
  createdAt: ts("created_at"),
}, (t) => [index("notif_user_idx").on(t.userId)]);

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open | dibalas | selesai
  priority: text("priority").notNull().default("normal"),
  assignedTo: integer("assigned_to"),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  isStaff: boolean("is_staff").notNull().default(false),
  body: text("body").notNull(),
  attachment: text("attachment").default(""),
  createdAt: ts("created_at"),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entity: text("entity").default(""),
  entityId: integer("entity_id"),
  detail: text("detail").default(""),
  createdAt: ts("created_at"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, any>>().notNull(),
});

export const favorites = pgTable("favorites", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: integer("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.templateId] })]);
