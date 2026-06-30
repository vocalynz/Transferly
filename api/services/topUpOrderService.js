const { transaction } = require('../db');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { topUpOrderRepository } = require('../repositories/topUpOrderRepository');
const { userRepository } = require('../repositories/userRepository');
const { AUDIT_ACTOR_TYPE, POINT_TRANSACTION_TYPE, TOP_UP_ORDER_STATUS } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { auditLogService } = require('./auditLogService');

async function getUserOrThrow(userId, client) {
  const user = await userRepository.findById(userId, client);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return user;
}

async function getOrderOrThrow(orderId, client) {
  const order = await topUpOrderRepository.findById(orderId, client);
  if (!order) {
    throw new AppError(404, 'TOP_UP_ORDER_NOT_FOUND', 'Top-up order not found.');
  }
  return order;
}

function assertUserOwnsOrder(order, userId) {
  if (order.userId !== userId) {
    throw new AppError(404, 'TOP_UP_ORDER_NOT_FOUND', 'Top-up order not found.');
  }
}

async function listUserOrders(userId) {
  await getUserOrThrow(userId);
  return topUpOrderRepository.findByUserId(userId);
}

async function listOrders(filters = {}) {
  return topUpOrderRepository.findMany(filters);
}

async function createOrder(userId, input) {
  return transaction(async (client) => {
    await getUserOrThrow(userId, client);

    const order = await topUpOrderRepository.create(
      {
        userId,
        status: TOP_UP_ORDER_STATUS.PENDING,
        points: input.points,
        amountLabel: input.amountLabel || `${input.points.toLocaleString()} pts`,
        methodId: input.methodId,
        methodTitle: input.methodTitle,
        serviceIntent: input.serviceIntent,
        instructions: input.instructions,
        vendorUrl: input.vendorUrl,
        notes: input.notes
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: 'top_up_order',
        entityId: order.id,
        action: 'top_up_order.created',
        metadata: {
          points: order.points,
          methodId: order.methodId,
          serviceIntent: order.serviceIntent || null
        }
      },
      client
    );

    return order;
  });
}

async function updateUserOrderStatus(userId, orderId, input) {
  return transaction(async (client) => {
    await getUserOrThrow(userId, client);
    const order = await getOrderOrThrow(orderId, client);
    assertUserOwnsOrder(order, userId);

    if (order.status === TOP_UP_ORDER_STATUS.COMPLETED) {
      throw new AppError(409, 'TOP_UP_ORDER_COMPLETED', 'Completed top-up orders cannot be changed by the user.');
    }

    if (order.status === TOP_UP_ORDER_STATUS.CANCELLED) {
      throw new AppError(409, 'TOP_UP_ORDER_CANCELLED', 'Cancelled top-up orders cannot be changed.');
    }

    const now = new Date().toISOString();
    const updates = {
      status: input.status,
      notes: input.notes || order.notes
    };

    if (input.status === TOP_UP_ORDER_STATUS.AWAITING_CONFIRMATION) {
      updates.submittedAt = order.submittedAt || now;
    }

    if (input.status === TOP_UP_ORDER_STATUS.CANCELLED) {
      updates.cancelledAt = order.cancelledAt || now;
    }

    const updated = await topUpOrderRepository.update(orderId, updates, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: 'top_up_order',
        entityId: orderId,
        action: `top_up_order.${input.status}`,
        metadata: { previousStatus: order.status, nextStatus: input.status }
      },
      client
    );

    return updated;
  });
}

async function completeOrder({ orderId, adminActorId, notes }) {
  return transaction(async (client) => {
    const order = await getOrderOrThrow(orderId, client);

    if (order.status === TOP_UP_ORDER_STATUS.COMPLETED) {
      return order;
    }

    if (order.status === TOP_UP_ORDER_STATUS.CANCELLED) {
      throw new AppError(409, 'TOP_UP_ORDER_CANCELLED', 'Cancelled top-up orders cannot be completed.');
    }

    const nextProfile = await profileRepository.incrementPoints(order.userId, order.points, client);
    await pointTransactionRepository.create(
      {
        userId: order.userId,
        type: POINT_TRANSACTION_TYPE.TOP_UP_PURCHASE,
        amount: order.points,
        description: `Top-up order ${order.id}`,
        metadata: {
          order_id: order.id,
          method_id: order.methodId,
          admin_actor_id: adminActorId
        }
      },
      client
    );

    const completed = await topUpOrderRepository.update(
      orderId,
      {
        status: TOP_UP_ORDER_STATUS.COMPLETED,
        adminNotes: notes || order.adminNotes,
        completedAt: order.completedAt || new Date().toISOString()
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        entityType: 'top_up_order',
        entityId: orderId,
        action: 'top_up_order.completed',
        metadata: {
          points: order.points,
          userId: order.userId,
          nextPoints: nextProfile?.points ?? null
        }
      },
      client
    );

    return completed;
  });
}

async function cancelOrder({ orderId, adminActorId, notes }) {
  return transaction(async (client) => {
    const order = await getOrderOrThrow(orderId, client);

    if (order.status === TOP_UP_ORDER_STATUS.COMPLETED) {
      throw new AppError(409, 'TOP_UP_ORDER_COMPLETED', 'Completed top-up orders cannot be cancelled.');
    }

    if (order.status === TOP_UP_ORDER_STATUS.CANCELLED) {
      return order;
    }

    const cancelled = await topUpOrderRepository.update(
      orderId,
      {
        status: TOP_UP_ORDER_STATUS.CANCELLED,
        adminNotes: notes || order.adminNotes,
        cancelledAt: order.cancelledAt || new Date().toISOString()
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        entityType: 'top_up_order',
        entityId: orderId,
        action: 'top_up_order.cancelled',
        metadata: { userId: order.userId, previousStatus: order.status }
      },
      client
    );

    return cancelled;
  });
}

module.exports = {
  topUpOrderService: {
    cancelOrder,
    completeOrder,
    createOrder,
    listOrders,
    listUserOrders,
    updateUserOrderStatus
  }
};
