import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { RedisClient } from './cache/redis_client';
import { RedisVault } from './cache/redis_vault';
import { ItemsService } from './items_service';
import * as dotenv from 'dotenv';
import type { Context } from 'hono';

dotenv.config();

const PORT = parseInt(process.env.PORT || '7777');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL_MIN || '5', 10);

async function bootstrap() {
  const app = new Hono();

  // Инициализация слоев
  const redisClient = new RedisClient(REDIS_URL);
  const redisVault = new RedisVault(redisClient);
  const itemsService = new ItemsService(redisVault);

  // Запуск фоновых задач
  itemsService.startBackgroundUpdates(UPDATE_INTERVAL);

  // Endpoint API
  app.get('/items', async (c: Context) => {
    try {
      const result = await itemsService.getItemsWithMinPrices();
      return c.json(result);
    } catch (error) {
      return c.json({ 
        success: false, 
        message: 'Service unavailable', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 503);
    }
  });

  // Health Check
  app.get('/health', async (c: Context) => {
    const redisStatus = redisClient.getClient().status;
    return c.json({
      status: 'ok',
      redis: redisStatus,
      uptime: process.uptime()
    });
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] ${signal} received. Shutting down...`);
    
    itemsService.stopBackgroundUpdates();
    
    console.log('[Server] HTTP server closing...');
    await redisClient.disconnect();
    console.log('[Server] Redis disconnected.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Запуск сервера Hono
  console.log(`[Server] Service running on port ${PORT}`);
  serve({
    fetch: app.fetch,
    port: PORT
  });
}

bootstrap().catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});