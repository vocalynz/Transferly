function liveStatus(service) {
  return service.status === 'available' ? 'live' : 'setup';
}

function serviceRoute(service, to) {
  return service.status === 'available' ? to : '';
}

function commandLane(service, id, title, subtitle, to, bullets, options = {}) {
  return {
    id,
    title,
    subtitle,
    status: options.status || liveStatus(service),
    ctaLabel: options.ctaLabel || `Open ${title}`,
    to: serviceRoute(service, to),
    bullets,
    kind: options.kind || id
  };
}

function notificationCommandCenter(service) {
  return {
    key: service.slug,
    title: `${service.title} Command Center`,
    eyebrow: 'Verified notification workspace',
    statusLabel: service.status === 'available' ? 'Live notification lanes' : 'Notification setup',
    description:
      `Use ${service.title} from one Transferly workspace for custom notifications, deposit context, saved templates, and support-safe receipt history.`,
    capabilities: ['Custom notification', 'Deposit context', 'Template reuse', 'Vault lookup'],
    lanes: [
      commandLane(service, 'custom-notification', 'Custom Notification', `Open the editable ${service.title} notification builder with brand context already applied.`, `/dashboard/generate?type=email&service=${service.slug}&mailType=custom`, [
        'Editable notification body',
        'Service-aware sender context',
        'Telegram-ready handoff'
      ]),
      commandLane(service, 'deposit-notification', 'Deposit Notification', `Create a deposit-focused ${service.title} notification without changing workspaces.`, `/dashboard/generate?type=email&service=${service.slug}&mailType=deposit`, [
        'Deposit wording preset',
        'Amount and recipient context',
        'Support review ready'
      ]),
      commandLane(service, 'template-library', 'Template Library', 'Reuse premium notification patterns before opening the builder.', '/miniapp/ops', [
        'Operator playbooks',
        'Reusable message structure',
        'Provider-safe labels'
      ]),
      commandLane(service, 'receipt-vault', 'Receipt Vault', 'Review previous receipts and support evidence linked to this service family.', '/miniapp/vault', [
        'Searchable history',
        'Receipt duplication',
        'Support handoff'
      ])
    ]
  };
}

function walletCommandCenter(service) {
  return {
    key: service.slug,
    title: `${service.title} Wallet Command Center`,
    eyebrow: 'Verified wallet workspace',
    statusLabel: service.status === 'available' ? 'Wallet record lanes live' : 'Wallet record setup',
    description:
      `Operate ${service.title} as a Transferly wallet-record workspace with record generation, support context, activity review, and related wallet services in one place.`,
    capabilities: ['Wallet record builder', 'Support context', 'Activity review', 'Related wallets'],
    lanes: [
      commandLane(service, 'wallet-record', 'Wallet Record', `Open the ${service.title} wallet-record builder with service context already selected.`, `/dashboard/generate?type=bank&service=${service.slug}`, [
        'Branded wallet context',
        'Transferly support record',
        'Point-aware launch'
      ]),
      commandLane(service, 'support-context', 'Support Context', 'Attach wallet-record details to the support desk when a customer needs help.', '/miniapp/support', [
        'Telegram identity context',
        'Current order reference',
        'Operator notes'
      ]),
      commandLane(service, 'wallet-activity', 'Wallet Activity', 'Review recent wallet, points, and receipt activity before sending updates.', '/miniapp/activity', [
        'Recent actions',
        'Funding history',
        'Receipt trail'
      ]),
      commandLane(service, 'balance-readiness', 'Balance Readiness', 'Check internal balance and payout-readiness signals before customer updates.', '/miniapp/wallet', [
        'Available points',
        'Pending state',
        'Funding guidance'
      ])
    ]
  };
}

