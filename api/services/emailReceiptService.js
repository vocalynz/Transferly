const { transaction } = require('../db');
const { emailDispatchRepository } = require('../repositories/emailDispatchRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const {
  AUDIT_ACTOR_TYPE,
  EMAIL_DISPATCH_STATUS,
  RECEIPT_STATUS
} = require('../utils/constants');
const { AppError } = require('../utils/errors');

async function sendReceiptEmail(input) {
  return transaction(async (client) => {
    const receipt = await receiptRepository.findById(input.receiptId, client);
    if (!receipt) {
      throw new AppError(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.');
    }

    const user = await userRepository.findById(receipt.userId, client);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const subject = input.subject || `${receipt.title} receipt from Transferly`;
    const bodyText =
      input.message ||
      `Your receipt "${receipt.title}" is ready. Receipt ID: ${receipt.id}.`;

    const dispatch = await emailDispatchRepository.create(
      {
        userId: receipt.userId,
        receiptId: receipt.id,
        toEmail: input.toEmail,
        subject,
        bodyText,
        status: EMAIL_DISPATCH_STATUS.LOCAL_ONLY,
        response: {
          mode: 'local-only',
          delivered: false,
          receiptId: receipt.id
        }
      },
      client
    );

    const updatedReceipt = await receiptRepository.update(
      receipt.id,
      {
        status: RECEIPT_STATUS.EMAILED,
        emailTo: input.toEmail
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: receipt.userId,
        action: 'receipt.email.send',
        entityType: 'receipt',
        entityId: receipt.id,
        metadata: {
          dispatchId: dispatch.id,
          toEmail: input.toEmail
        }
      },
      client
    );

    return {
      dispatch,
      receipt: updatedReceipt
    };
  });
}

module.exports = {
  emailReceiptService: {
    sendReceiptEmail
  }
};
