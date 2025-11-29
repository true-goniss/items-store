import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '../config';

export interface HttpClientConfig {
  timeout?: number;
  baseURL?: string;
  headers?: Record<string, string>;
}

export class HttpClient {

    private client: AxiosInstance;

    constructor(private clientConfig: HttpClientConfig = {}) {
        this.client = axios.create({
            timeout: clientConfig.timeout || config.fetcher.timeout,
            baseURL: clientConfig.baseURL,
            headers: clientConfig.headers,
        });
    }

    async request<T>(config: AxiosRequestConfig): Promise<T> {
        return this.withRetry(async () => {
            const response = await this.client.request<T>(config);
            return response.data;
        }, `HTTP Request to ${config.url}`);
    }

    async get<T>(url: string, config?: Omit<AxiosRequestConfig, 'url' | 'method'>): Promise<T> {
        return this.request<T>({
            ...config,
            url,
            method: 'GET',
        });
    }

    private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
    ): Promise<T> {

        for (let attempt = 1; attempt <= config.fetcher.maxRetries; attempt++) {
                try {
                    
                    console.log(`[HttpClient] ${context} - Attempt ${attempt}`);
                    
                    if (attempt > 1) {
                        await this.delay(config.fetcher.retryDelay * attempt);
                    }

                    const result = await operation();
                    console.log(`[HttpClient] ${context} - Success on attempt ${attempt}`);
                    return result;

                } catch (error: any) {
                    console.warn(`[HttpClient] ${context} - Attempt ${attempt} failed:`, error.message);
                
                if (attempt === config.fetcher.maxRetries) {
                    throw new Error(`${context} failed after ${config.fetcher.maxRetries} attempts: ${error.message}`);
                }
            }
        }

        throw new Error('Unexpected error in withRetry');
    }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}