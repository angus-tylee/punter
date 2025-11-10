# Backend API - FastAPI

This is the FastAPI backend for the Punter application.

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**
   ```bash
   # Mac/Linux:
   source venv/bin/activate
   
   # Windows:
   venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase credentials

5. **Run the development server:**
   ```bash
   uvicorn app.main:app --reload
   ```

The API will be available at:
- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app initialization
│   ├── config.py        # Configuration settings
│   ├── api/             # API route handlers
│   │   ├── __init__.py
│   │   └── health.py    # Health check endpoint
│   ├── models/          # Data models (Pydantic)
│   └── services/        # Business logic
└── requirements.txt
```

## Adding New Endpoints

1. Create a new file in `app/api/` (e.g., `users.py`)
2. Define your routes using FastAPI's router
3. Import and include the router in `app/api/__init__.py`

Example:
```python
# app/api/users.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users():
    return {"users": []}
```

