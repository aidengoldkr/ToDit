# ToDit Project Troubleshooting Log

This document serves as a comprehensive record of technical challenges, root causes, and resolutions encountered during the development and enhancement of the ToDit application.

---

## 1. OpenAI API Parameter Compatibility
### Issue
OpenAI API calls failed with `400 Unsupported parameter: 'max_tokens'`.

### Root Cause
Recent versions of OpenAI models (especially reasoning models like the o1 series and newer GPT versions) have replaced `max_tokens` with `max_completion_tokens`.

### Resolution
Updated `src/lib/openai.ts` to use `max_completion_tokens` instead of `max_tokens`.

---

## 2. Model Constraints (Reasoning Models)
### Issue
`400 Unsupported value: 'temperature' does not support 0.2 with this model.`.

### Root Cause
Reasoning models (like GPT-5 mini or o1) do not support the `temperature` parameter as they manage the reasoning process internally. They only support the default value of 1.

### Resolution
Implemented conditional logic in `src/lib/openai.ts` to exclude the `temperature` parameter when a reasoning model (GPT-5 series) is used.

---

## 3. API Interface Mismatch (Responses API vs Chat Completions)
### Issue
Errors like `400 Unknown parameter: 'output_types'` or `Empty or invalid response from OpenAI`.

### Root Cause
An attempt was made to use the newer **Responses API** for GPT-5 mini, but the API specification was in flux, leading to parameter mismatches (`output_types` vs `output`, `max_completion_tokens` vs `max_output_tokens`).

### Resolution
Simplified the implementation by reverting to the stable **Chat Completions API** while maintaining enhanced JSON parsing for stability.

---

## 4. Robust JSON Parsing & Sanitization
### Issue
`Error: AI 응답을 데이터로 변환하는 데 실패했습니다.` (Failed to convert AI response to data).

### Root Cause
AI models occasionally wrap JSON responses in Markdown code blocks (````json ... ````) or prepend explanatory text, which causes `JSON.parse()` to fail.

### Resolution
Enhanced the post-processing logic in `src/lib/openai.ts`:
1.  Regex-based removal of Markdown code blocks.
2.  Regex-based extraction of the actual JSON object (`{ ... }`) from the raw string.
3.  Added detailed logging of failed raw responses for debugging.

---

## 5. Supabase Security (Overuse of Admin Client)
### Issue
The application relied heavily on `createAdminClient` (`service_role`), which bypasses Row Level Security (RLS) and poses a security risk if user IDs aren't manually checked in every API route.

### Root Cause
Lack of a mechanism to pass authenticated user context from the Next.js server to the Supabase database.

### Resolution
1.  **RLS Policies**: Created a new SQL migration (`supabase/migrations/20260315_secure_auth_rls.sql`) that uses a custom header `x-todit-user-id` to identify users at the database level.
2.  **Authenticated Client**: Implemented `getAuthenticatedClient` in `src/lib/supabase/authenticated.ts` to automatically inject the user's ID into every request.
3.  **Refactoring**: Started replacing `createAdminClient` with `getAuthenticatedClient` in sensitive API routes.

---

## 6. Artificial UX Delays
### Issue
Users experienced a hard 2-second (or up to 10-second) delay after AI analysis was complete.

### Root Cause
`src/app/upload/page.tsx` contained artificial `setTimeout` logic intended to "guarantee" a minimum loading time for the loading animation.

### Resolution
Removed the `minLoadingTime` and `setTimeout` logic, allowing the application to redirect to the results page immediately upon API completion.

---

## 7. Model Strategy & UI Simplification
### Issue
Complex model selection (GPT-4 vs GPT-5) and inconsistent naming led to confusion and API errors.

### Root Cause
User requested to simplify the Pro plan and remove explicit model selection.

### Resolution
1.  **UI Cleanup**: Removed the AI model selection dropdown from `UploadPage` and updated `PlanPage` text.
2.  **Server-Side Strategy**: Implemented automatic model assignment in `src/app/api/parse/route.ts`:
    *   **Pro**: Automatically uses `gpt-4o` (stable & powerful).
    *   **Free**: Automatically uses `gpt-4o-mini` (fast & cost-effective).

---

*Last Updated: 2026-03-15*
