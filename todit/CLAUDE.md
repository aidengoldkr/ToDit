# CLAUDE.md

## Project Overview

ToDit is a Korean-language Next.js 14 (App Router) SaaS that converts images, PDFs, and text
into structured ActionPlans using OpenAI (gpt-4o-mini) and Google Vision OCR.
(Migrated and rebranded from Actonix.)

**Core capability: Action Decomposition** — high-level goals are decomposed into granular,
executable sub-actions with reverse-calculated deadlines.

## Commands

npm install          # install dependencies
npm run dev          # dev server (default :3000)
npm run build        # production build
npm start            # production server
npm run lint         # ESLint

## Required Environment Variables

| Variable | Purpose |
|---|---|
| OPENAI_API_KEY | OpenAI API (gpt-4o-mini) |
| NEXTAUTH_SECRET | NextAuth session secret |
| NEXTAUTH_URL | App URL (falls back to VERCEL_URL or localhost) |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Google OAuth |
| GOOGLE_APPLICATION_CREDENTIALS_JSON | Google Vision service account JSON string |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase server admin key |
| NEXT_PUBLIC_BETA_OPEN | (optional) "true" → Free users get 1000 credits |

## Architecture

### Parse Pipeline (app/api/parse/route.ts)

1. Env check (OPENAI_API_KEY)
2. Auth check (getServerSession)
3. Terms consent check (getTermsAgreed)
4. Input type validation (image / pdf / text)
5. Image count limit (Free: 20, Pro: 30)
6. PDF size limit (10MB)
7. Credit pre-check (balance < cost → reject)
8. File download from Supabase Storage (parse-temp bucket)
9. Text extraction: image → OCR, pdf → pdf-parse, text → direct
10. LLM call (parseToActionPlan)
11. Credit deduction (only after validation succeeds)
12. Temp file cleanup (finally block)

### Key Modules

- src/lib/openai.ts — parseToActionPlan(). gpt-4o-mini, json_object, temp 0.2, 2048 tokens.
- src/lib/schema.ts — validateActionPlan(). Fallback date = earliest due - 1 day.
- src/lib/credits.ts — calculateParseCost(), getOrRefillCredits(), deductCredits().
- src/lib/subscription.ts — getTier(): "pro" | "free" via Supabase subscriptions table.
- src/lib/google-ocr.ts — extractTextFromImages() via Google Vision DOCUMENT_TEXT_DETECTION.
- src/lib/consent.ts — getTermsAgreed() / setTermsAgreed() via user_consents table.
- src/lib/auth-options.ts — NextAuth config, Google provider, session adds user.id.
- src/lib/supabase/admin.ts — service-role Supabase client (server only).
- src/lib/supabase/storage.ts — downloadFromParseTemp() / deleteFromParseTemp().

### Supabase Tables

- action_plans (id, user_id, plan JSONB, title, created_at)
- user_credits (balance, last_refill_at, display_name)
- subscriptions (status, current_period_end)
- user_consents (terms_agreed_at)

## Business Logic Invariants

DO NOT change without explicit product owner approval.

1. Pipeline order is immutable: credit check → OCR → LLM → validation → deduction.
2. Credits deducted ONLY after validateActionPlan() succeeds.
3. OCR failure prevents LLM call.
4. calculateParseCost() is the single source of cost formula. Do not inline elsewhere.
5. getOrRefillCredits() is the single source of monthly refill. No duplicates.
6. model = gpt-4o-mini. Changing models requires cost impact analysis first.
7. response_format: json_object is required. Removing it allows unparseable free-text output.
8. Files in parse-temp bucket MUST be deleted after every parse (success or failure).
9. Auth chain: session → consent → business logic. No endpoints bypass this.
