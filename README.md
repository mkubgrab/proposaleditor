# Proposal Agent Tool

Local proposal editor with:

- Three-pane VS Code-style dashboard (File Explorer | Markdown Editor + Merge Diff | Chat)
- Prisma + PostgreSQL persistence for `Project`, `Task`, and `Context`
- Triple-branch Git flow (`main`, `user-input`, `agent-work`) with API endpoints powered by Octokit
- "Solve with AI" merge action to synthesize user and agent drafts into a merged markdown draft

## Quick start

```bash
npm install
npx prisma generate
npm run dev
```

Open http://localhost:3000.

## Database

Prisma schema is in `/prisma/schema.prisma`.

Use a PostgreSQL URL in `.env`:

```env
DATABASE_URL="postgresql://proposal:proposal@localhost:5432/proposaldb?schema=public"
```

## Docker Compose

```bash
docker compose up --build
```

This launches:

- Next.js app on `localhost:3000`
- PostgreSQL on `localhost:5432`

