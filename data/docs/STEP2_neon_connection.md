# Step 2: Neon connection setup

## What you need

1. A Neon account and project: [sparkling-poetry-32997503](https://console.neon.tech/app/projects/sparkling-poetry-32997503)
2. The **connection string** from Neon Console → **Connection details** → copy URI

## One-time setup on your laptop

From the `fix-forward` folder:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-data.txt
cp .env.example .env
```

Edit `.env` and replace the placeholder with your real string:

```text
DATABASE_URL=postgresql://...@.../...?sslmode=require
```

**Never commit `.env` to GitHub.** It is already in `.gitignore`.

## Test the connection

```bash
python data/scripts/test_neon_connection.py
```

You should see: `SUCCESS: Connected to Neon.`

## Say this to your mentor

> "We store the Neon connection string in a local `.env` file that never goes to GitHub. A small test script runs `SELECT version()` to prove the database is reachable before we create any tables."
