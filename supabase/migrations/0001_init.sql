-- Digital Invitation Studio — skema Supabase/PostgreSQL + Row Level Security
-- Jalankan: supabase db push  (atau tempel di SQL Editor)
create extension if not exists "pgcrypto";

create type app_role as enum ('owner','staff','customer');

create table profiles (id uuid primary key references auth.users on delete cascade, full_name text not null, phone text, avatar_url text, status text not null default 'active' check (status in ('active','blocked')), internal_note text, created_at timestamptz not null default now(), deleted_at timestamptz);
create table user_roles (user_id uuid primary key references profiles(id) on delete cascade, role app_role not null default 'customer');
create table staff_permissions (user_id uuid references profiles(id) on delete cascade, permission text not null, primary key (user_id, permission));
create table customers (id uuid primary key default gen_random_uuid(), profile_id uuid unique references profiles(id) on delete cascade, tenant_id uuid, created_at timestamptz not null default now());

create table template_categories (id serial primary key, name text not null, slug text unique not null, icon text, sort_order int default 0);
create table templates (id serial primary key, name text not null, slug text unique not null, category_id int references template_categories(id), style text, description text, price int not null default 0 check (price >= 0), tier text not null default 'free' check (tier in ('free','basic','premium','exclusive')), featured bool default false, is_new bool default false, popularity int default 0, config jsonb not null, features jsonb not null default '[]', status text not null default 'published', created_at timestamptz not null default now(), deleted_at timestamptz);
create table template_sections (template_id int references templates(id) on delete cascade, section_key text not null, sort_order int default 0, primary key (template_id, section_key));
create table template_assets (id serial primary key, template_id int references templates(id) on delete cascade, kind text not null, url text not null);

create table packages (id serial primary key, code text unique not null, name text not null, description text, price int not null default 0, promo_price int, duration_days int not null default 30, is_addon bool default false, highlight bool default false, active bool default true, sort_order int default 0);
create table package_features (package_id int references packages(id) on delete cascade, label text not null, sort_order int default 0);
create table feature_entitlements (package_id int references packages(id) on delete cascade, key text not null, value jsonb not null, primary key (package_id, key));
create table add_ons (id serial primary key, package_id int references packages(id) on delete cascade, effect jsonb not null default '{}');

