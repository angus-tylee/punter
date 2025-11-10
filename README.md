# Punter - Full-Stack Application

A modern full-stack application built with Next.js, TypeScript, FastAPI, and Supabase.

## 🚀 Tech Stack

- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python 3.11+
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## 📁 Project Structure

```
punter/
├── frontend/          # Next.js application
│   ├── app/          # App Router pages and routes
│   ├── components/   # React components
│   ├── lib/          # Utilities and Supabase client
│   └── public/       # Static assets
│
├── backend/          # FastAPI application
│   ├── app/          # Main application code
│   │   ├── api/      # API route handlers
│   │   ├── models/   # Data models
│   │   └── services/ # Business logic
│   └── requirements.txt
│
└── README.md
```

## ⚡ Quick Start

### First Time Setup
See **[GETTING_STARTED.md](./GETTING_STARTED.md)** for complete step-by-step instructions.

### Daily Workflow

**Every time you open Cursor:**

**Frontend** (Terminal 1):
```bash
cd frontend
npm run dev
```
→ Runs on `http://localhost:3000`

**Backend** (Terminal 2):
```bash
cd backend
source venv/bin/activate    # ← IMPORTANT! Activate venv first
uvicorn app.main:app --reload
```
→ Runs on `http://localhost:8000`  
→ API docs at `http://localhost:8000/docs`

### Helper Scripts

You can also use the helper scripts:
```bash
./start-frontend.sh    # Starts frontend
./start-backend.sh      # Starts backend (auto-activates venv)
```

## 🔐 Authentication (Supabase)

- Frontend uses Supabase Auth with email/password (non-legacy keys).
- Pages added:
  - `/(auth)/login` — sign in/sign up
  - `/account` — protected page, redirects to login if not authenticated
- Header shows Sign in / Sign out depending on session state.
- Env needed in `frontend/.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  ```
  
To test:
1) Start frontend: `cd frontend && npm run dev`
2) Visit `http://localhost:3000/(auth)/login` → create an account
3) You’ll be redirected to `/account` after signing in
4) Use “Sign out” in header to log out

## 👤 Profiles

- Table: `public.profiles` keyed to `auth.users(id)` with fields: `display_name`, `avatar_url`, `updated_at`.
- RLS enabled; users can select/insert/update only their own row.
- SQL file to run: `supabase/sql/profiles.sql` (open Supabase → SQL Editor → paste/run).
- `/account` page:
  - Loads the current user's profile
  - Creates a row on first visit if missing
  - Lets the user change `display_name`

## 📦 Panoramas (Core Entity)

- SQL file: `supabase/sql/panoramas.sql` (run in Supabase SQL Editor)
  - Fields: `name`, `description`, `status` (draft/active/archived), `owner_id`, soft delete via `deleted_at`
  - RLS: owner-only read/write
- Pages:
  - `/panoramas` — list your panoramas
  - `/panoramas/new` — create new panorama
  - `/panoramas/[id]` — view/edit, change status, soft delete
- Notes:
  - All Supabase calls are client-side; RLS enforces per-user access
  - Soft delete sets `deleted_at` and list view fetches only rows where `deleted_at is null`

## 🔍 Virtual Environment Notes

**Why activate venv?**
- Python packages install globally by default (can mess up your system)
- Virtual environment isolates packages per project
- **Always activate before running backend or installing packages**

**How to verify venv is active:**
- Your terminal prompt should show `(venv)` at the start
- Example: `(venv) angustylee@MacBook punter %`

**Node.js doesn't need activation:**
- `npm install` automatically isolates packages in `node_modules/`
- No virtual environment needed for frontend

## 📚 Learning Resources

- **Next.js**: [Official Docs](https://nextjs.org/docs)
- **TypeScript**: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **FastAPI**: [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- **Supabase**: [Supabase Docs](https://supabase.com/docs)

## 🎯 Using Cursor

- **Ask questions**: Press `Cmd+L (Mac) or `Ctrl+L` (Windows) to chat
- **Get help**: Select code and ask "What does this do?"
- **Generate code**: Ask "Create a login page" or "Add a user API endpoint"
- **Fix errors**: Paste error messages and ask for help

## 🚦 Next Steps

1. Complete first-time setup (see `GETTING_STARTED.md`)
2. Set up your Supabase project
3. Configure environment variables
4. Start building your first feature!
