# 🚀 Getting Started Guide

Complete step-by-step guide to set up your project for the first time.

## Prerequisites

Before starting, make sure you have:

- ✅ **Node.js** (version 18 or higher)
  - Check: `node --version`
  - Download: [nodejs.org](https://nodejs.org/)
  
- ✅ **Python** (version 3.11 or higher)
  - Check: `python3 --version`
  - Download: [python.org](https://www.python.org/downloads/)

- ✅ **npm** (comes with Node.js)
  - Check: `npm --version`

## Step 1: Set Up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Fill in:
   - **Name**: punter (or any name you like)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Wait 2-3 minutes for project to be created
5. Once ready, go to **Settings** → **API**
6. Copy these values (you'll need them soon):
   - **Project URL**
   - **anon/public key**
   - **Service Role Key** (keep this secret!)

## Step 2: Set Up Frontend (Next.js)

1. **Navigate to frontend folder:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   (This might take 1-2 minutes)

3. **Create environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

4. **Edit `.env.local`** and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   - Go to `http://localhost:3000`
   - You should see "Welcome to Punter"!

## Step 3: Set Up Backend (FastAPI)

1. **Open a NEW terminal window** (keep frontend running)

2. **Navigate to backend folder:**
   ```bash
   cd backend
   ```

3. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```

4. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate
   ```
   (You should see `(venv)` appear in your terminal prompt)

5. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   (This might take 1-2 minutes)

6. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

7. **Edit `.env`** and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key-here
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   (Get the DATABASE_URL from Supabase → Settings → Database → Connection string)

8. **Start the API server:**
   ```bash
   uvicorn app.main:app --reload
   ```

9. **Test the API:**
   - Go to `http://localhost:8000/docs`
   - You should see interactive API documentation!

## Step 4: Verify Everything Works

✅ **Frontend**: `http://localhost:3000` shows "Welcome to Punter"  
✅ **Backend**: `http://localhost:8000/docs` shows API documentation  
✅ **Health Check**: `http://localhost:8000/api/health` returns `{"status": "healthy"}`

## 🎉 You're Ready!

Your full-stack application is now running:
- **Frontend**: Next.js with TypeScript on port 3000
- **Backend**: FastAPI on port 8000
- **Database**: Supabase PostgreSQL (cloud-hosted)

## 🆘 Troubleshooting

**Frontend won't start:**
- Make sure you're in the `frontend/` directory
- Check that `npm install` completed successfully
- Try deleting `node_modules` and running `npm install` again

**Backend won't start:**
- Make sure virtual environment is activated (you should see `(venv)` in prompt)
- Check that `pip install -r requirements.txt` completed
- Verify Python version: `python3 --version` (should be 3.11+)

**Can't connect to Supabase:**
- Double-check your `.env` files have the correct values
- Make sure there are no extra spaces in your environment variables
- Verify your Supabase project is active in the dashboard

**Virtual environment not activating:**
- Make sure you're in the `backend/` directory
- Verify the `venv` folder exists: `ls -la venv`
- If missing, recreate it: `python3 -m venv venv`

## 💡 Tips

- **Always activate venv** before working on backend (see main README for daily workflow)
- Use `npm run dev` for frontend development (hot reload enabled)
- FastAPI auto-reloads when you use `--reload` flag
- Check Supabase dashboard for database changes and logs

## 📚 Next Steps

1. **Explore the code:**
   - Frontend pages: `frontend/app/page.tsx`
   - Backend API: `backend/app/api/`
   - Supabase client: `frontend/lib/supabase.ts`

2. **Try building something:**
   - Add a new page in `frontend/app/`
   - Create a new API endpoint in `backend/app/api/`
   - Connect to Supabase database

3. **Learn more:**
   - Next.js: [nextjs.org/learn](https://nextjs.org/learn)
   - FastAPI: [fastapi.tiangolo.com/tutorial](https://fastapi.tiangolo.com/tutorial/)
   - Supabase: [supabase.com/docs](https://supabase.com/docs)

Happy coding! 🎓
