

export interface SkinportItem {
  market_hash_name: string;
  currency: string;
  suggested_price: number | null;
  item_page: string;
  market_page: string;
  min_price: number | null;
  quantity: number;
}

export interface ProcessedItem {
  market_hash_name: string;
  min_price_tradable: number | null;
  min_price_non_tradable: number | null;
}

export interface ServiceResponse {
  success: boolean;
  currency: string;
  data: ProcessedItem[];
  lastUpdate?: string; // ISO string времени последнего обновления
  cacheStatus?: 'fresh' | 'stale' | 'miss'; // статус кэша для отладки
}

export interface CacheEnvelope<T> {
  updatedAt: number;
  data: T;
}

export interface SkinportItemsFetcher {
  fetchItems(): Promise<SkinportItem[]>;
}

export interface AppConfig {
  server: {
    port: number;
    redisUrl: string;
    updateIntervalMinutes: number;
  };
  cache: {
    ttl: number;
    keyPrefix: string;
    freshnessThreshold: number; // порог свежести в минутах
  };
  api: {
    skinport: {
      baseUrl: string;
      appId: number;
      currency: string;
    };
    dropbox: {
      itemsUrl: string;
    };
    scraper: {
      baseUrl: string;
      apiKey?: string;
    };
  };
  fetcher: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  http: {
    userAgents: string[];
    skinportHeaders: Record<string, string>;
  };
}