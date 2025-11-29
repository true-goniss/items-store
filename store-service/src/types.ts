// Тип данных, который возвращает items-service (ProcessedItem)
export interface FetchedItem {
    market_hash_name: string;
    min_price_tradable: number | null;
}

export interface InventoryItem {
  product_id: number;
  product_name: string;
  current_price: number;
  purchase_price: number;
  currency: string;
  purchase_date: Date;
  quantity: number;
}

export interface InventoryResponse {
  success: boolean;
  user_id: number;
  inventory: InventoryItem[];
}

export interface ProductValue {
    name: string;
    price: number;
    currency: string;
}