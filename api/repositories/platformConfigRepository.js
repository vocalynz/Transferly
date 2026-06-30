const { db } = require('../db');

const DEFAULT_PLATFORM_CONFIG = Object.freeze({
  id: 1,
  platformName: 'Transferly',
  tagline: 'Generate Professional Receipts Instantly',
  supportEmail: 'support@transferly.app',
  adminEmail: 'admin@transferly.app',
  supportPhone: '+1 (800) 555-0199',
  supportAddress: '100 Market Street, San Francisco, CA',
  brandColor: '#f8812d',
  bankSlipCost: 10,
  emailReceiptCost: 5,
  referralBonus: 20,
  signupBonus: 50,
  payoutMinimumCents: 0,
  payoutFeeFixedCents: 0,
  payoutFeePercentageBps: 0,
  payoutManualReviewCents: 0,
  totalUsers: 1240,
  totalReceipts: 45800,
  uptime: '99.9%',
  privacyPolicy: 'We take your privacy seriously. Transferly collects minimal data necessary to provide our services.',
  termsOfService: 'By using Transferly, you agree to use the platform for lawful purposes only.',
  aboutUs: 'Transferly is a professional receipt generation platform.',
  helpFaq: JSON.stringify([
    {
      question: 'How do receipt credits work?',
      answer: 'Each generated receipt deducts points based on the selected output type.'
    },
    {
      question: 'Can I resend a receipt by email?',
      answer: 'Yes. Generate or resend a receipt from the dashboard and the system will log the dispatch.'
    }
  ]),
  telegramSupportLink: 'https://t.me/transferly_support'
});

function normalizeHelpFaq(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [
      {
        question: 'Support',
        answer: rawValue
      }
    ];
  }
}

