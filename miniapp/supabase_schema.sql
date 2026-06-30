-- ============================================================
-- Transferly Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- Extended user data linked to auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  points integer not null default 50,
  referral_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  referred_by text default null,
  referral_count integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RECEIPTS TABLE
-- All generated receipts (bank slip + email receipt)
-- ============================================================
create table if not exists public.receipts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('bank', 'email')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLATFORM CONFIG TABLE
-- Single-row admin-controlled platform settings
-- ============================================================
create table if not exists public.platform_config (
  id integer primary key default 1,
  platform_name text not null default 'Transferly',
  tagline text not null default 'Generate Professional Receipts Instantly',
  support_email text not null default 'support@transferly.app',
  admin_email text not null default 'admin@transferly.app',
  brand_color text not null default '#f8812d',
  bank_slip_cost integer not null default 10,
  email_receipt_cost integer not null default 5,
  referral_bonus integer not null default 20,
  signup_bonus integer not null default 50,
  total_users integer not null default 0,
  total_receipts integer not null default 0,
  uptime text not null default '99.9%',
  privacy_policy text not null default 'Your privacy policy content here.',
  terms_of_service text not null default 'Your terms of service content here.',
  about_us text not null default 'Transferly is a professional receipt generation platform.',
  constraint single_row check (id = 1)
);

-- ============================================================
-- FAQS TABLE
-- ============================================================
create table if not exists public.faqs (
  id uuid default uuid_generate_v4() primary key,
  question text not null,
  answer text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TESTIMONIALS TABLE
-- ============================================================
create table if not exists public.testimonials (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  role text not null default '',
  content text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  avatar text not null default '',
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- POINTS TRANSACTIONS TABLE
-- Tracks all point purchases and usage
-- ============================================================
create table if not exists public.points_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('purchase', 'spend', 'referral_bonus', 'signup_bonus')),
  amount integer not null,
  description text not null default '',
  reference text default null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can read/update their own profile
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Receipts: users can only see their own receipts
alter table public.receipts enable row level security;

create policy "Users can view own receipts"
  on public.receipts for select
  using (auth.uid() = user_id);

create policy "Users can insert own receipts"
  on public.receipts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own receipts"
  on public.receipts for delete
  using (auth.uid() = user_id);

create policy "Admins can view all receipts"
  on public.receipts for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Platform config: public read, admin write
alter table public.platform_config enable row level security;

create policy "Anyone can read config"
  on public.platform_config for select
  using (true);

create policy "Admins can update config"
  on public.platform_config for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- FAQs: public read, admin write
alter table public.faqs enable row level security;

create policy "Anyone can read faqs"
  on public.faqs for select
  using (true);

create policy "Admins can manage faqs"
  on public.faqs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Testimonials: public read, admin write
alter table public.testimonials enable row level security;

create policy "Anyone can read testimonials"
  on public.testimonials for select
  using (true);

create policy "Admins can manage testimonials"
  on public.testimonials for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Points transactions: users see own, admins see all
alter table public.points_transactions enable row level security;

create policy "Users can view own transactions"
  on public.points_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.points_transactions for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all transactions"
  on public.points_transactions for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  ref_code text;
  referrer_id uuid;
begin
  -- Generate unique referral code
  ref_code := upper(substring(md5(new.id::text || random()::text), 1, 8));

  -- Insert profile
  insert into public.profiles (id, name, email, referral_code, referred_by, points)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    ref_code,
    new.raw_user_meta_data->>'referred_by',
    50
  );

  -- If referred, give referrer bonus points
  if new.raw_user_meta_data->>'referred_by' is not null then
    select id into referrer_id
    from public.profiles
    where referral_code = new.raw_user_meta_data->>'referred_by';

    if referrer_id is not null then
      update public.profiles
      set points = points + 20, referral_count = referral_count + 1
      where id = referrer_id;

      insert into public.points_transactions (user_id, type, amount, description)
      values (referrer_id, 'referral_bonus', 20, 'Referral bonus for inviting a new user');
    end if;
  end if;

  -- Log signup bonus transaction
  insert into public.points_transactions (user_id, type, amount, description)
  values (new.id, 'signup_bonus', 50, 'Welcome bonus points');

  return new;
end;
$$ language plpgsql security definer;

-- Trigger: fires after new auth user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on profiles
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert default platform config
insert into public.platform_config (
  id, platform_name, tagline, support_email, admin_email, brand_color,
  bank_slip_cost, email_receipt_cost, referral_bonus, signup_bonus,
  total_users, total_receipts, uptime,
  privacy_policy, terms_of_service, about_us
) values (
  1,
  'Transferly',
  'Generate Professional Receipts Instantly',
  'support@transferly.app',
  'admin@transferly.app',
  '#f8812d',
  10, 5, 20, 50,
  1240, 45800, '99.9%',
  'We take your privacy seriously. Transferly collects minimal data necessary to provide our services. We do not sell your data to third parties. All receipts are stored securely and only accessible by you.',
  'By using Transferly, you agree to use the platform for lawful purposes only. Generated receipts are for record-keeping purposes. Transferly is not responsible for misuse of generated documents.',
  'Transferly is a professional receipt generation platform built to help individuals and businesses create clean, realistic bank and email receipts for legitimate record-keeping purposes.'
) on conflict (id) do nothing;

-- Insert default FAQs
insert into public.faqs (question, answer, order_index) values
  ('What is Transferly?', 'Transferly is a professional receipt generation platform that lets you create realistic bank transfer slips and email receipts for legitimate record-keeping purposes.', 1),
  ('How do points work?', 'You earn 50 points when you sign up. Each bank slip costs 10 points and each email receipt costs 5 points. You can earn more points by referring friends or purchasing point bundles.', 2),
  ('Are the receipts real?', 'The receipts are professionally styled documents for personal record-keeping only. They are not official bank documents.', 3),
  ('How do I refer friends?', 'Go to your Referral page and share your unique referral link. When someone signs up using your link, you earn 20 bonus points.', 4),
  ('Can I download my receipts?', 'Yes! You can download any receipt as a PNG image or PDF document directly from the preview screen.', 5)
on conflict do nothing;

-- Insert default testimonials
insert into public.testimonials (name, role, content, rating, avatar, order_index) values
  ('Chidi Okonkwo', 'Freelance Designer', 'Transferly saved me so much time. I can generate professional receipts in seconds!', 5, 'CO', 1),
  ('Amaka Nwosu', 'Small Business Owner', 'The bank slip generator is incredibly realistic. My clients love the professional touch.', 5, 'AN', 2),
  ('Emeka Eze', 'Online Trader', 'Simple, fast, and professional. Best receipt generator I have used.', 5, 'EE', 3)
on conflict do nothing;
