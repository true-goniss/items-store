import Redis from 'ioredis';

export interface IRedisClient {
  set(key: string, value: string, ttl?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  disconnect(): Promise<void>;
  getClient(): Redis; // Для healthcheck
}

// RedisClient, обёртка над ioredis
export class RedisClient implements IRedisClient {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true, // Ждем явного подключения, чтобы не крашить при старте
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err: Error) => {
      console.error('[RedisClient] Connection error:', err.message);
    });
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
        console.error(`[RedisClient] success: Set key ${key}`);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error(`[RedisClient] Failed to set key ${key}:`, error);
      // Не выбрасываем ошибку, чтобы сервис работал без кэша
    }
  }

  async get(key: string): Promise<string | null> {
    try {

      const res = await this.client.get(key);
      console.error(`[RedisClient] success: Get key ${key}`);
      return res;

    } catch (error) {
      console.error(`[RedisClient] Failed to get key ${key}:`, error);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }
}