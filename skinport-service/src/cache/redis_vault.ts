import { IRedisClient } from './redis_client';
import { CacheEnvelope } from '../types';

// RedisVault - место работы с клиентом Redis
export class RedisVault {
  constructor(private redisClient: IRedisClient) {}

  // задать по ключу
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const envelope: CacheEnvelope<T> = {
      updatedAt: Date.now(),
      data: value,
    };
    await this.redisClient.set(key, JSON.stringify(envelope), ttl);
  }

  // получить по ключу
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redisClient.get(key);
    if (!raw) return null;

    try {
      const envelope: CacheEnvelope<T> = JSON.parse(raw);
      return envelope.data;
    } catch (e) {
      console.error('[RedisVault] Parse error:', e);
      return null;
    }
  }

  // получить с временем обновления
  async getWithMetadata<T>(key: string): Promise<{ data: T; updatedAt: number } | null> {
    const raw = await this.redisClient.get(key);
    if (!raw) return null;

    try {
      const envelope: CacheEnvelope<T> = JSON.parse(raw);
      return {
        data: envelope.data,
        updatedAt: envelope.updatedAt
      };
    } catch (e) {
      console.error('[RedisVault] Parse error:', e);
      return null;
    }
  }

  // получить время без данных
  async getUpdateTime(key: string): Promise<Date> {
    const raw = await this.redisClient.get(key);
    if (!raw) return new Date(0); // Если ключа нет, считаем данные очень старыми

    try {
      const envelope: CacheEnvelope<unknown> = JSON.parse(raw);
      return new Date(envelope.updatedAt);
    } catch (e) {
      return new Date(0);
    }
  }

  // свежие ли данные по ключу?
  async isValueFresh(key: string, freshPeriodMinutes: number): Promise<boolean> {
    const lastUpdate = await this.getUpdateTime(key);
    const diffMs = Date.now() - lastUpdate.getTime();
    const freshPeriodMs = freshPeriodMinutes * 60 * 1000;
    return diffMs < freshPeriodMs;
  }
}