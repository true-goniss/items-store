import { Pool } from 'pg';
import axios, { AxiosInstance } from 'axios';
import { FetchedItem, ProductValue } from './types'


export class ItemSyncService {

    private client: AxiosInstance;
    private readonly itemsServiceUrl: string;
    private readonly currency = 'EUR'; // Валюта в которой skinport возвращает цены

    constructor(private dbPool: Pool) {
        // items-service должен быть точно доступен и т.п.
        this.itemsServiceUrl = process.env.ITEMS_SERVICE_URL || 'http://items-service:7777'; 
        this.client = axios.create({ baseURL: this.itemsServiceUrl, timeout: 10000 });
    }

    /**
     * Выполняет полную очистку таблицы products и заполнение новыми данными.
     */
    async syncAndPopulateProducts(): Promise<number> {

        console.log(`[Sync] Fetching items from ${this.itemsServiceUrl}/items...`);

        const response = await this.client.get<{ data: FetchedItem[] }>(`/items`);
        const fetchedItems = response.data.data;
        let insertedCount = 0;

        // Транзакция для очистки и вставки (атомарное обновление каталога)
        const client = await this.dbPool.connect();
        try {
            await client.query('BEGIN'); // начало

            
            // Вставка товаров
            for (const item of fetchedItems) {
                if (item.min_price_tradable === null) continue;
                
                await client.query(`
                    INSERT INTO products (name, price, currency) 
                    VALUES ($1, $2, $3)
                    ON CONFLICT (name) 
                    DO UPDATE SET 
                        price = EXCLUDED.price,
                        currency = EXCLUDED.currency
                `, [item.market_hash_name, item.min_price_tradable, this.currency]);
            }


            // // Очистка
            // for (const item of fetchedItems) {
            //     if (item.min_price_tradable === null) continue;
                
            //     await client.query(`
            //         INSERT INTO products (name, price, currency) 
            //         VALUES ($1, $2, $3)
            //         ON CONFLICT (name) 
            //         DO UPDATE SET 
            //             price = EXCLUDED.price,
            //             currency = EXCLUDED.currency
            //     `, [item.market_hash_name, item.min_price_tradable, this.currency]);
            // }

            // // Подготовка данных для вставки
            // const values: ProductValue[] = fetchedItems
            //     .filter((item: FetchedItem) => item.min_price_tradable !== null)
            //     .map((item: FetchedItem) => ({
            //         name: item.market_hash_name,
            //         price: item.min_price_tradable as number, // We know it's not null due to filter
            //         currency: this.currency
            //     }));

            // // Пакетная вставка (защита от инъекций библиотекой pg)
            // const query = `
            //     INSERT INTO products (name, price, currency)
            //     SELECT name, price, currency
            //     FROM UNNEST($1::text[], $2::numeric[], $3::text[]) AS t(name, price, currency)
            // `;

            // массив объектов в три массива для UNNEST
            // const names = values.map((v: ProductValue) => v.name);
            // const prices = values.map((v: ProductValue) => v.price);
            // const currencies = values.map((v: ProductValue) => v.currency);
            
            // await client.query(query, [names, prices, currencies]);
            // insertedCount = names.length;

            await client.query('COMMIT'); // конец
            console.log(`[Sync] Successfully populated ${insertedCount} products.`);
            return insertedCount;

        } catch (error) {
            await client.query('ROLLBACK'); // откат
            console.error('[Sync] Failed to populate products:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}