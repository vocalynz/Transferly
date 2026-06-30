PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  country_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  currency_code TEXT NOT NULL,
  pending_balance_cents INTEGER NOT NULL DEFAULT 0,
  available_balance_cents INTEGER NOT NULL DEFAULT 0,
  frozen_balance_cents INTEGER NOT NULL DEFAULT 0,
  paid_out_balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  entry_key TEXT NOT NULL UNIQUE,
  wallet_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  debit_bucket TEXT,
  credit_bucket TEXT,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  external_reference TEXT,
  description TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT,
  paypal_invoice_id TEXT NOT NULL UNIQUE,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  description TEXT,
  invoice_url TEXT NOT NULL,
  paypal_details_json TEXT NOT NULL,
  paypal_qr_details_json TEXT,
  paypal_synced_at TEXT,
  metadata_json TEXT,
  issue_date TEXT,
  due_date TEXT,
  auto_reminders_cancelled_at TEXT,
  paid_at TEXT,
  cancelled_at TEXT,
  refunded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (user_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  currency_code TEXT NOT NULL,
  default_due_days INTEGER,
  line_items_json TEXT NOT NULL,
  metadata_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  sender_batch_id TEXT NOT NULL UNIQUE,
  paypal_payout_batch_id TEXT UNIQUE,
  status TEXT NOT NULL,
  batch_currency_code TEXT NOT NULL,
  raw_response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  stripe_account_id TEXT NOT NULL UNIQUE,
  email TEXT,
  country_code TEXT,
  business_type TEXT,
  status TEXT NOT NULL,
  charges_enabled INTEGER NOT NULL DEFAULT 0,
  payouts_enabled INTEGER NOT NULL DEFAULT 0,
  details_submitted INTEGER NOT NULL DEFAULT 0,
  requirements_json TEXT,
  capabilities_json TEXT,
  disabled_reason TEXT,
  metadata_json TEXT,
  created_by_actor_id TEXT,
  last_onboarding_link_created_at TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payout_batch_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  sender_batch_id TEXT NOT NULL UNIQUE,
  paypal_payout_item_id TEXT UNIQUE,
  status TEXT NOT NULL,
  risk_decision TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  receiver TEXT NOT NULL,
  receiver_country_code TEXT,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  note TEXT,
  failure_reason TEXT,
  metadata_json TEXT,
  approved_by_actor_id TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (payout_batch_id) REFERENCES payout_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_flags (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  invoice_id TEXT,
  payout_id TEXT,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  reason TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  transmission_id TEXT,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  verification_payload_json TEXT,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_user_id TEXT,
  referral_count INTEGER NOT NULL DEFAULT 0,
  telegram_chat_id TEXT,
  telegram_username TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  platform_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  support_email TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  brand_color TEXT NOT NULL,
  bank_slip_cost INTEGER NOT NULL DEFAULT 10,
  email_receipt_cost INTEGER NOT NULL DEFAULT 5,
  referral_bonus INTEGER NOT NULL DEFAULT 20,
  signup_bonus INTEGER NOT NULL DEFAULT 50,
  payout_minimum_cents INTEGER NOT NULL DEFAULT 0,
  payout_fee_fixed_cents INTEGER NOT NULL DEFAULT 0,
  payout_fee_percentage_bps INTEGER NOT NULL DEFAULT 0,
  payout_manual_review_cents INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  total_receipts INTEGER NOT NULL DEFAULT 0,
  uptime TEXT NOT NULL DEFAULT '99.9%',
  privacy_policy TEXT NOT NULL,
  terms_of_service TEXT NOT NULL,
  about_us TEXT NOT NULL,
  help_faq TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_ops_issues (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  summary TEXT NOT NULL,
  metadata_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (entity_type, entity_id, issue_type)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  data_json TEXT NOT NULL,
  pdf_base64 TEXT NOT NULL,
  image_data_url TEXT NOT NULL,
  email_to TEXT,
  cost_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS top_up_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  points INTEGER NOT NULL,
  amount_label TEXT NOT NULL,
  method_id TEXT NOT NULL,
  method_title TEXT NOT NULL,
  service_intent TEXT,
  instructions TEXT,
  vendor_url TEXT,
  notes TEXT,
  admin_notes TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_dispatches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_reference TEXT,
  response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referral_events (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  bonus_points INTEGER NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telegram_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  telegram_user_id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS telegram_command_logs (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  command TEXT NOT NULL,
  arguments_json TEXT,
  response_json TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_created_at
  ON ledger_entries (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference
  ON ledger_entries (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_created_at
  ON invoices (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_user_created_at
  ON payouts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_receiver_created_at
  ON payouts (receiver, created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_connected_accounts_user_created_at
  ON stripe_connected_accounts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_connected_accounts_status
  ON stripe_connected_accounts (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created_at
  ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON audit_logs (actor_type, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_flags_user_created_at
  ON risk_flags (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_flags_rule_created_at
  ON risk_flags (rule_code, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_referrer
  ON profiles (referred_by_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_points
  ON profiles (points, created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_user_created_at
  ON receipts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_created_at
  ON points_transactions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_top_up_orders_user_created_at
  ON top_up_orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_top_up_orders_status_created_at
  ON top_up_orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_dispatches_user_created_at
  ON email_dispatches (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer_created_at
  ON referral_events (referrer_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user_id
  ON telegram_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_command_logs_user_created_at
  ON telegram_command_logs (telegram_user_id, created_at);
