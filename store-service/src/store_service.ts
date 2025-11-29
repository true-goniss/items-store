import { Pool, PoolClient } from 'pg';
import { InventoryItem } from './types';
import { QueryResultRow } from 'pg';

export class StoreService {

    constructor(private dbPool: Pool) {}

    /**
     * Атомарная транзакция покупки.
     * SELECT FOR UPDATE для блокировки строки пользователя.
     */
    async purchaseProduct(userId: number, productId: number): Promise<number> {

        const client: PoolClient = await this.dbPool.connect();

        try {

            await client.query('BEGIN'); // Начало транзакции

            // проверка товара, получение цены
            const productRes = await client.query('SELECT price FROM products WHERE id = $1', [productId]);
            if (productRes.rows.length === 0) {
            throw new Error('Product not found');
            }

            // price приходит как строка '15.50' из DECIMAL
            const price = parseFloat(productRes.rows[0].price); 

            // ПРоверка баланса, блок записи FOR UPDATE
            const userRes = await client.query(
                'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
                [userId]
            );

            if (userRes.rows.length === 0) {
                throw new Error('User not found');
            }

            const currentBalance = parseFloat(userRes.rows[0].balance);
            
            if (currentBalance < price) {
                throw new Error(`Insufficient funds. Required: ${price}, Current: ${currentBalance}`);
            }

            // Списание средств, обновление баланса
            const updateRes = await client.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance',
                [price, userId]
            );
            
            const newBalance = parseFloat(updateRes.rows[0].balance);

            // Запись о покупке
            await client.query(
                'INSERT INTO purchases (user_id, product_id, price) VALUES ($1, $2, $3)',
                [userId, productId, price]
            );

            await client.query('COMMIT'); // Подтверждение транзакции
            
            console.log(`[StoreService] User ${userId} purchased Product ${productId}. New balance: ${newBalance}`);
            return newBalance;

        } catch (error) {
            await client.query('ROLLBACK'); // Откат транзакции
            throw error;
        } finally {
            client.release(); // Возврат клиента в пул
        }
    }

    /**
    * Атомарно пополнить баланс пользователя.
    */
    async depositBalance(userId: number, amount: number): Promise<number> {

        if (amount <= 0) {
            throw new Error('Deposit amount must be positive');
        }

        const client: PoolClient = await this.dbPool.connect();

        try {
            await client.query('BEGIN'); // Начало транзакции

            // Обновление баланса и возврат нового значения
            const updateRes = await client.query(
                'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                [amount, userId]
            );

            if (updateRes.rows.length === 0) {
                throw new Error('User not found');
            }

            const newBalance = parseFloat(updateRes.rows[0].balance);

            // можно добавить запись в таблицу транзакций но здесь только обновление баланса

            await client.query('COMMIT'); // Подтверждение транзакции
            
            console.log(`[StoreService] User ${userId} deposited ${amount}. New balance: ${newBalance}`);
            return newBalance;

        } catch (error) {
            await client.query('ROLLBACK'); // Откат транзакции
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserInventory(userId: number): Promise<InventoryItem[]> {
        
        const client: PoolClient = await this.dbPool.connect();

        try {
            // Существует ли пользователь
            const userRes = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
            if (userRes.rows.length === 0) {
                throw new Error('User not found');
            }

            // Получить инвентарь пользователя
            const inventoryRes = await client.query(`
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    p.price as current_price,
                    p.currency,
                    pur.price as purchase_price,
                    pur.created_at as purchase_date,
                    COUNT(*) as quantity
                FROM purchases pur
                JOIN products p ON pur.product_id = p.id
                WHERE pur.user_id = $1
                GROUP BY p.id, p.name, p.price, p.currency, pur.price, pur.created_at
                ORDER BY pur.created_at DESC
            `, [userId]);

            // map to InventoryItem
            return inventoryRes.rows.map((row: QueryResultRow) => ({
                product_id: Number(row.product_id),
                product_name: row.product_name as string,
                current_price: parseFloat(row.current_price as string),
                purchase_price: parseFloat(row.purchase_price as string),
                currency: row.currency as string,
                purchase_date: new Date(row.purchase_date as string),
                quantity: Number(row.quantity)
            }));
            
        } finally {
            client.release();
        }
    }
}