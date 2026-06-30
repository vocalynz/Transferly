function parseJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function serializeJson(value) {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value ?? null);
}

module.exports = {
  parseJson,
  serializeJson
};