create table invitations (id serial primary key, owner_id uuid not null references profiles(id), template_id int not null references templates(id), tenant_id uuid, slug text unique not null check (slug ~ '^[a-z0-9-]{3,60}$'), title text not null, status text not null default 'draft' check (status in ('draft','published','archived')), package_code text not null default 'free', data jsonb not null, design jsonb not null default '{}', settings jsonb not null default '{}', access_password_hash text, publish_at timestamptz, expire_at timestamptz, views int not null default 0, shares int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create index invitations_owner_idx on invitations(owner_id);
create table invitation_sections (id serial primary key, invitation_id int references invitations(id) on delete cascade, section_key text not null, enabled bool not null default true, sort_order int not null, custom jsonb);
create table invitation_assets (id serial primary key, invitation_id int references invitations(id) on delete cascade, kind text not null check (kind in ('photo','audio','video','qris')), storage_path text not null, bytes int check (bytes <= 12582912), created_at timestamptz default now());
create table invitation_guests (id serial primary key, invitation_id int not null references invitations(id) on delete cascade, name text not null, phone text, category text default 'Umum', group_name text, code text unique not null, shared bool default false, shared_at timestamptz, attendance text not null default 'pending' check (attendance in ('pending','hadir','tidak')), created_at timestamptz default now());
create index guests_inv_idx on invitation_guests(invitation_id);
create table guest_visits (id bigserial primary key, guest_id int references invitation_guests(id) on delete cascade, invitation_id int references invitations(id) on delete cascade, opened_at timestamptz default now(), user_agent text);
create table rsvps (id serial primary key, invitation_id int not null references invitations(id) on delete cascade, guest_id int references invitation_guests(id), name text not null check (char_length(name) between 2 and 80), attending bool not null, party_size int not null default 1 check (party_size between 0 and 10), message text check (char_length(message) <= 300), created_at timestamptz default now());
create table guestbook (id serial primary key, invitation_id int not null references invitations(id) on delete cascade, name text not null check (char_length(name) between 2 and 80), message text not null check (char_length(message) between 2 and 300), approved bool not null default true, created_at timestamptz default now());
create table check_ins (id serial primary key, invitation_id int not null references invitations(id) on delete cascade, guest_id int not null unique references invitation_guests(id) on delete cascade, checked_by uuid references profiles(id), checked_at timestamptz not null default now()); -- unique(guest_id) = cegah check-in ganda

create table orders (id serial primary key, number text unique not null, customer_id uuid not null references profiles(id), template_id int references templates(id), invitation_id int references invitations(id), package_code text not null, subtotal int not null, discount int not null default 0, total int not null check (total >= 0), voucher_code text, status text not null default 'menunggu_pembayaran', internal_note text, assigned_to uuid references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table order_items (id serial primary key, order_id int references orders(id) on delete cascade, kind text not null, ref_code text not null, price int not null);
create table payments (id serial primary key, order_id int not null references orders(id) on delete cascade, reference text unique not null, method text, amount int not null, status text not null default 'pending', proof_path text, provider text default 'manual', verified_by uuid references profiles(id), created_at timestamptz default now());
create table invoices (id serial primary key, order_id int unique references orders(id) on delete cascade, number text unique not null, issued_at timestamptz default now());
create table vouchers (id serial primary key, code text unique not null, type text not null check (type in ('percent','fixed')), value int not null check (value > 0), min_total int default 0, quota int default 100, used int default 0, package_code text, customer_id uuid references profiles(id), starts_at timestamptz, ends_at timestamptz, active bool default true);
create table voucher_redemptions (id serial primary key, voucher_id int references vouchers(id), order_id int references orders(id), customer_id uuid references profiles(id), created_at timestamptz default now(), unique (voucher_id, order_id));
create table subscriptions (id serial primary key, customer_id uuid references profiles(id), invitation_id int references invitations(id), package_code text not null, starts_at timestamptz default now(), ends_at timestamptz, status text default 'active');
create table custom_domains (id serial primary key, invitation_id int references invitations(id) on delete cascade, domain text unique not null, verified bool default false);

create table notifications (id serial primary key, user_id uuid not null references profiles(id) on delete cascade, type text, title text not null, body text, link text, read bool default false, created_at timestamptz default now());
create table support_tickets (id serial primary key, customer_id uuid not null references profiles(id), subject text not null, status text default 'open', priority text default 'normal', assigned_to uuid references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table support_messages (id serial primary key, ticket_id int references support_tickets(id) on delete cascade, author_id uuid references profiles(id), is_staff bool default false, body text not null, attachment_path text, created_at timestamptz default now());
create table activity_logs (id bigserial primary key, user_id uuid, action text not null, entity text, entity_id text, detail text, created_at timestamptz default now());
create table site_settings (key text primary key, value jsonb not null);

-- ===== Helper role =====
create or replace function public.current_role_name() returns text language sql stable security definer set search_path = public as $$ select role::text from user_roles where user_id = auth.uid() $$;
create or replace function public.has_perm(p text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'owner', false) or exists (select 1 from staff_permissions where user_id = auth.uid() and permission = p) $$;
create or replace function public.owns_invitation(inv int) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from invitations where id = inv and owner_id = auth.uid()) $$;

-- ===== RLS =====
do $$ declare t text; begin
  foreach t in array array['profiles','user_roles','staff_permissions','customers','template_categories','templates','template_sections','template_assets','packages','package_features','feature_entitlements','add_ons','invitations','invitation_sections','invitation_assets','invitation_guests','guest_visits','rsvps','guestbook','check_ins','orders','order_items','payments','invoices','vouchers','voucher_redemptions','subscriptions','custom_domains','notifications','support_tickets','support_messages','activity_logs','site_settings']
  loop execute format('alter table %I enable row level security', t); end loop; end $$;

-- Katalog publik (baca saja); tulis hanya staff dengan permission
create policy cat_read on template_categories for select using (true);
create policy tpl_read on templates for select using (status = 'published' or public.has_perm('templates'));
create policy tpl_write on templates for all using (public.has_perm('templates')) with check (public.has_perm('templates'));
create policy tsec_read on template_sections for select using (true);
create policy tas_read on template_assets for select using (true);
create policy pkg_read on packages for select using (active or public.has_perm('packages'));
create policy pkg_write on packages for all using (public.has_perm('packages')) with check (public.has_perm('packages'));
create policy pf_read on package_features for select using (true);
create policy fe_read on feature_entitlements for select using (true);
create policy ao_read on add_ons for select using (true);
create policy settings_read on site_settings for select using (key in ('site','content'));
create policy settings_write on site_settings for all using (public.current_role_name() = 'owner') with check (public.current_role_name() = 'owner');

-- Profil & role: user hanya melihat/ubah miliknya; role TIDAK bisa diubah user
create policy prof_self on profiles for select using (id = auth.uid() or public.has_perm('customers'));
create policy prof_upd on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy roles_read on user_roles for select using (user_id = auth.uid() or public.current_role_name() = 'owner');
create policy roles_write on user_roles for all using (public.current_role_name() = 'owner') with check (public.current_role_name() = 'owner');
create policy sp_owner on staff_permissions for all using (public.current_role_name() = 'owner') with check (public.current_role_name() = 'owner');
create policy cust_self on customers for select using (profile_id = auth.uid() or public.has_perm('customers'));

-- Undangan: pemilik penuh; publik hanya yang terbit (kolom sensitif diakses via view/Edge Function, bukan tabel langsung)
create policy inv_owner on invitations for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy inv_staff on invitations for select using (public.has_perm('orders'));
create policy inv_public on invitations for select using (status = 'published' and deleted_at is null and access_password_hash is null);
create policy isec_owner on invitation_sections for all using (public.owns_invitation(invitation_id)) with check (public.owns_invitation(invitation_id));
create policy isec_public on invitation_sections for select using (exists (select 1 from invitations i where i.id = invitation_id and i.status = 'published'));
create policy ias_owner on invitation_assets for all using (public.owns_invitation(invitation_id)) with check (public.owns_invitation(invitation_id));
-- Data tamu = privat: hanya pemilik undangan (tamu TIDAK bisa membaca tabel ini)
create policy guests_owner on invitation_guests for all using (public.owns_invitation(invitation_id)) with check (public.owns_invitation(invitation_id));
create policy visits_owner on guest_visits for select using (public.owns_invitation(invitation_id));
create policy rsvp_owner on rsvps for select using (public.owns_invitation(invitation_id));
create policy rsvp_insert on rsvps for insert with check (exists (select 1 from invitations i where i.id = invitation_id and i.status = 'published')); -- tambahan rate-limit via Edge Function
create policy gb_public_read on guestbook for select using (approved);
create policy gb_owner on guestbook for all using (public.owns_invitation(invitation_id)) with check (public.owns_invitation(invitation_id));
create policy gb_insert on guestbook for insert with check (exists (select 1 from invitations i where i.id = invitation_id and i.status = 'published'));
create policy ci_owner on check_ins for all using (public.owns_invitation(invitation_id)) with check (public.owns_invitation(invitation_id));
create policy dom_owner on custom_domains for all using (public.owns_invitation(invitation_id)) with check (public.owns_invitation(invitation_id));

-- Order & pembayaran: customer hanya miliknya; pembuatan/verifikasi lewat server (service role)
create policy ord_self on orders for select using (customer_id = auth.uid() or public.has_perm('orders'));
create policy ord_staff_upd on orders for update using (public.has_perm('orders')) with check (public.has_perm('orders'));
create policy oi_self on order_items for select using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or public.has_perm('orders'))));
create policy pay_self on payments for select using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or public.has_perm('payments'))));
create policy pay_staff on payments for update using (public.has_perm('payments')) with check (public.has_perm('payments'));
create policy inv_self on invoices for select using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or public.has_perm('payments'))));
create policy vou_staff on vouchers for all using (public.has_perm('vouchers')) with check (public.has_perm('vouchers'));
create policy vr_self on voucher_redemptions for select using (customer_id = auth.uid() or public.has_perm('vouchers'));
create policy sub_self on subscriptions for select using (customer_id = auth.uid() or public.has_perm('orders'));
create policy notif_self on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tk_self on support_tickets for select using (customer_id = auth.uid() or public.has_perm('support'));
create policy tk_insert on support_tickets for insert with check (customer_id = auth.uid());
create policy tk_staff on support_tickets for update using (public.has_perm('support'));
create policy tm_self on support_messages for select using (exists (select 1 from support_tickets t where t.id = ticket_id and (t.customer_id = auth.uid() or public.has_perm('support'))));
create policy tm_insert on support_messages for insert with check (author_id = auth.uid() and exists (select 1 from support_tickets t where t.id = ticket_id and (t.customer_id = auth.uid() or public.has_perm('support'))));
create policy log_read on activity_logs for select using (public.has_perm('logs'));

-- Trigger profil otomatis (role selalu 'customer', tidak dibaca dari metadata klien)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into user_roles (user_id, role) values (new.id, 'customer');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
