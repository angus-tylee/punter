<!-- 71642cbb-caa8-4898-bdd1-42f3f349d92d af5ba4d0-0ea1-4530-ac4c-0f1186c94343 -->
# Pulse Testing & Meta App Review Preparation Plan

## 1. Testing Alternatives (Without Live Webhooks)

Since Meta requires published apps to receive webhooks, we need alternative testing methods to validate the Pulse feature before App Review.

### 1.1 Manual Comment Processing Endpoint

**Purpose:** Allow manual triggering of comment processing to test the full DM conversation flow.

**Implementation:**

- Create `POST /api/pulse/{pulse_id}/test-comment` endpoint
- Accepts: `instagram_user_id`, `instagram_username`, `post_id` (optional, uses pulse's post)
- Simulates comment event and triggers DM invitation
- Allows testing full conversation flow without real comments

**Files to Create/Modify:**

- `backend/app/api/pulse.py` - Add test endpoint
- `frontend/app/pulse/[id]/page.tsx` - Add "Test Comment" button in UI

### 1.2 Comment Polling Service (Optional)

**Purpose:** Periodically check for new comments via Graph API as a temporary workaround.

**Implementation:**

- Create `backend/app/services/instagram/comment_poller.py`
- Polls Instagram Graph API for comments on monitored posts
- Processes new comments and triggers DM invitations
- Can run as background task or scheduled job

**Considerations:**

- Rate limiting (Instagram API has limits)
- Less efficient than webhooks
- Good for testing but not production-ready
- Can be disabled once webhooks are enabled

### 1.3 Manual DM Testing Endpoint

**Purpose:** Test DM sending and conversation flow independently.

**Implementation:**

- Create `POST /api/pulse/{pulse_id}/test-dm` endpoint
- Sends DM invitation to specified user
- Allows testing conversation handler without comment trigger

### 1.4 Test Data Seeding

**Purpose:** Populate test conversations and responses for dashboard testing.

**Implementation:**

- Create `POST /api/pulse/{pulse_id}/seed-test-data` endpoint
- Generates fake conversations and responses
- Useful for testing insights dashboard without real data

## 2. Meta App Review Preparation

### 2.1 Required Permissions

**Permissions Needed:**

- `instagram_basic` - Read Instagram account info
- `instagram_manage_messages` - Send DMs (PRIMARY - requires review)
- `pages_read_engagement` - Read comments (required for webhooks)

**Review Status:**

- `instagram_basic` - Usually auto-approved for Business accounts
- `instagram_manage_messages` - **REQUIRES APP REVIEW** (most critical)
- `pages_read_engagement` - May require review depending on usage

### 2.2 App Review Requirements (2025)

**Key Requirements:**

1. **Privacy Policy URL** - Required for apps that collect user data
2. **Use Case Description** - Clear explanation of how permissions are used
3. **Screenshots/Video** - Demonstration of the feature in action
4. **Data Usage Explanation** - How user data is collected, stored, used
5. **Business Verification** - May be required for certain permissions
6. **Terms of Service** - Required for apps with user interactions

### 2.3 Documentation Needed

**Use Case Description:**

- "Pulse enables event promoters to collect real-time feedback via Instagram DMs. When users comment on an Instagram post, they receive an automated DM invitation to participate in a short survey. Users can complete surveys via DM conversation, and responses are collected for analytics."

**Data Usage:**

- We collect: Instagram user IDs, usernames, survey responses
- We store: Responses in secure database (Supabase)
- We use: For event feedback analysis and insights
- We share: Only with the event organizer (pulse owner)
- We delete: Users can request deletion, data retention policy

**Screenshots/Video Needed:**

1. User commenting on Instagram post
2. DM invitation received
3. Survey conversation flow (questions and answers)
4. Insights dashboard showing responses
5. Admin dashboard showing pulse creation

### 2.4 Code Compliance Requirements

**Must Implement:**

- Error handling for API failures
- Rate limiting compliance
- User data deletion capability
- Privacy policy link in app
- Terms of service acceptance
- Clear user consent for data collection

**Files to Create/Modify:**

- `backend/app/api/pulse.py` - Add data deletion endpoint
- `frontend/app/pulse/[id]/page.tsx` - Add privacy policy link
- `backend/app/api/instagram.py` - Add rate limiting
- Privacy policy page/document

## 3. Implementation Priority

### Phase 1: Testing Infrastructure (Immediate)

1. Manual comment processing endpoint
2. Manual DM testing endpoint
3. Test data seeding
4. Update frontend with test buttons

### Phase 2: App Review Preparation (Before Submission)

1. Privacy policy page
2. Terms of service
3. Data deletion endpoint
4. Error handling improvements
5. Rate limiting
6. Documentation and screenshots

### Phase 3: App Review Submission

1. Prepare use case description
2. Record demo video
3. Take screenshots
4. Submit for review
5. Monitor review status

## 4. Testing Strategy

### 4.1 Manual Testing Flow

1. Create Pulse survey via dashboard
2. Use manual test endpoint to simulate comment
3. Receive DM invitation
4. Complete survey via DM
5. Verify responses in dashboard
6. Test insights display

### 4.2 Edge Cases to Test

- User declines invitation
- User stops mid-survey
- Invalid responses
- Multiple comments from same user
- Survey completion
- Partial responses

## 5. App Review Success Criteria

**Meta typically approves if:**

- Clear use case that benefits users
- Proper data handling and privacy
- No policy violations
- Working demo/screenshots
- Professional presentation

**Common Rejection Reasons:**

- Unclear use case
- Missing privacy policy
- Insufficient documentation
- Policy violations
- Poor user experience

## 6. Timeline Estimate

- **Testing Infrastructure:** 2-3 days
- **App Review Preparation:** 3-5 days
- **App Review Submission:** 1 day
- **Review Process:** 1-2 weeks (Meta's timeline)
- **Total:** ~3-4 weeks to production webhooks

## 7. Risk Mitigation

**If App Review Fails:**

- Polling as temporary solution
- Manual trigger as fallback
- Re-submit with improved documentation
- Consider alternative approaches

**If Review Takes Too Long:**

- Use polling for MVP launch
- Switch to webhooks post-approval
- Build both systems in parallel