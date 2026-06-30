const { formatMoney } = require('../utils/money');

function presentPayoutRemediation(payout) {
  const providerItemStatus = String(payout.metadata?.provider_item_status || '').toUpperCase();

  if (providerItemStatus === 'UNCLAIMED') {
    return {
      action: 'cancel_unclaimed',
      allowed: Boolean(payout.paypalPayoutItemId),
      label: 'Cancel Unclaimed',
      reason: 'The recipient has not claimed this payout. PayPal allows cancellation while it remains unclaimed.'
    };
  }

  if (providerItemStatus === 'HELD' || providerItemStatus === 'ONHOLD') {
    return {
      action: 'review_hold',
      allowed: false,
      label: 'Manual Review',
      reason: 'This payout is on hold at PayPal and requires provider-side review or support follow-up.'
    };
  }

  if (providerItemStatus === 'RETURNED' || providerItemStatus === 'CANCELED') {
    return {
      action: 'none',
      allowed: false,
      label: 'Returned',
      reason: 'Funds have been returned to the sender account. Review and resend only if appropriate.'
    };
  }

  return null;
}

function presentInvoice(invoice) {
  return {
    invoice_id: invoice.paypalInvoiceId,
    internal_invoice_id: invoice.id,
    template_id: invoice.templateId || invoice.metadata?.invoice_template?.id || null,
    status: invoice.status,
    invoice_link: invoice.invoiceUrl,
    summary: {
      invoice_number: invoice.invoiceNumber,
      amount: formatMoney(invoice.amountCents),
      currency: invoice.currencyCode,
      recipient_email: invoice.recipientEmail,
      description: invoice.description || null,
      issue_date: invoice.issueDate || null,
      due_date: invoice.dueDate || null,
      auto_reminders_cancelled_at: invoice.autoRemindersCancelledAt || null,
      paid_at: invoice.paidAt || null,
      cancelled_at: invoice.cancelledAt || null,
      refunded_at: invoice.refundedAt || null,
      created_at: invoice.createdAt,
      updated_at: invoice.updatedAt
    },
    official_paypal: {
      qr: invoice.paypalQrDetails || null,
      last_synced_at: invoice.paypalSyncedAt || null
    },
    metadata: invoice.metadata || {}
  };
}

function presentPayout(payout) {
  const pricing = payout.metadata?.pricing || null;

  return {
    payout_id: payout.id,
    status: payout.status,
    risk_decision: payout.riskDecision,
    tracking: {
      sender_batch_id: payout.senderBatchId,
      payout_batch_id: payout.payoutBatch ? payout.payoutBatch.paypalPayoutBatchId : null,
      payout_item_id: payout.paypalPayoutItemId || null
    },
    summary: {
      amount: formatMoney(payout.amountCents),
      fee_amount: pricing ? formatMoney(pricing.fee_cents || 0) : '0.00',
      total_debit: pricing ? formatMoney(pricing.total_debit_cents || payout.amountCents) : formatMoney(payout.amountCents),
      currency: payout.currencyCode,
      receiver: payout.receiver,
      recipient_type: payout.recipientType,
      receiver_country_code: payout.receiverCountryCode || null,
      note: payout.note || null,
      failure_reason: payout.failureReason || null,
      approved_at: payout.approvedAt || null,
      rejected_at: payout.rejectedAt || null,
      processed_at: payout.processedAt || null,
      created_at: payout.createdAt,
      updated_at: payout.updatedAt
    },
    official_paypal: {
      provider_batch_status: payout.metadata?.provider_batch_status || null,
      provider_item_status: payout.metadata?.provider_item_status || null,
      provider_issue_code: payout.metadata?.provider_issue_code || null,
      last_synced_at: payout.metadata?.last_synced_at || null,
      remediation: presentPayoutRemediation(payout)
    },
    pricing: pricing
      ? {
          requested_amount: formatMoney(pricing.requested_amount_cents || payout.amountCents),
          fee_amount: formatMoney(pricing.fee_cents || 0),
          total_debit: formatMoney(pricing.total_debit_cents || payout.amountCents),
          fee_fixed_amount: formatMoney(pricing.fee_fixed_cents || 0),
          fee_percentage_bps: pricing.fee_percentage_bps || 0
        }
      : null,
    metadata: payout.metadata || {}
  };
}

function presentPaymentTimelineEntry(entry) {
  return {
    audit_log_id: entry.id,
    actor_type: entry.actorType,
    actor_id: entry.actorId || null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata || {},
    created_at: entry.createdAt
  };
}

module.exports = {
  presentInvoice,
  presentPayout,
  presentPaymentTimelineEntry
};
