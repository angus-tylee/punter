# 💡 Tips & Tricks

Quick reference guide for daily development workflow and helpful shortcuts.

## 🚀 Daily Workflow

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

## 🎯 Using Cursor

- **Ask questions**: Press `Cmd+L` (Mac) or `Ctrl+L` (Windows) to chat
- **Get help**: Select code and ask "What does this do?"
- **Generate code**: Ask "Create a login page" or "Add a user API endpoint"
- **Fix errors**: Paste error messages and ask for help

## 💻 Development Tips

- **Always activate venv** before working on backend
- Use `npm run dev` for frontend development (hot reload enabled)
- FastAPI auto-reloads when you use `--reload` flag
- Check Supabase dashboard for database changes and logs

