const { randomUUID } = require('node:crypto');

const { db, transaction } = require('../db');
const { walletRepository } = require('../repositories/walletRepository');
const { AppError } = require('../utils/errors');
const { ensurePositiveMoney, ensureSameCurrency } = require('../utils/money');
const { BALANCE_BUCKET, LEDGER_ENTRY_TYPE } = require('../utils/constants');

async function findLedgerEntryByKey(client, entryKey) {
  return client.get('SELECT id FROM ledger_entries WHERE entry_key = ?', [entryKey]);
}

async function insertLedgerEntry(client, input) {
  await client.run(
    `
      INSERT INTO ledger_entries (
        id, entry_key, wallet_id, user_id, type, debit_bucket, credit_bucket, amount_cents,
        currency_code, reference_type, reference_id, external_reference, description, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      input.entryKey,
      input.walletId,
      input.userId,
      input.type,
      input.debitBucket || null,
      input.creditBucket || null,
      input.amountCents,
      input.currencyCode,
      input.referenceType,
      input.referenceId,
      input.externalReference || null,
      input.description,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString()
    ]
  );
}

async function creditPendingFromInvoice(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.getOrCreate(client, input.userId, input.currencyCode);
    ensureSameCurrency(wallet.currencyCode, input.currencyCode);

    const entryKey = `invoice-paid:${input.invoiceId}:${input.eventId}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      pendingBalanceCents: wallet.pendingBalanceCents + ensurePositiveMoney(input.amountCents)
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.INVOICE_PENDING_CREDIT,
      creditBucket: BALANCE_BUCKET.PENDING,
      amountCents: input.amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'INVOICE',
      referenceId: input.invoiceId,
      externalReference: input.eventId,
      description: 'Invoice payment credited to pending balance.'
    });

    return nextWallet;
  });
}

async function releasePendingFunds(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);
    if (wallet.pendingBalanceCents < amountCents) {
      throw new AppError(409, 'INSUFFICIENT_PENDING_BALANCE', 'Insufficient pending balance to release funds.');
    }

    const entryKey = `funds-release:${input.invoiceId}:${input.idempotencyKey || amountCents}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      pendingBalanceCents: wallet.pendingBalanceCents - amountCents,
      availableBalanceCents: wallet.availableBalanceCents + amountCents
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.FUNDS_RELEASE,
      debitBucket: BALANCE_BUCKET.PENDING,
      creditBucket: BALANCE_BUCKET.AVAILABLE,
      amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'INVOICE',
      referenceId: input.invoiceId,
      description: 'Released invoice funds from pending to available balance.'
    });

    return nextWallet;
  });
}

async function getReleasedFundsForInvoice(invoiceId, client = db) {
  const row = await client.get(
    `
      SELECT COALESCE(SUM(amount_cents), 0) AS total
      FROM ledger_entries
      WHERE type = ? AND reference_type = 'INVOICE' AND reference_id = ?
    `,
    [LEDGER_ENTRY_TYPE.FUNDS_RELEASE, invoiceId]
  );

  return row ? row.total : 0;
}

async function reservePayoutFunds(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);
    if (wallet.availableBalanceCents < amountCents) {
      throw new AppError(409, 'INSUFFICIENT_AVAILABLE_BALANCE', 'Insufficient available balance for payout.');
    }

    const entryKey = `payout-reserve:${input.payoutId}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      availableBalanceCents: wallet.availableBalanceCents - amountCents,
      frozenBalanceCents: wallet.frozenBalanceCents + amountCents
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.PAYOUT_RESERVE,
      debitBucket: BALANCE_BUCKET.AVAILABLE,
      creditBucket: BALANCE_BUCKET.FROZEN,
      amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'PAYOUT',
      referenceId: input.payoutId,
      description: 'Reserved payout funds from available to frozen balance.'
    });

    return nextWallet;
  });
}

async function settlePayout(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);
    const entryKey = `payout-settle:${input.payoutId}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    if (wallet.frozenBalanceCents < amountCents) {
      throw new AppError(409, 'INSUFFICIENT_FROZEN_BALANCE', 'Insufficient frozen balance to settle payout.');
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      frozenBalanceCents: wallet.frozenBalanceCents - amountCents,
      paidOutBalanceCents: wallet.paidOutBalanceCents + amountCents
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.PAYOUT_SETTLED,
      debitBucket: BALANCE_BUCKET.FROZEN,
      creditBucket: BALANCE_BUCKET.PAID_OUT,
      amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'PAYOUT',
      referenceId: input.payoutId,
      description: 'Settled payout from frozen to paid out balance.'
    });

    return nextWallet;
  });
}

async function refundReservedPayout(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);
    const entryKey = `payout-refund:${input.payoutId}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    if (wallet.frozenBalanceCents < amountCents) {
      throw new AppError(409, 'INSUFFICIENT_FROZEN_BALANCE', 'Insufficient frozen balance to release payout.');
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      frozenBalanceCents: wallet.frozenBalanceCents - amountCents,
      availableBalanceCents: wallet.availableBalanceCents + amountCents
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.PAYOUT_RELEASE_REFUND,
      debitBucket: BALANCE_BUCKET.FROZEN,
      creditBucket: BALANCE_BUCKET.AVAILABLE,
      amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'PAYOUT',
      referenceId: input.payoutId,
      description: input.reason
    });

    return nextWallet;
  });
}

async function adjustForInvoiceRefund(input) {
  return transaction(async (client) => {
    const wallet = await walletRepository.findByUserId(input.userId, client);
    if (!wallet) {
      throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found.');
    }

    ensureSameCurrency(wallet.currencyCode, input.currencyCode);
    const amountCents = ensurePositiveMoney(input.amountCents);
    const entryKey = `invoice-refund:${input.invoiceId}:${input.eventId}`;
    if (await findLedgerEntryByKey(client, entryKey)) {
      return wallet;
    }

    const pendingReduction = Math.min(wallet.pendingBalanceCents, amountCents);
    const remainingReduction = amountCents - pendingReduction;
    if (wallet.availableBalanceCents < remainingReduction) {
      throw new AppError(409, 'INSUFFICIENT_BALANCE_FOR_REFUND', 'Insufficient balance to apply invoice refund.');
    }

    const nextWallet = await walletRepository.updateBalances(client, wallet.id, {
      pendingBalanceCents: wallet.pendingBalanceCents - pendingReduction,
      availableBalanceCents: wallet.availableBalanceCents - remainingReduction
    });

    await insertLedgerEntry(client, {
      entryKey,
      walletId: wallet.id,
      userId: input.userId,
      type: LEDGER_ENTRY_TYPE.INVOICE_REFUND_ADJUSTMENT,
      debitBucket: remainingReduction > 0 ? BALANCE_BUCKET.AVAILABLE : BALANCE_BUCKET.PENDING,
      amountCents,
      currencyCode: input.currencyCode,
      referenceType: 'INVOICE',
      referenceId: input.invoiceId,
      externalReference: input.eventId,
      description: 'Applied invoice refund adjustment to wallet balances.',
      metadata: {
        pendingReductionCents: pendingReduction,
        availableReductionCents: remainingReduction
      }
    });

    return nextWallet;
  });
}

module.exports = {
  ledgerService: {
    creditPendingFromInvoice,
    releasePendingFunds,
    getReleasedFundsForInvoice,
    reservePayoutFunds,
    settlePayout,
    refundReservedPayout,
    adjustForInvoiceRefund
  }
};
