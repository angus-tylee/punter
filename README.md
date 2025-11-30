# Punter

A modern survey and feedback collection platform with AI-powered question generation and analytics.

## What is Punter?

Punter helps you create, distribute, and analyze surveys and feedback forms. Create surveys manually or use AI to generate questions based on your event context, goals, and audience. Collect responses through shareable forms and gain insights through automated analytics and AI-generated summaries.

### Key Features

- **AI-Powered Question Generation**: Generate survey questions automatically from event context, learning objectives, and goals
- **Flexible Question Types**: Support for text, textarea, single-select, multi-select, Likert scales, and budget allocation questions
- **Public Response Collection**: Share active surveys via public links for anonymous or authenticated responses
- **Analytics Dashboard**: View aggregated statistics, charts, word clouds, and AI-generated insights from responses
- **Survey Management**: Organize surveys (panoramas) with draft, active, and archived statuses
- **User Profiles**: Personal accounts with authentication and profile management

**Note:** Pulse Instagram integration feature is currently hibernated. See `PULSE_HIBERNATION.md` for details.

## Technical Overview

Punter is a full-stack application with a modern architecture:

- **Frontend**: Next.js 14+ with App Router, TypeScript, and Tailwind CSS
- **Backend**: FastAPI (Python) providing REST APIs for AI question generation and analytics
- **Database**: Supabase (PostgreSQL) with Row Level Security for data isolation
- **Authentication**: Supabase Auth for user management
- **AI Integration**: LLM service for generating questions and generating executive summaries

The application follows a client-server architecture where the frontend communicates directly with Supabase for most data operations, while the backend handles AI-powered features and analytics processing.

## Project Structure

```
punter/
├── frontend/          # Next.js application
│   ├── app/          # Pages and routes
│   ├── components/   # React components
│   └── lib/          # Utilities and clients
│
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   └── services/ # Business logic (LLM, analytics)
│
└── supabase/         # Database schema SQL files
```