const fixedCommandCenters = {
  'ai-reply': {
    eyebrow: 'Support AI workspace',
    statusLabel: 'Reply lanes live',
    capabilities: ['Reply drafting', 'Support context', 'Saved replies', 'Activity handoff'],
    lanes: [
      ['draft-reply', 'Draft Reply', 'Write a customer-safe response from current support context.', '/miniapp/support', ['Support tone', 'Payout and invoice context', 'Telegram-ready copy']],
      ['support-context', 'Support Context', 'Review identity, wallet, order, and receipt context before drafting.', '/miniapp/support', ['Current screen', 'Recent receipt', 'Wallet state']],
      ['saved-replies', 'Saved Replies', 'Use repeatable support wording for common Transferly cases.', '/miniapp/ops', ['Reusable templates', 'Operator consistency', 'Escalation phrasing']],
      ['activity-review', 'Activity Review', 'Check recent activity before sending a customer update.', '/miniapp/activity', ['Invoice events', 'Payout events', 'Receipt history']]
    ]
  },
  articles: {
    eyebrow: 'Knowledge library workspace',
    statusLabel: 'Playbooks live',
    capabilities: ['Runbooks', 'Provider setup notes', 'Operator training', 'Audit-friendly guidance'],
    lanes: [
      ['provider-runbooks', 'Provider Runbooks', 'Open provider setup and operations guidance.', '/miniapp/ops', ['Provider readiness', 'Webhook notes', 'Payout procedures']],
      ['support-playbooks', 'Support Playbooks', 'Use repeatable customer-support guidance.', '/miniapp/support', ['Customer language', 'Escalation paths', 'Current context']],
      ['activity-lessons', 'Activity Lessons', 'Review events that should become operator documentation.', '/miniapp/activity', ['Issue patterns', 'Status changes', 'Remediation notes']],
      ['security-notes', 'Security Notes', 'Keep sensitive workflow guidance close to security posture.', '/miniapp/security', ['Access rules', 'Audit reminders', 'Secret hygiene']]
    ]
  },
  'faker-data': {
    eyebrow: 'Sandbox QA workspace',
    statusLabel: 'Sandbox lanes live',
    capabilities: ['Demo payloads', 'QA screenshots', 'Training data', 'Safe test labels'],
    lanes: [
      ['sandbox-payload', 'Sandbox Payload', 'Open activity with clearly marked test context.', '/miniapp/activity', ['Demo-only records', 'QA context', 'Training use']],
      ['studio-preview', 'Studio Preview', 'Use the studio for screenshot and receipt-flow QA.', '/miniapp/studio', ['Preview inputs', 'Visual checks', 'Safe labels']],
      ['vault-review', 'Vault Review', 'Inspect sandbox receipts and duplicates in the vault.', '/miniapp/vault', ['Stored records', 'Duplicate checks', 'Support handoff']],
      ['operator-training', 'Operator Training', 'Pair test data with marketplace playbooks.', '/miniapp/ops', ['Runbook examples', 'Provider drills', 'Review practice']]
    ]
  },
  'crypto-receipts': {
    eyebrow: 'Receipt vault workspace',
    statusLabel: 'Vault lanes live',
    capabilities: ['Receipt search', 'Duplication', 'Export review', 'Support handoff'],
    lanes: [
      ['vault-search', 'Vault Search', 'Search and inspect provider receipt records.', '/miniapp/vault', ['Receipt lookup', 'Provider filters', 'Customer context']],
      ['duplicate-receipt', 'Duplicate Receipt', 'Reuse prior receipt structure inside the studio.', '/miniapp/studio', ['Faster recreation', 'Context carryover', 'Preview workflow']],
      ['support-handoff', 'Support Handoff', 'Attach receipt details to a support request.', '/miniapp/support', ['Receipt evidence', 'Order context', 'Telegram support']],
      ['activity-trail', 'Activity Trail', 'Review related payment, receipt, and operator events.', '/miniapp/activity', ['Timeline view', 'Status changes', 'Recent actions']]
    ]
  },
  'support-sites': {
    eyebrow: 'Support desk workspace',
    statusLabel: 'Support lanes live',
    capabilities: ['Escalations', 'Customer context', 'Help content', 'Support bundles'],
    lanes: [
      ['support-desk', 'Support Desk', 'Open the main Transferly support workspace.', '/miniapp/support', ['Telegram identity', 'Current screen', 'Support bundle']],
      ['escalation-states', 'Escalation States', 'Review cases that need operator attention.', '/miniapp/ops', ['Admin routing', 'Risk context', 'Assignment notes']],
      ['receipt-context', 'Receipt Context', 'Pull receipt and vault details into support.', '/miniapp/vault', ['Receipt evidence', 'Duplicate records', 'Customer history']],
      ['security-context', 'Security Context', 'Check safety posture before sensitive support actions.', '/miniapp/security', ['Access status', 'Audit trail', 'Sensitive workflows']]
    ]
  },
  'pass-clone': {
    eyebrow: 'Security workspace',
    statusLabel: 'Security lanes live',
    capabilities: ['Audit posture', 'Webhook health', 'Access review', 'Sensitive action checks'],
    lanes: [
      ['security-center', 'Security Center', 'Open account safety and provider-readiness checks.', '/miniapp/security', ['Account posture', 'Provider health', 'Audit history']],
      ['provider-readiness', 'Provider Readiness', 'Review provider configuration and operational health.', '/miniapp/ops', ['Readiness panels', 'Webhook state', 'Payment issues']],
      ['support-safety', 'Support Safety', 'Use support context for sensitive customer cases.', '/miniapp/support', ['Escalation context', 'Operator notes', 'Safe messaging']],
      ['activity-audit', 'Activity Audit', 'Inspect recent security-sensitive app activity.', '/miniapp/activity', ['Recent events', 'Operator actions', 'Status changes']]
    ]
  },
  'wallet-tracker': {
    eyebrow: 'Balance operations workspace',
    statusLabel: 'Balance lanes live',
    capabilities: ['Provider balances', 'Payout holds', 'Settlement windows', 'Wallet activity'],
    lanes: [
      ['balance-overview', 'Balance Overview', 'Open Transferly wallet and provider balance context.', '/miniapp/wallet', ['Available funds', 'Pending funds', 'Provider snapshots']],
      ['provider-ops', 'Provider Ops', 'Inspect provider readiness and finance operations.', '/miniapp/ops', ['Provider tabs', 'Webhook health', 'Payment issues']],
      ['payout-activity', 'Payout Activity', 'Review payout, funding, and release activity.', '/miniapp/activity', ['Recent payouts', 'Release state', 'Ledger events']],
      ['support-handoff', 'Support Handoff', 'Bring balance context into customer support.', '/miniapp/support', ['Wallet context', 'Funding issue', 'Customer update']]
    ]
  },
  'qr-code': {
    eyebrow: 'Payment QR workspace',
    statusLabel: 'QR lanes live',
    capabilities: ['QR creation', 'Invoice handoff', 'Receipt preview', 'Activity tracking'],
    lanes: [
      ['qr-studio', 'QR Studio', 'Create a payment QR entry point from the receipt studio.', '/miniapp/studio', ['Payment handoff', 'Mobile preview', 'Branded context']],
      ['invoice-handoff', 'Invoice Handoff', 'Connect QR workflows to provider invoice operations.', '/miniapp/ops', ['Provider invoices', 'Hosted links', 'Readiness checks']],
      ['vault-reference', 'Vault Reference', 'Review stored receipts linked to QR handoffs.', '/miniapp/vault', ['Receipt lookup', 'Duplicate support', 'Evidence trail']],
      ['qr-activity', 'QR Activity', 'Track recent QR and payment-link handoff activity.', '/miniapp/activity', ['Recent links', 'Receipt actions', 'Customer flow']]
    ]
  },
  'link-shortener': {
    eyebrow: 'Payment links workspace',
    statusLabel: 'Link lanes live',
    capabilities: ['Short links', 'Checkout handoff', 'Click context', 'Vault references'],
    lanes: [
      ['payment-links', 'Payment Links', 'Open link and payment handoff activity.', '/miniapp/activity', ['Recent links', 'Checkout handoff', 'Customer context']],
      ['studio-link', 'Studio Link', 'Prepare link-ready receipt and QR content.', '/miniapp/studio', ['Receipt preview', 'QR pairing', 'Mobile flow']],
      ['provider-links', 'Provider Links', 'Pair short links with provider invoice operations.', '/miniapp/ops', ['Hosted invoices', 'Provider status', 'Webhook follow-up']],
      ['link-support', 'Link Support', 'Attach link context to support requests.', '/miniapp/support', ['Customer support', 'Current link', 'Issue context']]
    ]
  },
  investinnova: {
    eyebrow: 'Template marketplace workspace',
    statusLabel: 'Marketplace lanes live',
    capabilities: ['Workflow templates', 'Provider onboarding', 'Support triage', 'Payout operations'],
    lanes: [
      ['template-marketplace', 'Template Marketplace', 'Browse premium workflow templates for Transferly operations.', '/miniapp/ops', ['Provider playbooks', 'Support templates', 'Payout workflows']],
      ['provider-onboarding', 'Provider Onboarding', 'Use templates for provider setup and readiness reviews.', '/miniapp/ops', ['Adapter setup', 'Webhook checklist', 'Environment review']],
      ['support-triage', 'Support Triage', 'Launch support templates with current customer context.', '/miniapp/support', ['Escalation copy', 'Customer-safe language', 'Support bundle']],
      ['payout-operations', 'Payout Operations', 'Use templates for review, approval, and reconciliation work.', '/miniapp/ops', ['Approval checklist', 'Risk review', 'Reconciliation notes']]
    ]
  }
};

function fixedCommandCenter(service) {
  const template = fixedCommandCenters[service.slug];

  if (!template) {
    return null;
  }

  return {
    key: service.slug,
    title: `${service.title} Command Center`,
    eyebrow: template.eyebrow,
    statusLabel: template.statusLabel,
    description: service.description,
    capabilities: template.capabilities,
    lanes: template.lanes.map(([id, title, subtitle, to, bullets]) =>
      commandLane(service, id, title, subtitle, to, bullets)
    )
  };
}

export function getServiceCommandCenter(service) {
  if (!service || service.category === 'Payment Providers') {
    return null;
  }

  if (service.category === 'Verified Notifications') {
    return notificationCommandCenter(service);
  }

  if (service.category === 'Verified Wallets') {
    return walletCommandCenter(service);
  }

  return fixedCommandCenter(service);
}

export function normalizeServiceCommandCenterView(value, commandCenter) {
  if (!commandCenter) {
    return '';
  }

  const laneIds = commandCenter.lanes.map((lane) => lane.id);

  if (laneIds.includes(value)) {
    return value;
  }

  return '';
}
