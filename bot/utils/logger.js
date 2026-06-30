'use strict';

const SERVICE_NAME = 'transferly-bot';
const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|signature|api[-_]?key|hmac)/i;

function redactValue(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      status: value.response?.status,
      requestId: value.apiContext?.requestId || value.response?.headers?.['x-request-id'],
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(nested, depth + 1),
      ]),
    );
  }
  if (typeof value === 'string' && value.length > 240) {
    return `${value.slice(0, 240)}...`;
  }
  return value;
}

function write(level, message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    ...redactValue(meta),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  debug: (message, meta) => {
    if (process.env.LOG_LEVEL === 'debug') write('debug', message, meta);
  },
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  redactValue,
};
