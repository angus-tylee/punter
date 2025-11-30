# Pulse Feature - Hibernation Status

## Status: HIBERNATED

The Pulse Instagram integration feature has been placed in hibernation due to Meta App Review requirements being too time-intensive for the current MVP phase.

**Date Hibernated:** January 2025

## What Was Built

The Pulse feature is **fully implemented** and ready for testing once Meta App Review is completed. All code, database schemas, and infrastructure are intact.

### Completed Components

**Backend:**
- ✅ Database schemas (`pulses`, `pulse_questions`, `pulse_responses`, `pulse_conversations`)
- ✅ Pulse API endpoints (`/api/pulse/*`)
- ✅ Instagram webhook handlers (`/api/instagram/*`)
- ✅ Conversation handler service
- ✅ LLM question generation for Pulse (simplified prompts)
- ✅ Instagram Graph API client

**Frontend:**
- ✅ Pulse list page (`/pulse`)
- ✅ Pulse creation wizard (`/pulse/new`)
- ✅ Pulse detail page (`/pulse/[id]`)
- ✅ Pulse staging page (`/pulse/[id]/stage`)
- ✅ Pulse insights dashboard (`/pulse/[id]/insights`)

**Database:**
- ✅ All SQL migration files ready in `supabase/sql/`
- ✅ RLS policies configured
- ✅ Indexes created

## Why It's Hibernated

Meta requires:
1. **Published app** to receive webhooks (as of Oct 2025)
2. **App Review** for `instagram_manage_messages` permission
3. **App Review** for `pages_read_engagement` permission (for webhooks)
4. **Privacy policy, terms of service, documentation** for review

The App Review process is estimated at 1-2 weeks and requires significant documentation preparation, making it too time-intensive for current MVP priorities.

## How to Re-Enable Pulse

### Step 1: Uncomment Backend Routes

In `backend/app/api/__init__.py`:
```python
# Uncomment these lines:
from app.api import pulse, instagram
router.include_router(pulse.router, tags=["pulse"])
router.include_router(instagram.router, tags=["instagram"])
```

### Step 2: Re-Enable Frontend Navigation

In `frontend/app/page.tsx`:
```tsx
// Uncomment the Pulse link:
<Link className="underline" href="/pulse">Pulse Surveys</Link>
```

### Step 3: Run Database Migrations

Execute these SQL files in Supabase SQL Editor (in order):
1. `supabase/sql/pulses.sql`
2. `supabase/sql/pulse_questions.sql`
3. `supabase/sql/pulse_responses.sql`
4. `supabase/sql/pulse_conversations.sql`

### Step 4: Configure Instagram Credentials

Ensure `backend/.env` has:
```env
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=...
INSTAGRAM_TEST_ACCOUNT_ID=...
```

### Step 5: Complete Meta App Review

1. Prepare App Review materials:
   - Privacy policy URL
   - Terms of service
   - Use case description
   - Screenshots/video demo
   - Data usage explanation

2. Submit for review:
   - Request `instagram_manage_messages` permission
   - Request `pages_read_engagement` permission
   - Publish app (required for webhooks)

3. Once approved:
   - Set up webhook in Facebook App
   - Test with real Instagram account
   - Deploy to production

## Files That Are Hibernated (But Intact)

**Backend:**
- `backend/app/api/pulse.py` - All endpoints ready
- `backend/app/api/instagram.py` - Webhook handlers ready
- `backend/app/services/pulse_question_generator.py` - LLM service ready
- `backend/app/services/pulse/conversation_handler.py` - Conversation logic ready
- `backend/app/services/instagram/client.py` - Instagram API client ready
- `backend/app/prompts/pulse_question_generation*.txt` - Prompts ready

**Frontend:**
- `frontend/app/pulse/` - All pages ready (just hidden from navigation)
- All Pulse components functional

**Database:**
- `supabase/sql/pulses.sql` - Ready to execute
- `supabase/sql/pulse_questions.sql` - Ready to execute
- `supabase/sql/pulse_responses.sql` - Ready to execute
- `supabase/sql/pulse_conversations.sql` - Ready to execute

## Testing Status

**What Was Tested:**
- ✅ Webhook verification endpoint (works)
- ✅ Database schemas (created and tested)
- ✅ Frontend UI (all pages functional)
- ✅ Question generation (LLM integration works)

**What Requires App Review:**
- ❌ Real webhook events (requires published app)
- ❌ Real DM sending (requires `instagram_manage_messages` approval)
- ❌ Comment detection (requires webhooks or polling permissions)

## Future Considerations

When ready to re-enable:

1. **App Review Preparation:**
   - Privacy policy page
   - Terms of service page
   - Data deletion endpoint
   - Demo video/screenshots
   - Use case documentation

2. **Testing Strategy:**
   - Use simulation endpoints for internal testing
   - Test real API calls after App Review approval
   - Verify webhook functionality post-approval

3. **Timeline Estimate:**
   - App Review prep: 3-5 days
   - App Review submission: 1 day
   - Meta review: 1-2 weeks
   - Testing & deployment: 2-3 days
   - **Total: ~3-4 weeks**

## Notes

- All code is production-ready and follows best practices
- No code cleanup needed - everything is well-structured
- Database migrations are idempotent (safe to run multiple times)
- Feature can be re-enabled with minimal effort (just uncomment routes)
- Consider adding feature flags in the future for easier toggling

