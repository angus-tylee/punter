<!-- 9b9516fb-760a-4836-885f-0bf8c53c3716 86e4f14a-1344-48ec-a9c3-cca5cb9d9083 -->
# Add Questions and Responses to Panoramas

## Overview

Add the ability to create questions within panoramas and collect responses. This includes database tables, RLS policies, and UI components for managing questions and viewing responses.

## Database Schema

### 1. Questions Table (`supabase/sql/questions.sql`)

- `id` (uuid, primary key)
- `panorama_id` (uuid, foreign key to panoramas)
- `question_text` (text, required)
- `question_type` (text: 'text', 'textarea', 'Single-select', 'Multi-select')
- `options` (jsonb, nullable - for multiple choice options)
- `required` (boolean, default false)
- `order` (integer, for ordering questions)
- `created_at`, `updated_at` (timestamptz)
- RLS: Owner of panorama can manage questions

### 2. Responses Table (`supabase/sql/responses.sql`)

- `id` (uuid, primary key)
- `panorama_id` (uuid, foreign key to panoramas)
- `question_id` (uuid, foreign key to questions)
- `submission_id` (uuid, for grouping responses from the same form submission)
- `response_text` (text, required - stores the answer)
- `respondent_id` (uuid, nullable - for authenticated respondents)
- `created_at` (timestamptz)
- RLS: 
  - Panorama owner can view all responses
  - Anyone can insert responses if panorama status is 'active'

**Response storage by question type:**
- `text` / `textarea`: Store the text answer in `response_text` (one row per question)
- `Single-select`: Store the selected option text in `response_text` (one row per question)
- `Multi-select`: Create multiple rows, one per selected option, each with the option text in `response_text` (all sharing the same `submission_id` and `question_id`)

## Frontend Implementation

### 3. Update Panorama Detail Page (`frontend/app/panoramas/[id]/page.tsx`)

- Add "Questions" section below the edit form
- List existing questions with edit/delete
- Add new question button
- Question form: text, type selector, required checkbox, options (for Single-select and Multi-select)
- Add "Responses" section showing response count and link to view responses

### 4. Create Questions Management UI

- Inline question editor in panorama detail page
- Support for text, textarea, Single-select and Multi-select types
- Delete question functionality

### 5. Create Responses View Page (`frontend/app/panoramas/[id]/responses/page.tsx`)

- Table/list view of all responses
- Group by question or by response submission (using `submission_id`)
- Show response count per question
- For Multi-select questions, show all selected options grouped together

### 6. Create Public Response Form (`frontend/app/panoramas/[id]/respond/page.tsx`)

- Public-facing form (no auth required if panorama is active)
- Render all questions in order
- For Multi-select questions, allow multiple checkbox selections
- Generate a unique `submission_id` (UUID) when form loads
- Submit all responses at once (creating multiple rows for Multi-select questions)
- Show success message after submission

## Implementation Details

- All database operations use Supabase client-side with RLS
- Questions ordered by `order` field
- Multiple choice options stored as JSON array: `["Option 1", "Option 2"]`
- Response submission:
  - Generate `submission_id` (UUID) at the start of form submission
  - For text/textarea/single-select: Create one response row per question
  - For multi-select: Create one response row per selected option (all with same `submission_id` and `question_id`)
- Keep UI minimal and functional (MVP approach)

### To-dos

- [ ] Create questions.sql with table, indexes, RLS policies, and triggers
- [ ] Create responses.sql with table, indexes, and RLS policies (including submission_id)
- [ ] Add questions management section to panorama detail page with add/edit/delete
- [ ] Create responses view page showing all responses grouped by question and submission
- [ ] Create public response form page for submitting responses to active panoramas (handling multi-select correctly)

