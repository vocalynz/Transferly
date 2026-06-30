const { pbkdf2Sync, randomBytes, timingSafeEqual } = require('node:crypto');

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return {
    salt,
    hash
  };
}

function verifyPassword(password, salt, hash) {
  const calculated = pbkdf2Sync(password, salt, 120000, 64, 'sha512');
  const expected = Buffer.from(hash, 'hex');

  if (calculated.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(calculated, expected);
}

module.exports = {
  hashPassword,
  verifyPassword
};
