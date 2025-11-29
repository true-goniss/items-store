import { Hono, Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { pool } from './db';
import { StoreService } from './store_service';
import { ItemSyncService } from './item_sync_service';

import * as dotenv from 'dotenv';

dotenv.config();

const app = new Hono();
const storeService = new StoreService(pool);
const syncService = new ItemSyncService(pool);

const PORT = parseInt(process.env.PORT || '7778');

/**
 * Middleware для обработки ошибок и JSON
 */
app.use('*', async (c: Context, next: Next) => {
    try {
        await next();
    } catch (error) {
        console.error('[API Error]', error);

        // Обработка бизнес логики ошибок
        const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
        const status = errorMessage.includes('Insufficient funds') || 
                      errorMessage.includes('not found') || 
                      errorMessage.includes('Invalid') ? 400 : 500;
        
        return c.json({ 
            success: false, 
            message: errorMessage 
        }, status);
    }
});

/**
 * Покупка товара
 */
app.post('/api/purchase', async (c: Context) => {
    const body = await c.req.json();
    const user_id = parseInt(body.user_id, 10);
    const product_id = parseInt(body.product_id, 10);

    if (isNaN(user_id) || isNaN(product_id)) {
        return c.json({ success: false, message: 'Invalid user_id or product_id' }, 400);
    }

    const newBalance = await storeService.purchaseProduct(user_id, product_id);

    return c.json({
        success: true,
        new_balance: newBalance,
    });
});

/**
 * Пополнение баланса
 */
app.post('/api/deposit', async (c: Context) => {
    const body = await c.req.json();
    const user_id = parseInt(body.user_id, 10);
    const amount = parseFloat(body.amount);

    if (isNaN(user_id) || isNaN(amount) || amount <= 0) {
        return c.json({ 
            success: false, 
            message: 'Invalid user_id or amount (must be positive)' 
        }, 400);
    }

    const newBalance = await storeService.depositBalance(user_id, amount);

    return c.json({
        success: true,
        new_balance: newBalance,
        message: 'Deposit successful'
    });
});

/**
 * Health Check
 */
app.get('/health', async (c: Context) => {
    try {
        await pool.query('SELECT 1'); // доступность БД
        return c.json({ 
            status: 'ok', 
            db: 'connected', 
            uptime: process.uptime() 
        });
    } catch (e) {
        return c.json({ 
            status: 'error', 
            db: 'disconnected' 
        }, 503);
    }
});

/**
 * Отладочный endpoint для пользователей
 */
app.get('/api/debug/users', async (c: Context) => {
    try {
        const result = await pool.query('SELECT id, username, balance FROM users ORDER BY id');
        
        return c.json({ 
            success: true, 
            users: result.rows 
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

/**
 * Инвентарь / история покупок пользователя
 */
app.get('/api/users/:user_id/inventory', async (c: Context) => {
    const userId = parseInt(c.req.param('user_id'), 10);

    if (isNaN(userId)) {
        return c.json({ success: false, message: 'Invalid user_id' }, 400);
    }

    try {
        const inventory = await storeService.getUserInventory(userId);

        return c.json({
            success: true,
            user_id: userId,
            inventory: inventory
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('User not found')) {
            return c.json({ 
                success: false, 
                message: errorMessage 
            }, 404);
        }

        return c.json({ 
            success: false, 
            message: errorMessage 
        }, 500);
    }
});

/**
 * Инициализация базы данных
 */
async function initializeDatabase() {
    try {
        console.log('[DB] Initializing database tables...');
        
        // init
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
                CONSTRAINT positive_balance CHECK (balance >= 0)
            )`,
            
            `CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL UNIQUE,
                price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
                currency VARCHAR(10) NOT NULL DEFAULT 'EUR'
            )`,
            
            `CREATE TABLE IF NOT EXISTS purchases (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                product_id INTEGER REFERENCES products(id),
                price DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE INDEX IF NOT EXISTS idx_purchases_user_product 
             ON purchases(user_id, product_id)`
        ];

        for (const tableQuery of tables) {
            await pool.query(tableQuery);
        }

        // init users
        await pool.query(`
            INSERT INTO users (username, balance) VALUES 
                ('rich_buyer', 1500.50),
                ('poor_buyer', 5.00)
            ON CONFLICT (username) DO NOTHING
        `);

        console.log('[DB] Database initialization completed');
    } catch (error) {
        console.error('[DB] Initialization failed:', error);
        throw error;
    }
}

/**
 * Запуск синхронизации продуктов
 */
async function startSync() {
    try {
        await new Promise(resolve => setTimeout(resolve, 12500)); 
        await initializeDatabase();
        await syncService.syncAndPopulateProducts();
    } catch (e) {
        console.error('[Sync] Failed to run initial product sync:', e);
        // Не фатальная ошибка
    }
}

/**
 * Graceful shutdown
 */
const shutdown = async (signal: string) => {
    console.log(`[Server] ${signal} received. Shutting down...`);
    
    // Закрытие пула
    await pool.end();
    console.log('[Server] PostgreSQL pool closed.');
    
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Запуск
startSync();

console.log(`[Store Server] Service running on port ${PORT}`);

serve({
    fetch: app.fetch,
    port: PORT
});