const { paymentOpsIssueRepository } = require('../repositories/paymentOpsIssueRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');

const OPEN_STATUS = 'OPEN';
const ACKNOWLEDGED_STATUS = 'ACKNOWLEDGED';
const RESOLVED_STATUS = 'RESOLVED';

function isPastDue(dueDate) {
  if (!dueDate) {
    return false;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  return due.getTime() < Date.now();
}

async function syncInvoiceIssues(invoice, client) {
  const activeIssueTypes = [];
  const provider = String(invoice.metadata?.provider || 'paypal').toLowerCase();

  if (
    ['SENT', 'SCHEDULED', 'UPDATED'].includes(invoice.status) &&
    isPastDue(invoice.dueDate)
  ) {
    activeIssueTypes.push('INVOICE_OVERDUE');
    await paymentOpsIssueRepository.upsert(
      {
        entityType: 'invoice',
        entityId: invoice.id,
        issueType: 'INVOICE_OVERDUE',
        severity: 'MEDIUM',
        status: OPEN_STATUS,
        summary: `Invoice ${invoice.invoiceNumber} is overdue and still awaiting settlement.`,
        metadata: {
          provider,
          paypal_invoice_id: invoice.paypalInvoiceId,
          due_date: invoice.dueDate,
          status: invoice.status
        }
      },
      client
    );
  }

  if (invoice.status === 'FAILED') {
    activeIssueTypes.push('INVOICE_PROVIDER_ATTENTION');
    await paymentOpsIssueRepository.upsert(
      {
        entityType: 'invoice',
        entityId: invoice.id,
        issueType: 'INVOICE_PROVIDER_ATTENTION',
        severity: 'HIGH',
        status: OPEN_STATUS,
        summary: `Invoice ${invoice.invoiceNumber} needs provider attention after sync failure.`,
        metadata: {
          provider,
          paypal_invoice_id: invoice.paypalInvoiceId,
          status: invoice.status
        }
      },
      client
    );
  }

  await paymentOpsIssueRepository.resolveIssuesForEntity('invoice', invoice.id, activeIssueTypes, client);
}

function payoutIssueDescriptor(payout) {
  const providerStatus = String(payout.metadata?.provider_item_status || '').toUpperCase();

  if (providerStatus === 'UNCLAIMED') {
    return {
      issueType: 'PAYOUT_UNCLAIMED',
      severity: 'HIGH',
      summary: `Payout ${payout.id} is unclaimed at PayPal and may need cancellation or recipient follow-up.`
    };
  }

  if (providerStatus === 'ONHOLD' || providerStatus === 'HELD') {
    return {
      issueType: 'PAYOUT_ON_HOLD',
      severity: 'HIGH',
      summary: `Payout ${payout.id} is on hold at PayPal and needs review.`
    };
  }

  if (providerStatus === 'RETURNED' || payout.status === 'FAILED') {
    return {
      issueType: 'PAYOUT_RETURNED_OR_FAILED',
      severity: 'HIGH',
      summary: `Payout ${payout.id} failed or returned and needs operator review.`
    };
  }

  if (providerStatus === 'DENIED' || payout.status === 'DENIED') {
    return {
      issueType: 'PAYOUT_DENIED',
      severity: 'HIGH',
      summary: `Payout ${payout.id} was denied by PayPal and needs review.`
    };
  }

  return null;
}

async function syncPayoutIssues(payout, client) {
  const issue = payoutIssueDescriptor(payout);
  const activeIssueTypes = issue ? [issue.issueType] : [];
  const provider = String(payout.metadata?.provider || 'paypal').toLowerCase();

  if (issue) {
    await paymentOpsIssueRepository.upsert(
      {
        entityType: 'payout',
        entityId: payout.id,
        issueType: issue.issueType,
        severity: issue.severity,
        status: OPEN_STATUS,
        summary: issue.summary,
        metadata: {
          provider,
          payout_item_id: payout.paypalPayoutItemId || null,
          provider_item_status: payout.metadata?.provider_item_status || null,
          provider_batch_status: payout.metadata?.provider_batch_status || null,
          provider_issue_code: payout.metadata?.provider_issue_code || null,
          failure_reason: payout.failureReason || null,
          recommended_action:
            issue.issueType === 'PAYOUT_UNCLAIMED'
              ? 'cancel_unclaimed_or_contact_recipient'
              : issue.issueType === 'PAYOUT_ON_HOLD'
                ? 'review_hold_with_paypal'
                : 'review_and_resend_if_appropriate'
        }
      },
      client
    );
  }

  await paymentOpsIssueRepository.resolveIssuesForEntity('payout', payout.id, activeIssueTypes, client);
}

async function listIssues(filters = {}) {
  return paymentOpsIssueRepository.findMany(filters);
}

async function getIssueOrThrow(issueId, client) {
  const issue = await paymentOpsIssueRepository.findById(issueId, client);
  if (!issue) {
    throw new AppError(404, 'PAYMENT_ISSUE_NOT_FOUND', 'Payment operations issue not found.');
  }

  return issue;
}

function mergeIssueMetadata(issue, patch) {
  return {
    ...(issue.metadata || {}),
    ...patch
  };
}

async function acknowledgeIssue({ issueId, adminActorId, note }) {
  const issue = await getIssueOrThrow(issueId);
  const now = new Date().toISOString();
  const updated = await paymentOpsIssueRepository.updateById(issueId, {
    status: ACKNOWLEDGED_STATUS,
    resolvedAt: null,
    metadata: mergeIssueMetadata(issue, {
      acknowledged_at: now,
      acknowledged_by_actor_id: adminActorId,
      acknowledgement_note: note || null
    })
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payment_issue.acknowledged',
    entityType: 'payment_ops_issue',
    entityId: issueId,
    metadata: {
      note: note || null,
      previous_status: issue.status
    }
  });

  return updated;
}

async function resolveIssue({ issueId, adminActorId, note }) {
  const issue = await getIssueOrThrow(issueId);
  const now = new Date().toISOString();
  const updated = await paymentOpsIssueRepository.updateById(issueId, {
    status: RESOLVED_STATUS,
    resolvedAt: now,
    metadata: mergeIssueMetadata(issue, {
      resolved_at: now,
      resolved_by_actor_id: adminActorId,
      resolution_note: note || null
    })
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payment_issue.resolved',
    entityType: 'payment_ops_issue',
    entityId: issueId,
    metadata: {
      note: note || null,
      previous_status: issue.status
    }
  });

  return updated;
}

async function reopenIssue({ issueId, adminActorId, note }) {
  const issue = await getIssueOrThrow(issueId);
  const now = new Date().toISOString();
  const updated = await paymentOpsIssueRepository.updateById(issueId, {
    status: OPEN_STATUS,
    resolvedAt: null,
    lastSeenAt: now,
    metadata: mergeIssueMetadata(issue, {
      reopened_at: now,
      reopened_by_actor_id: adminActorId,
      reopen_note: note || null
    })
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payment_issue.reopened',
    entityType: 'payment_ops_issue',
    entityId: issueId,
    metadata: {
      note: note || null,
      previous_status: issue.status
    }
  });

  return updated;
}

module.exports = {
  paymentOpsIssueService: {
    acknowledgeIssue,
    resolveIssue,
    reopenIssue,
    listIssues,
    syncInvoiceIssues,
    syncPayoutIssues
  }
};
