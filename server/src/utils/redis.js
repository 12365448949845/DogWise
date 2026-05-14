const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let client = null;
let available = false;

const getClient = () => {
  if (client) return client;

  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on('connect', () => {
    available = true;
    console.log('[Redis] Connected');
  });

  client.on('error', (err) => {
    available = false;
    if (err.code !== 'ECONNREFUSED') {
      console.error('[Redis] Error:', err.message);
    }
  });

  client.on('close', () => {
    available = false;
  });

  client.connect().catch(() => {
    console.log('[Redis] Not available — running without cache');
  });

  return client;
};

const isAvailable = () => available;

const get = async (key) => {
  if (!available) return null;
  try {
    const data = await getClient().get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttlSeconds = 60) => {
  if (!available) return;
  try {
    await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { /* silent */ }
};

const del = async (...keys) => {
  if (!available) return;
  try {
    await getClient().del(...keys);
  } catch { /* silent */ }
};

const delByPattern = async (pattern) => {
  if (!available) return;
  try {
    const keys = await getClient().keys(pattern);
    if (keys.length > 0) await getClient().del(...keys);
  } catch { /* silent */ }
};

// Initialize on import
getClient();

module.exports = { get, set, del, delByPattern, isAvailable };
