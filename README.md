# Items Store
Прототип микросервисной системы для маркетплейса CS:GO скинов с синхронизацией цен в реальном времени и управлением инвентарем.

## Обзор функций:
- Синхронизация цен в реальном времени из Skinport API
- Кэширование обработанных цен в Redis для оптимизации производительности
- Система покупок пользователей, обновление баланса, инвентаря
- PostgreSQL с транакциями для управления данными
- Docker для развертывания
- Аутентификация, и т.п. не реализованы, это прототип.

часть со скриптом которая поднимает браузер и обходит там cloudflare-капчу есть, но не входит в комплект

## Архитектура (Микросервисы)
### Items Service (skinport-service):

- Получает и кэширует цены CS:GO скинов из Skinport API
- Предоставляет REST API для данных о скинах с кэшированием в Redis
- Фоновое обновление цен с настраиваемыми интервалами

### Store Service (store-service):

- Управляет аккаунтами пользователей, балансами и покупками
- Синхронизирует каталог товаров из items service
- Обрабатывает транзакции с гарантией согласованности БД
- Управление инвентарем пользователей

##  Технологический стек
- Backend: Node.js, TypeScript, Hono framework
- DB: PostgreSQL
- Cache: Redis (ioredis)
- HTTP: Axios
- Docker

# API
## Items Service
- `GET /items` - Получить все предметы с минимальными ценами:
  
  ```json
  {"success":true,"currency":"EUR","data":[
    {
    "market_hash_name":"Souvenir AK-47 | Green Laminate (Factory New)",
    "min_price_tradable":32.99,
    "min_price_non_tradable":28.37
    }
  ]}
  ```
- `GET /health` - Проверка здоровья сервиса

## Store Service
- `POST /api/purchase` - Купить товар
  
  ```json
  {"success":true,"new_balance":1497.95}
  ```
- `POST /api/deposit` - Пополнить баланс пользователя
  ```json
  {"success":true,"new_balance":1454.7,"message":"Deposit successful"}
  ```
- `GET /api/users/:user_id/inventory` - Получить инвентарь пользователя
  ```json
  {"success":true,"user_id":1,"inventory":[
    {"product_id":1,
    "product_name":"Souvenir AK-47 | Green Laminate (Factory New)",
    "current_price":32.99,
    "purchase_price":32.99,
    "currency":"EUR",
    "purchase_date":"2025-11-29T12:19:46.134Z",
    "quantity":1}
  ]}
  ```

- `GET /api/debug/users` - Отладочный эндпоинт для данных пользователей
   ```json
    {"success":true,
    "users":[
      {"id":1,"username":"rich_buyer","balance":"1444.70"},
      {"id":2,"username":"poor_buyer","balance":"5.00"}
    ]}
  ```
- `GET /health` - Проверка здоровья сервиса

## Схема базы
<img src="https://raw.githubusercontent.com/true-goniss/items-store/refs/heads/main/items-store-db.png" width=65% height=45%>

a tesk task i made in vain
