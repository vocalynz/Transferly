const { transaction } = require('../db');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { userRepository } = require('../repositories/userRepository');
const { AUDIT_ACTOR_TYPE, POINT_TRANSACTION_TYPE } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { auditLogService } = require('./auditLogService');

async function getUserOrThrow(userId, client) {
  const user = await userRepository.findById(userId, client);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return user;
}

async function getPointsSummary(userId) {
  const user = await getUserOrThrow(userId);

  const transactions = await pointTransactionRepository.findByUserId(userId);
  const receipts = await receiptRepository.findByUserId(userId);

  return {
    user_id: user.id,
    points: user.profile?.points ?? 0,
    referral_count: user.profile?.referralCount ?? 0,
    receipt_count: receipts.length,
    recent_transactions: transactions.slice(0, 10)
  };
}

async function listUsers() {
  return userRepository.findAll();
}

async function updateProfile(userId, input) {
  return transaction(async (client) => {
    const user = await getUserOrThrow(userId, client);
    const name = input.name.trim();

    await userRepository.upsert(
      {
        id: userId,
        email: user.email,
        displayName: name,
        countryCode: user.countryCode
      },
      client
    );
    await profileRepository.updateByUserId(userId, { name }, client);
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        action: 'slipcraft.user.profile_updated',
        metadata: { name }
      },
      client
    );

    return getUserOrThrow(userId, client);
  });
}

async function deleteAccount(userId) {
  return transaction(async (client) => {
    await getUserOrThrow(userId, client);
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        action: 'slipcraft.user.account_deleted',
        metadata: {}
      },
      client
    );
    await userRepository.deleteById(userId, client);

    return { user_id: userId, deleted: true };
  });
}

async function adjustUserPoints({ targetUserId, delta, reason, adminActorId }) {
  return transaction(async (client) => {
    await getUserOrThrow(targetUserId, client);
    const nextProfile = await profileRepository.incrementPoints(targetUserId, delta, client);

    await pointTransactionRepository.create(
      {
        userId: targetUserId,
        type: POINT_TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
        amount: delta,
        description: reason || 'Admin adjustment',
        metadata: { admin_actor_id: adminActorId }
      },
      client
    );
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'slipcraft.admin.points_adjusted',
        metadata: { delta, reason: reason || null, points: nextProfile.points }
      },
      client
    );

    return getUserOrThrow(targetUserId, client);
  });
}

module.exports = {
  slipcraftUserService: {
    adjustUserPoints,
    deleteAccount,
    getPointsSummary,
    listUsers,
    updateProfile
  }
};
