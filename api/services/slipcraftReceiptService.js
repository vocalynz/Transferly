const { transaction } = require('../db');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const {
  AUDIT_ACTOR_TYPE,
  POINT_TRANSACTION_TYPE,
  RECEIPT_STATUS,
  RECEIPT_TYPE
} = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { buildReceiptArtifacts } = require('../utils/simplePdf');

const LABEL_TOKEN_OVERRIDES = new Map([
  ['api', 'API'],
  ['crypto', 'Crypto'],
  ['email', 'Email'],
  ['gcash', 'GCash'],
  ['id', 'ID'],
  ['kuda', 'Kuda'],
  ['opay', 'Opay'],
  ['paypal', 'PayPal'],
  ['qr', 'QR'],
  ['url', 'URL'],
  ['usd', 'USD'],
  ['usdt', 'USDT']
]);

function formatGeneratedFieldLabel(label) {
  return String(label)
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const normalized = token.toLowerCase();
      return LABEL_TOKEN_OVERRIDES.get(normalized) || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    })
    .join(' ');
}

function buildFields(details, fields) {
  if (Array.isArray(fields) && fields.length > 0) {
    return fields;
  }

  return Object.entries(details || {}).map(([label, value]) => ({
    label: formatGeneratedFieldLabel(label),
    value: String(value)
  }));
}

function buildSummaryText(user, input) {
  if (input.summary) {
    return input.summary;
  }

  return `Generated for ${user.profile?.name || user.email} (${input.type} receipt).`;
}

async function generateReceipt(input) {
  return transaction(async (client) => {
    const user = await userRepository.findById(input.userId, client);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const platformConfig = await platformConfigRepository.get(client);
    const costPoints =
      input.type === RECEIPT_TYPE.EMAIL ? platformConfig.email_receipt_cost : platformConfig.bank_slip_cost;

    if ((user.profile?.points ?? 0) < costPoints) {
      throw new AppError(400, 'INSUFFICIENT_POINTS', 'Not enough points to generate this receipt.');
    }

    const title = input.title || `${platformConfig.platform_name} ${String(input.type).toUpperCase()} Receipt`;
    const fields = buildFields(input.details, input.fields);
    const summaryText = buildSummaryText(user, input);
    const artifacts = buildReceiptArtifacts(title, summaryText, fields, input.details || {});

    const receipt = await receiptRepository.create(
      {
        userId: input.userId,
        type: input.type,
        status: RECEIPT_STATUS.GENERATED,
        title,
        summary: {
          text: summaryText
        },
        data: {
          fields,
          details: input.details || {},
          layout: artifacts.layout
        },
        pdfBase64: artifacts.pdfBase64,
        imageDataUrl: artifacts.imageDataUrl,
        emailTo: input.emailTo || null,
        costPoints
      },
      client
    );

    await profileRepository.updateByUserId(
      input.userId,
      {
        points: (user.profile?.points ?? 0) - costPoints
      },
      client
    );

    await pointTransactionRepository.create(
      {
        userId: input.userId,
        type: POINT_TRANSACTION_TYPE.RECEIPT_SPEND,
        amount: -costPoints,
        description: `Receipt generated: ${receipt.type}.`,
        metadata: {
          receiptId: receipt.id
        }
      },
      client
    );

    await platformConfigRepository.update(
      {
        total_receipts: Number(platformConfig.total_receipts || 0) + 1
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: input.userId,
        action: 'receipt.generate',
        entityType: 'receipt',
        entityId: receipt.id,
        metadata: {
          type: input.type,
          costPoints
        }
      },
      client
    );

    const updatedUser = await userRepository.findById(input.userId, client);

    return {
      receipt,
      summary: {
        user_id: input.userId,
        cost_points: costPoints,
        remaining_points: updatedUser.profile?.points ?? 0
      },
      pdf_data_url: artifacts.pdfDataUrl,
      image_data_url: artifacts.imageDataUrl
    };
  });
}

async function getReceiptHistory(userId, limit = 10) {
  const receipts = await receiptRepository.findByUserId(userId);
  return receipts.slice(0, limit);
}

module.exports = {
  slipcraftReceiptService: {
    generateReceipt,
    getReceiptHistory
  }
};