function mapConfig(row) {
  if (!row) {
    return null;
  }

  const helpFAQ = normalizeHelpFaq(row.help_faq);

  return {
    id: row.id,
    platform_name: row.platform_name,
    name: row.platform_name,
    tagline: row.tagline,
    support_email: row.support_email,
    email: row.support_email,
    admin_email: row.admin_email,
    brand_color: row.brand_color,
    phone: DEFAULT_PLATFORM_CONFIG.supportPhone,
    address: DEFAULT_PLATFORM_CONFIG.supportAddress,
    bank_slip_cost: row.bank_slip_cost,
    email_receipt_cost: row.email_receipt_cost,
    referral_bonus: row.referral_bonus,
    signup_bonus: row.signup_bonus,
    payout_minimum_cents: row.payout_minimum_cents,
    payout_fee_fixed_cents: row.payout_fee_fixed_cents,
    payout_fee_percentage_bps: row.payout_fee_percentage_bps,
    payout_manual_review_cents: row.payout_manual_review_cents,
    total_users: row.total_users,
    total_receipts: row.total_receipts,
    uptime: row.uptime,
    privacy_policy: row.privacy_policy,
    terms_of_service: row.terms_of_service,
    about_us: row.about_us,
    activities: [
      'Instant receipt generation',
      'Email delivery and export',
      'Referral rewards and points'
    ],
    emailSent: row.total_receipts,
    telegramSupportLink: DEFAULT_PLATFORM_CONFIG.telegramSupportLink,
    helpFAQ,
    help_faq: row.help_faq,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function ensureDefault(client = db) {
  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO platform_config (
        id, platform_name, tagline, support_email, admin_email, brand_color, bank_slip_cost,
        email_receipt_cost, referral_bonus, signup_bonus, payout_minimum_cents, payout_fee_fixed_cents,
        payout_fee_percentage_bps, payout_manual_review_cents, total_users, total_receipts,
        uptime, privacy_policy, terms_of_service, about_us, help_faq, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `,
    [
      DEFAULT_PLATFORM_CONFIG.id,
      DEFAULT_PLATFORM_CONFIG.platformName,
      DEFAULT_PLATFORM_CONFIG.tagline,
      DEFAULT_PLATFORM_CONFIG.supportEmail,
      DEFAULT_PLATFORM_CONFIG.adminEmail,
      DEFAULT_PLATFORM_CONFIG.brandColor,
      DEFAULT_PLATFORM_CONFIG.bankSlipCost,
      DEFAULT_PLATFORM_CONFIG.emailReceiptCost,
      DEFAULT_PLATFORM_CONFIG.referralBonus,
      DEFAULT_PLATFORM_CONFIG.signupBonus,
      DEFAULT_PLATFORM_CONFIG.payoutMinimumCents,
      DEFAULT_PLATFORM_CONFIG.payoutFeeFixedCents,
      DEFAULT_PLATFORM_CONFIG.payoutFeePercentageBps,
      DEFAULT_PLATFORM_CONFIG.payoutManualReviewCents,
      DEFAULT_PLATFORM_CONFIG.totalUsers,
      DEFAULT_PLATFORM_CONFIG.totalReceipts,
      DEFAULT_PLATFORM_CONFIG.uptime,
      DEFAULT_PLATFORM_CONFIG.privacyPolicy,
      DEFAULT_PLATFORM_CONFIG.termsOfService,
      DEFAULT_PLATFORM_CONFIG.aboutUs,
      DEFAULT_PLATFORM_CONFIG.helpFaq,
      now,
      now
    ]
  );

  const row = await client.get('SELECT * FROM platform_config WHERE id = 1');
  return mapConfig(row);
}

async function get(client = db) {
  return ensureDefault(client);
}

async function update(updates, client = db) {
  const existing = await ensureDefault(client);
  const now = new Date().toISOString();

  await client.run(
    `
      UPDATE platform_config
      SET
        platform_name = ?,
        tagline = ?,
        support_email = ?,
        admin_email = ?,
        brand_color = ?,
        bank_slip_cost = ?,
        email_receipt_cost = ?,
        referral_bonus = ?,
        signup_bonus = ?,
        payout_minimum_cents = ?,
        payout_fee_fixed_cents = ?,
        payout_fee_percentage_bps = ?,
        payout_manual_review_cents = ?,
        total_users = ?,
        total_receipts = ?,
        uptime = ?,
        privacy_policy = ?,
        terms_of_service = ?,
        about_us = ?,
        help_faq = ?,
        updated_at = ?
      WHERE id = 1
    `,
    [
      updates.platform_name ?? existing.platform_name,
      updates.tagline ?? existing.tagline,
      updates.support_email ?? existing.support_email,
      updates.admin_email ?? existing.admin_email,
      updates.brand_color ?? existing.brand_color,
      updates.bank_slip_cost ?? existing.bank_slip_cost,
      updates.email_receipt_cost ?? existing.email_receipt_cost,
      updates.referral_bonus ?? existing.referral_bonus,
      updates.signup_bonus ?? existing.signup_bonus,
      updates.payout_minimum_cents ?? existing.payout_minimum_cents,
      updates.payout_fee_fixed_cents ?? existing.payout_fee_fixed_cents,
      updates.payout_fee_percentage_bps ?? existing.payout_fee_percentage_bps,
      updates.payout_manual_review_cents ?? existing.payout_manual_review_cents,
      updates.total_users ?? existing.total_users,
      updates.total_receipts ?? existing.total_receipts,
      updates.uptime ?? existing.uptime,
      updates.privacy_policy ?? existing.privacy_policy,
      updates.terms_of_service ?? existing.terms_of_service,
      updates.about_us ?? existing.about_us,
      updates.help_faq ?? updates.helpFAQ ?? existing.help_faq,
      now
    ]
  );

  return get(client);
}

module.exports = {
  DEFAULT_PLATFORM_CONFIG,
  platformConfigRepository: {
    ensureDefault,
    get,
    update
  }
};
