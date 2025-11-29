import { SkinportItemsFetcher, SkinportItem } from '../types';
import { HttpClientFactory } from '../http/http_client_factory';
import { config } from '../config';

// fetcher для получения с ScraperAPI (нужен SCRAPERAPI_KEY в .env)
export class ScraperAPIFetcher implements SkinportItemsFetcher {
  private httpClient = HttpClientFactory.createScraperClient();

  async fetchItems(): Promise<SkinportItem[]> {
    if (!config.api.scraper.apiKey) {
      throw new Error('ScraperAPI key is required');
    }

    const params = {
      api_key: config.api.scraper.apiKey,
      url: config.api.skinport.baseUrl,
      app_id: config.api.skinport.appId,
      currency: config.api.skinport.currency,
    };

    return this.httpClient.get<SkinportItem[]>('', { params });
  }
}