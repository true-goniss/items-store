import { SkinportItemsFetcher, SkinportItem } from '../types';
import { HttpClientFactory } from '../http/http_client_factory';
import { config } from '../config';

// получить напрямую с SkinPort. Но это не сработает, потому что там cloudflare
// для этого нужен браузер и обход капчи, что мы тянуть в docker в этот раз не будем
// поэтому лучше воспользоваться PreloadedFetcher
export class SkinportFetcher implements SkinportItemsFetcher {
  private httpClient = HttpClientFactory.createSkinportClient();

  async fetchItems(): Promise<SkinportItem[]> {
    const params = {
      app_id: config.api.skinport.appId,
      currency: config.api.skinport.currency,
      _t: Date.now(),
    };

    const response = await this.httpClient.get<SkinportItem[]>(
      config.api.skinport.baseUrl,
      { params }
    );

    if (!Array.isArray(response)) {
      throw new Error('Invalid response format: expected array');
    }

    return response;
  }
}