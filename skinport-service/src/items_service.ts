import { RedisVault } from './cache/redis_vault';
import { SkinportItem, ServiceResponse, ProcessedItem, SkinportItemsFetcher } from './types';
import { PreloadedFetcher } from './fetchers/preloaded_fetcher';
import { config } from './config';

export class ItemsService {
    private readonly cacheKey: string;
    private updateInterval: NodeJS.Timeout | null = null;
    private updateLock = new Map<string, Promise<ServiceResponse>>();

    constructor(
        private redisVault: RedisVault,
        private fetcher: SkinportItemsFetcher = new PreloadedFetcher()
    ) {
        this.cacheKey = `${config.cache.keyPrefix}:processed`;
    }

    /**
     * Получает предметы с минимальными ценами из кэша или API
     */
    async getItemsWithMinPrices(): Promise<ServiceResponse> {
        const cached = await this.redisVault.getWithMetadata<ServiceResponse>(this.cacheKey);

        if (cached) {
            return this.buildSuccessResponse(
                cached.data.data,
                cached.data.currency,
                cached.updatedAt, 
                'fresh'
            );
        }

        // Если кэша нет, создаем блокировку для предотвращения дублирующих запросов
        if (!this.updateLock.has(this.cacheKey)) {
            this.updateLock.set(this.cacheKey, this.fetchAndCacheData());
        }

        console.warn('[ItemsService] Cache miss or Redis down. Fetching from API directly.');
        
        const result = await this.updateLock.get(this.cacheKey)!;
        this.updateLock.delete(this.cacheKey);
        return result;
    }

    /**
     * Запускает фоновые обновления данных
     */
    startBackgroundUpdates(intervalMinutes: number): void {
        if (this.updateInterval) {
            console.warn('[ItemsService] Background updates already running.');
            return;
        }

        console.log(`[ItemsService] Starting background updates every ${intervalMinutes} minutes.`);

        // Немедленный запуск при старте
        this.executeBackgroundUpdate('Initial update');

        const intervalMs = intervalMinutes * 60 * 1000;
        this.updateInterval = setInterval(() => {
            this.executeBackgroundUpdate('Scheduled update');
        }, intervalMs);
    }

    /**
     * Останавливает фоновые обновления
     */
    stopBackgroundUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('[ItemsService] Background updates stopped.');
        }
    }

    /**
     * Получает время последнего обновления
     */
    async getLastUpdateTime(): Promise<Date | null> {
        const cached = await this.redisVault.getWithMetadata<ServiceResponse>(this.cacheKey);
        return cached ? new Date(cached.updatedAt) : null;
    }

    /**
     * Проверяет свежесть данных
     */
    async isDataFresh(freshnessMinutes: number = 10): Promise<boolean> {
        return this.redisVault.isValueFresh(this.cacheKey, freshnessMinutes);
    }

    /**
     * Выполняет фоновое обновление с обработкой ошибок
     */
    private async executeBackgroundUpdate(context: string): Promise<void> {
        try {
            await this.fetchAndCacheData();
            console.log(`[ItemsService] ${context} completed successfully.`);
        } catch (error) {
            console.error(`[ItemsService] ${context} failed:`, error);
        }
    }

    /**
     * Валидирует и обрабатывает предмет
     */
    private validateAndProcessItem(item: any): ProcessedItem | null {
        try {
            if (!item?.market_hash_name) return null;
            
            return {
                market_hash_name: String(item.market_hash_name),
                min_price_tradable: item.min_price ? Number(item.min_price) : null,
                min_price_non_tradable: item.suggested_price ? Number(item.suggested_price) : null,
            };
        } catch (error) {
            console.warn('[ItemsService] Invalid item skipped:', error);
            return null;
        }
    }

    /**
     * Обрабатывает массив предметов, фильтруя невалидные
     */
    private processItems(rawItems: SkinportItem[]): ProcessedItem[] {
        return rawItems
            .map(item => this.validateAndProcessItem(item))
            .filter((item): item is ProcessedItem => item !== null);
    }

    /**
     * Формирует успешный ответ сервиса
     */
    private buildSuccessResponse(
        data: ProcessedItem[],
        currency: string,
        updatedAt: number, 
        cacheStatus: ServiceResponse['cacheStatus']
    ): ServiceResponse {
        return {
            success: true,
            currency,
            data,
            lastUpdate: new Date(updatedAt).toISOString(),
            cacheStatus
        };
    }

    /**
     * Получает данные из API, обрабатывает и сохраняет в кэш
     */
    private async fetchAndCacheData(): Promise<ServiceResponse> {
        try {
            const rawItems = await this.fetcher.fetchItems();
            const processedItems = this.processItems(rawItems);

            const result = this.buildSuccessResponse(
                processedItems,
                config.api.skinport.currency,
                Date.now(),
                'fresh'
            );

            await this.redisVault.set(this.cacheKey, result, config.cache.ttl);
            console.log(`[ItemsService] Successfully updated cache with ${processedItems.length}/${rawItems.length} items.`);

            return result;

        } catch (error) {
            console.error('[ItemsService] API Fetch Error:', error instanceof Error ? error.message : error);
            
            // Пытаемся вернуть устаревший кэш с пометкой
            const staleCache = await this.redisVault.getWithMetadata<ServiceResponse>(this.cacheKey);
            if (staleCache) {
                console.warn('[ItemsService] Returning stale cache due to API failure.');
                return this.buildSuccessResponse(
                    staleCache.data.data,
                    staleCache.data.currency,
                    staleCache.updatedAt, 
                    'stale'
                );
            }

            throw new Error('Failed to fetch data and no cache available');
        }
    }
}