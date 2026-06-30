const { transaction } = require('../db');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { referralEventRepository } = require('../repositories/referralEventRepository');
const { auditLogService } = require('./auditLogService');
const {
  AUDIT_ACTOR_TYPE,
  POINT_TRANSACTION_TYPE
} = require('../utils/constants');
const { AppError } = require('../utils/errors');

function calculatePointsEarned(events) {
  return events.reduce((total, event) => total + Number(event.bonus_points || event.bonusPoints || 0), 0);
}

async function getStats(userId) {
  const profile = await profileRepository.findByUserId(userId);
  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  }

  const referredUsers = await profileRepository.listReferredUsers(userId);
  const events = await referralEventRepository.findByReferrerUserId(userId);

  return {
    user_id: userId,
    referral_code: profile.referralCode,
    referral_count: profile.referralCount,
    points_earned: calculatePointsEarned(events),
    referred_users: referredUsers,
    events
  };
}

async function claimReferral(userId, referralCode) {
  return transaction(async (client) => {
    const profile = await profileRepository.findByUserId(userId, client);
    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
    }

    if (profile.referredByUserId) {
      throw new AppError(409, 'REFERRAL_ALREADY_CLAIMED', 'Referral has already been claimed for this profile.');
    }

    const existingEvent = await referralEventRepository.findByReferredUserId(userId, client);
    if (existingEvent) {
      throw new AppError(409, 'REFERRAL_ALREADY_CLAIMED', 'Referral has already been claimed for this profile.');
    }

    const referrerProfile = await profileRepository.findByReferralCode(referralCode, client);
    if (!referrerProfile) {
      throw new AppError(404, 'REFERRAL_CODE_NOT_FOUND', 'Referral code was not found.');
    }

    if (referrerProfile.userId === userId) {
      throw new AppError(400, 'INVALID_REFERRAL_CODE', 'You cannot claim your own referral code.');
    }

    const platformConfig = await platformConfigRepository.get(client);

    await profileRepository.updateByUserId(
      userId,
      {
        referredByUserId: referrerProfile.userId
      },
      client
    );
    await profileRepository.incrementPoints(referrerProfile.userId, platformConfig.referral_bonus, client);
    await profileRepository.incrementReferralCount(referrerProfile.userId, 1, client);

    const event = await referralEventRepository.create(
      {
        referrerUserId: referrerProfile.userId,
        referredUserId: userId,
        referralCode: referrerProfile.referralCode,
        bonusPoints: platformConfig.referral_bonus,
        status: 'COMPLETED',
        metadata: {
          source: 'referral.claim'
        }
      },
      client
    );

    await pointTransactionRepository.create(
      {
        userId: referrerProfile.userId,
        type: POINT_TRANSACTION_TYPE.REFERRAL_BONUS,
        amount: platformConfig.referral_bonus,
        description: `Referral bonus earned for user ${userId}.`,
        metadata: {
          referredUserId: userId,
          eventId: event.id
        }
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        action: 'referral.claim',
        entityType: 'profile',
        entityId: userId,
        metadata: {
          referrerUserId: referrerProfile.userId,
          referralCode: referrerProfile.referralCode
        }
      },
      client
    );

    return getStats(referrerProfile.userId);
  });
}

module.exports = {
  referralService: {
    getStats,
    claimReferral
  }
};
