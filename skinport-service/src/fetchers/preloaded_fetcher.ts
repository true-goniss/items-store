import { SkinportItemsFetcher, SkinportItem } from '../types';
import { HttpClientFactory } from '../http/http_client_factory';
import { config } from '../config';

// fetcher для получения с dropbox url
export class PreloadedFetcher implements SkinportItemsFetcher {
  private httpClient = HttpClientFactory.createDefaultClient();

  async fetchItems(): Promise<SkinportItem[]> {
    return this.httpClient.get<SkinportItem[]>(config.api.dropbox.itemsUrl);
  }
}