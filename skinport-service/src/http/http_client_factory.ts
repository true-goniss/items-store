import { HttpClient, HttpClientConfig } from './http_client';
import { config } from '../config';

// немного over-engineering
export class HttpClientFactory {

    static createSkinportClient(): HttpClient {
        const randomUserAgent = config.http.userAgents[
            Math.floor(Math.random() * config.http.userAgents.length)
        ];

        const headers = {
            ...config.http.skinportHeaders,
            'User-Agent': randomUserAgent,
        };

        const clientConfig: HttpClientConfig = {
            timeout: config.fetcher.timeout,
            headers,
        };

        return new HttpClient(clientConfig);
    }

    static createDefaultClient(): HttpClient {
        return new HttpClient({
            timeout: config.fetcher.timeout,
        });
    }

    static createScraperClient(): HttpClient {
        return new HttpClient({
            timeout: config.fetcher.timeout,
            baseURL: config.api.scraper.baseUrl,
        });
    }
}