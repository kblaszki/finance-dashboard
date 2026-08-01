---
diataxis: tutorial
use_when: First local success — install, env, run app, log in
audience: human
related_docs:
  - docs/README.md
  - docs/tutorials/demo-seed.md
---

# Tutorial: first run

Goal: run finance-dashboard locally and open the UI. Full install notes: [README.md](../../README.md).

## 1. Install

From the repo root:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## 2. Configure backend env

```bash
cd backend
cp .env.example .env
```

Set `JWT_SECRET` (≥32 characters) and keep `DATABASE_URL` (default `file:./dev.db`). Do not commit `.env`.

## 3. Start

From the repo root:

```bash
npm run dev
```

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

## 4. Create a user

Open `/register` (when `ALLOW_REGISTER` is not false) or:

```bash
cd backend
npm run create-user -- --email you@example.com --username you --password 'your-password'
```

## 5. Log in

Open `http://localhost:5173/login` and sign in. After login you land on **Home** (`/home`); account profile is under **Settings**.

Next: [demo-seed.md](demo-seed.md) for the shared demo login, or [private-deploy.md](../how-to/private-deploy.md) for a locked-down instance.
