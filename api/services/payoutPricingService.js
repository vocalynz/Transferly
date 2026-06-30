function buildPayoutPricing(amountCents, platformConfig) {
  const feeFixedCents = Number(platformConfig.payout_fee_fixed_cents || 0);
  const feePercentageBps = Number(platformConfig.payout_fee_percentage_bps || 0);
  const percentageFeeCents = Math.round(amountCents * (feePercentageBps / 10000));
  const feeCents = feeFixedCents + percentageFeeCents;

  return {
    requestedAmountCents: amountCents,
    feeCents,
    totalDebitCents: amountCents + feeCents,
    feeFixedCents,
    feePercentageBps
  };
}

module.exports = {
  buildPayoutPricing
};
