# Resonant Telegram Mini App — ready package

## Structure

```text
resonant/
├── bot.py
├── index.html
├── requirements.txt
├── .env.example
├── admin.py
├── database.py
├── payments.py
├── assets/
│   ├── cases/
│   │   ├── royal.jpg
│   │   ├── crystal.jpg
│   │   ├── ice.jpg
│   │   ├── silver.jpg
│   │   ├── blue.jpg
│   │   └── starter.jpg
│   └── resonant-hero.jpeg
└── resonant.sqlite3        # created automatically on first run
```

## Install

Python 3.13 is supported.

```bash
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\\Scripts\\activate       # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set at least `BOT_TOKEN`, `BASE_URL`, and `WEBHOOK_SECRET`.
For admin features set `ADMIN_IDS`.

## Run

```bash
python bot.py
```

The FastAPI app is exposed by the code in `bot.py`; the exact startup/webhook behavior is defined there. Static files under `assets/` are served at `/assets/`, so the case images used by the Mini App load correctly in Telegram.

## Important

- Do **not** upload or run `__pycache__/bot.cpython-313.pyc` manually. Python generates `.pyc` files itself.
- `REAL_ECONOMY=false` should be used during development.
- Real USDT deposits require a valid `CRYPTOBOT_TOKEN` and a public HTTPS deployment.
- Withdrawals are manually reviewed through the admin flow.
- The supplied UI's case screens remain preview-only because the supplied server source does not define a case/inventory/drop-table model.
- SQLite is suitable for a small deployment. For high concurrency, move persistence to PostgreSQL before production.
