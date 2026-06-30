function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function escapeXmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const DEFAULT_THEME = {
  serviceKey: 'transferly',
  providerName: 'Transferly',
  category: 'Receipt Record',
  accent: '#2563eb',
  soft: '#eff6ff',
  ink: '#0f172a',
  muted: '#475569'
};

const RECEIPT_THEMES = {
  opay: {
    providerName: 'Opay',
    category: 'Bank Slip Record',
    accent: '#13a538',
    soft: '#ecfdf3'
  },
  kuda: {
    providerName: 'Kuda',
    category: 'Bank Slip Record',
    accent: '#40196d',
    soft: '#f5f0ff'
  },
  binance: {
    providerName: 'Binance',
    category: 'Crypto Transfer Record',
    accent: '#f0b90b',
    soft: '#fffbeb',
    ink: '#111827'
  },
  bybit: {
    providerName: 'Bybit',
    category: 'Crypto Transfer Record',
    accent: '#f7a600',
    soft: '#fff7ed'
  },
  coinbase: {
    providerName: 'Coinbase',
    category: 'Crypto Transfer Record',
    accent: '#0052ff',
    soft: '#eff6ff'
  },
  paypal: {
    providerName: 'PayPal',
    category: 'Payment Record',
    accent: '#0070ba',
    soft: '#eff6ff'
  },
  'crypto-com': {
    providerName: 'Crypto.com',
    category: 'Crypto Transfer Record',
    accent: '#103f91',
    soft: '#eef4ff'
  },
  wise: {
    providerName: 'Wise',
    category: 'Transfer Record',
    accent: '#9fe870',
    soft: '#f3ffe8',
    ink: '#163300'
  },
  'cash-app': {
    providerName: 'Cash App',
    category: 'Payment Record',
    accent: '#00d632',
    soft: '#ecfdf3'
  },
  zelle: {
    providerName: 'Zelle',
    category: 'Payment Record',
    accent: '#6d1ed4',
    soft: '#f5f0ff'
  },
  venmo: {
    providerName: 'Venmo',
    category: 'Payment Record',
    accent: '#008cff',
    soft: '#eff6ff'
  },
  'trust-wallet': {
    providerName: 'Trust Wallet',
    category: 'Wallet Transfer Record',
    accent: '#3375bb',
    soft: '#eef6ff'
  },
  gcash: {
    providerName: 'GCash',
    category: 'Mobile Wallet Record',
    accent: '#0057e4',
    soft: '#eff6ff'
  },
  'crypto-receipts': {
    providerName: 'Crypto',
    category: 'Blockchain Receipt Record',
    accent: '#14b8a6',
    soft: '#ecfdf8'
  }
};

function normalizeServiceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function findFieldValue(fields, label) {
  const field = fields.find((entry) => String(entry.label || '').toLowerCase() === label.toLowerCase());
  return field?.value || null;
}

function resolveReceiptTheme(metadata = {}, fields = []) {
  const serviceKey = normalizeServiceKey(metadata.service || findFieldValue(fields, 'Service'));
  const theme = RECEIPT_THEMES[serviceKey] || {};
  return {
    ...DEFAULT_THEME,
    ...theme,
    serviceKey: serviceKey || DEFAULT_THEME.serviceKey
  };
}

function buildSimplePdf(lines) {
  const contentLines = ['BT', '/F1 12 Tf', '50 760 Td'];

  lines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      return;
    }

    contentLines.push('0 -18 Td');
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });

  contentLines.push('ET');

  const contentStream = contentLines.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(contentStream, 'utf8')} >> stream\n${contentStream}\nendstream endobj`
  ];

  let output = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, 'utf8').toString('base64');
}

function buildSvgDataUrl({ title, subtitle, fields, theme, notice }) {
  const rows = fields
    .map((field, index) => {
      const y = 236 + index * 32;
      return `
        <rect x="56" y="${y - 20}" width="788" height="28" rx="6" fill="${index % 2 === 0 ? '#ffffff' : theme.soft}" />
        <text x="72" y="${y}" font-size="14" font-family="Arial, sans-serif" font-weight="700" fill="${escapeXmlText(theme.ink)}">${escapeXmlText(field.label)}</text>
        <text x="324" y="${y}" font-size="14" font-family="Arial, sans-serif" fill="${escapeXmlText(theme.ink)}">${escapeXmlText(field.value)}</text>
      `;
    })
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
      <rect width="900" height="600" fill="${escapeXmlText(theme.soft)}" />
      <rect x="24" y="24" width="852" height="552" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
      <rect x="24" y="24" width="852" height="108" rx="18" fill="${escapeXmlText(theme.accent)}" />
      <rect x="24" y="102" width="852" height="30" fill="${escapeXmlText(theme.accent)}" />
      <circle cx="78" cy="78" r="28" fill="#ffffff" opacity="0.95" />
      <text x="78" y="87" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" font-weight="700" fill="${escapeXmlText(theme.accent)}">${escapeXmlText(theme.providerName.charAt(0))}</text>
      <text x="124" y="70" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${escapeXmlText(theme.providerName)}</text>
      <text x="124" y="96" font-size="14" font-family="Arial, sans-serif" fill="#ffffff" opacity="0.88">${escapeXmlText(theme.category)}</text>
      <rect x="668" y="54" width="160" height="34" rx="17" fill="#ffffff" opacity="0.95" />
      <text x="748" y="76" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" font-weight="700" fill="${escapeXmlText(theme.accent)}">TRANSFERLY RECORD</text>
      <text x="56" y="170" font-size="24" font-family="Arial, sans-serif" font-weight="700" fill="${escapeXmlText(theme.ink)}">${escapeXmlText(title)}</text>
      <text x="56" y="198" font-size="14" font-family="Arial, sans-serif" fill="${escapeXmlText(theme.muted)}">${escapeXmlText(subtitle)}</text>
      ${rows}
      <line x1="56" y1="522" x2="844" y2="522" stroke="#e2e8f0" stroke-width="1" />
      <text x="56" y="550" font-size="12" font-family="Arial, sans-serif" fill="${escapeXmlText(theme.muted)}">${escapeXmlText(notice)}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function buildReceiptArtifacts(title, summary, fields, metadata = {}) {
  const theme = resolveReceiptTheme(metadata, fields);
  const notice = `Transferly generated record. Not an official ${theme.providerName} receipt.`;
  const pdfBase64 = buildSimplePdf([
    `${theme.providerName} ${theme.category}`,
    notice,
    title,
    summary,
    ...fields.map((field) => `${field.label}: ${field.value}`)
  ]);
  const imageDataUrl = buildSvgDataUrl({
    title,
    subtitle: summary,
    fields,
    theme,
    notice
  });

  return {
    pdfBase64,
    imageDataUrl,
    pdfDataUrl: `data:application/pdf;base64,${pdfBase64}`,
    layout: {
      service: theme.serviceKey,
      provider_name: theme.providerName,
      category: theme.category,
      notice
    }
  };
}

module.exports = {
  buildReceiptArtifacts
};
