# Finance Dashboard

Fullstackowa aplikacja do przeglądu finansów (przychody, wydatki, portfel inwestycyjny) zbudowana w stosie:

- Backend: Node.js + TypeScript + Express + Prisma + SQLite
- Frontend: Vite + React + TypeScript

## Wymagania

- Node.js 18+
- npm

## Instalacja

W katalogu głównym projektu (`finance-dashboard/`):

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Uruchomienie w trybie deweloperskim

W jednym terminalu, w katalogu głównym:

```bash
npm run dev
```

Domyślnie:

- Backend startuje na `http://localhost:4000`
- Frontend startuje na `http://localhost:5173`

Jeśli chcesz uruchomić je osobno:

```bash
# backend
cd backend
npm run dev

# frontend
cd frontend
npm run dev
```

## Migracje bazy danych

Backend korzysta z Prisma + SQLite. Plik bazy (`dev.db`) znajduje się w katalogu `backend/`.

Jeśli zmienisz modele w `backend/prisma/schema.prisma`, uruchom:

```bash
cd backend
npx prisma migrate dev --name <opis_migracji>
```

## Budowanie

```bash
npm run build
```

Buduje backend (TypeScript → JS) oraz frontend (Vite build).

