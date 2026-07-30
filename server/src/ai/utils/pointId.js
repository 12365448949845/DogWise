const crypto = require('crypto');

function deterministicPointId(seed) {
  const hex = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

module.exports = { deterministicPointId };
