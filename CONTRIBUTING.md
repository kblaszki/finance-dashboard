# Contributing

Thank you for your interest in this project. It is a personal hobby repository, but pull requests and issues are welcome. There is no guarantee that every contribution will be merged.

## Before you start

1. Read [README.md](README.md) for setup, environment variables, and how to run the app.
2. Install dependencies from the repo root:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3. Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET` before running the API.

## Development workflow

1. Fork the repository and create a branch with a clear name (for example `fix/cashflow-stats` or `feat/account-export`).
2. Make focused changes; prefer small pull requests over large rewrites.
3. Run tests from the project root:

```bash
npm test
```

If you change backend or frontend logic covered by metrics, also run:

```bash
npm run test:coverage
```

See [docs/testing.md](docs/testing.md) for coverage scope, test layout, and the verification checklist.

4. Open a pull request against `main` and fill in the PR template checklist.

## Pull request expectations

- Explain **what** changed and **why**.
- Link a related issue when one exists (`Fixes #123` or `Relates to #123`).
- Keep diffs minimal and aligned with existing code style.
- Do not commit secrets, local databases, or `backend/.env`.

## Project conventions

- Use **LF** line endings (see `.editorconfig` and `.gitattributes`).
- **New API endpoint:** handler in `backend/src/routes/`, wire in `backend/src/app.ts`, client in `frontend/src/api/`, one row in `docs/api.md`.
- **Schema change:** edit `backend/prisma/schema.prisma`, run `cd backend && npx prisma migrate dev --name <description>`, update `docs/domain.md` if models or relationships change.
- **New UI page or route:** update `frontend/src/App.tsx` and `docs/frontend.md`.
- Do not commit `backend/.env`, `**/dev.db`, or other local SQLite files.

More detail for agents and maintainers: [AGENTS.md](AGENTS.md) and `docs/`.

## Security

Do **not** open public issues with exploit details or live credentials.

Report security vulnerabilities through **GitHub Private vulnerability reporting**: repository **Security** tab → **Report a vulnerability**. Allow time for a fix before public disclosure.

## Questions

Use the **Question** issue template for setup or usage questions. Include what you tried and which README section you followed.

## Repository settings (maintainers)

These items are configured in GitHub, not in git:

1. **About description** (repo homepage): set to match `package.json` description — *Personal full-stack finance dashboard: bank accounts, brokerage positions, manual assets (Node, React, SQLite).*
2. **Private vulnerability reporting:** Settings → Security → Code security and analysis → enable **Private vulnerability reporting**.
