import { AppConfig } from "./types";

export const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '7777'),
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    updateIntervalMinutes: parseInt(process.env.UPDATE_INTERVAL_MIN || '5', 10),
  },
  cache: {
    ttl: 600, // 10 минут
    keyPrefix: 'skinport:items',
    freshnessThreshold: 5, // данные считаются свежими до 5 минут
  },
  api: {
    skinport: {
      baseUrl: 'https://api.skinport.com/v1/items',
      appId: 730,
      currency: 'EUR',
    },
    dropbox: {
      itemsUrl: 'https://www.dropbox.com/scl/fi/ryb5m9zhyvmox4uh8n1rz/items.json?rlkey=mhf3pguuw1rdy0a3s78f6ij34&st=yo5nlph5&dl=1',
    },
    scraper: {
      baseUrl: 'http://api.scraperapi.com',
      apiKey: process.env.SCRAPERAPI_KEY,
    },
  },
  fetcher: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 2000,
  },
  http: {
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
    ],
    skinportHeaders: {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Referer': 'https://skinport.com/',
      'Origin': 'https://skinport.com',
    },
  },
};