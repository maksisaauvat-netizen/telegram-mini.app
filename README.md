# Resonant Casino API

Минимальный backend для перехода DEMO → REAL.

## Быстрый старт (локально)

```bash
cd backend
npm install
# опционально:
# echo "BOT_TOKEN=123:ABC" > .env
# echo "START_BALANCE=1000" >> .env
npm start
```

## Deploy на Render

1. New → Web Service
2. Root Directory: `backend`
3. Build: `npm install`
4. Start: `npm start`
5. Environment:
   - `BOT_TOKEN` — токен от @BotFather
   - `START_BALANCE` — стартовый баланс (по умолчанию 1000)
   - `DEMO_FALLBACK=false` — в проде лучше выключить

После деплоя в `index.html`:

```js
CONFIG.REAL_ECONOMY = true;
CONFIG.API_BASE = 'https://YOUR-SERVICE.onrender.com';
CONFIG.BOT_USERNAME = 'YourBotUsername';
```

## Эндпоинты

| Method | Path | Описание |
|--------|------|----------|
| GET | `/health` | Статус |
| POST | `/api/balance` | Баланс пользователя |
| POST | `/api/bet` | Списать ставку, выдать `betId` |
| POST | `/api/bet/resolve` | Начислить выигрыш |
| POST | `/api/history` | История игр |

Тело запросов всегда включает `initData` (строка Telegram WebApp) и при необходимости `userId`.

## Важно

- Сейчас хранилище **in-memory** (сбрасывается при рестарте).
- Для продакшена подключи PostgreSQL / Redis.
- `initData` проверяется через HMAC-SHA-256 по [документации Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).


## Admin

Env `ADMIN_IDS` — список Telegram user ID через запятую.

| Method | Path | Описание |
|--------|------|----------|
| POST | `/api/admin/users` | Список пользователей |
| POST | `/api/admin/set-balance` | `{ targetId, balance }` |
| POST | `/api/admin/reset-user` | `{ targetId }` |
| POST | `/api/admin/stats` | Сводная статистика |

На фронте: `CONFIG.ADMIN_IDS = [123456789]` — те же ID, чтобы видеть кнопку Admin в профиле.
