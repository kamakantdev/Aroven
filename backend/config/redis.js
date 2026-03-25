/**
 * Redis Configuration
 * Supports:
 *  - Upstash REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  - Standard Redis URL (REDIS_URL / UPSTASH_REDIS_URL) via ioredis
 * Used for caching, session management, rate limiting
 */
const config = require('./index');

let redisClient = null;
let isConnected = false;

const serializeForTcp = (value) => {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const deserializeFromTcp = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const makeUpstashFacade = (client) => ({
  type: 'upstash-rest',
  ping: () => client.ping(),
  get: (key) => client.get(key),
  set: (key, value, opts = {}) => client.set(key, value, opts),
  setnx: (key, value, opts = {}) => client.set(key, value, { ...opts, nx: true }),
  del: (key) => client.del(key),
  incr: (key) => client.incr(key),
  expire: (key, seconds) => client.expire(key, seconds),
  xrevrange: (key, max, min, opts = {}) => client.xrevrange(key, max, min, opts),
});

const makeIoredisFacade = (client) => ({
  type: 'ioredis',
  ping: () => client.ping(),
  get: async (key) => deserializeFromTcp(await client.get(key)),
  set: async (key, value, opts = {}) => {
    const stored = serializeForTcp(value);
    if (opts.ex) {
      await client.set(key, stored, 'EX', opts.ex);
      return 'OK';
    }
    await client.set(key, stored);
    return 'OK';
  },
  setnx: async (key, value, opts = {}) => {
    const stored = serializeForTcp(value);
    if (opts.ex) {
      return await client.set(key, stored, 'NX', 'EX', opts.ex);
    }
    return await client.set(key, stored, 'NX');
  },
  del: (key) => client.del(key),
  incr: (key) => client.incr(key),
  expire: (key, seconds) => client.expire(key, seconds),
  xrevrange: async (key, max, min, opts = {}) => {
    if (opts.count) {
      return await client.xrevrange(key, max, min, 'COUNT', opts.count);
    }
    return await client.xrevrange(key, max, min);
  },
});

const getConnectionState = () => isConnected;

const connectRedis = async () => {
  if (redisClient) return redisClient;

  // 1) Prefer standard Redis TCP URL when configured (shared with AI service)
  if (config.redis.ioredisUrl) {
    try {
      const Redis = require('ioredis');
      const client = new Redis(config.redis.ioredisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 5000),
      });
      await client.connect();

      const facade = makeIoredisFacade(client);
      await facade.ping();

      redisClient = facade;
      isConnected = true;
      console.log('✅ Redis (ioredis) connected successfully');
      return redisClient;
    } catch (error) {
      console.error('❌ Redis (ioredis) connection error:', error.message);
      console.warn('⚠️  Falling back to Upstash REST if configured...');
    }
  }

  // 2) Fallback to Upstash REST when explicitly configured
  if (config.redis.url && config.redis.token) {
    try {
      const { Redis } = require('@upstash/redis');
      const client = new Redis({
        url: config.redis.url,
        token: config.redis.token,
      });

      const facade = makeUpstashFacade(client);
      await facade.ping();

      redisClient = facade;
      isConnected = true;
      console.log('✅ Redis (Upstash REST) connected successfully');
      return redisClient;
    } catch (error) {
      console.error('❌ Redis (Upstash REST) connection error:', error.message);
      console.warn('⚠️  Redis REST fallback failed. Continuing without Redis.');
    }
  }

  console.warn('⚠️  Redis not configured. Caching and live vitals stream reads will be unavailable.');
  return null;
};

const getRedisClient = () => redisClient;

// Cache helpers
const cacheGet = async (key) => {
  if (!redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('Redis GET error:', error.message);
    return null;
  }
};

const cacheSet = async (key, value, expirySeconds = 300) => {
  if (!redisClient) return false;
  try {
    await redisClient.set(key, value, { ex: expirySeconds });
    return true;
  } catch (error) {
    console.error('Redis SET error:', error.message);
    return false;
  }
};

const cacheDel = async (key) => {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error.message);
    return false;
  }
};

/**
 * Atomic set-if-not-exists with optional TTL.
 * Returns true if key was created, false if it already existed or on error.
 */
const cacheSetIfNotExists = async (key, value, expirySeconds = 300) => {
  if (!redisClient) return false;
  try {
    const result = await redisClient.setnx(key, value, { ex: expirySeconds });
    // ioredis returns 'OK' on success, null on already exists
    // Upstash returns 'OK' or null as well
    return result === 'OK' || result === true;
  } catch (error) {
    console.error('Redis SETNX error:', error.message);
    return false;
  }
};

/**
 * Atomic increment — fixes C12 race condition in chatbot rate limiting.
 * Uses Upstash REST INCR which is atomic server-side.
 * @param {string} key
 * @param {number} expirySeconds — sets TTL only on first creation
 * @returns {number|null} — new value after increment
 */
const cacheIncr = async (key, expirySeconds) => {
  if (!redisClient) return null;
  try {
    const newVal = await redisClient.incr(key);
    // Set TTL only when the key is first created (value becomes 1)
    if (newVal === 1 && expirySeconds) {
      await redisClient.expire(key, expirySeconds);
    }
    return newVal;
  } catch (error) {
    console.error('Redis INCR error:', error.message);
    return null;
  }
};

module.exports = { connectRedis, getRedisClient, getConnectionState, cacheGet, cacheSet, cacheDel, cacheIncr, cacheSetIfNotExists };
