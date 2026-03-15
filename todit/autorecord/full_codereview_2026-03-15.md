# ToDit 전체 코드리뷰 — 2026-03-15

> **목적**: ToDit SaaS 웹서비스의 모든 파일·로직·흐름을 한 문서에서 파악할 수 있도록 작성된 완전 코드리뷰.
> 작성 기준일: 2026-03-15 | 브랜치: `main`

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 및 의존성](#2-기술-스택-및-의존성)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [환경 변수](#4-환경-변수)
5. [타입 정의 (types/)](#5-타입-정의)
6. [미들웨어 및 인증 시스템](#6-미들웨어-및-인증-시스템)
7. [핵심 비즈니스 로직 (lib/)](#7-핵심-비즈니스-로직)
   - 7-1. openai.ts — LLM 파이프라인
   - 7-2. schema.ts — 검증 및 보정
   - 7-3. google-ocr.ts — OCR
   - 7-4. usage.ts — 사용량 관리
   - 7-5. subscription.ts — 구독 티어
   - 7-6. credits.ts / validators.ts / consent.ts
   - 7-7. supabase/ — DB 클라이언트·스토리지
   - 7-8. action-plan-session.ts — 클라이언트 세션 캐시
8. [API 라우트](#8-api-라우트)
   - 8-1. POST /api/parse
   - 8-2. POST /api/parse/upload-url
   - 8-3. GET/POST /api/consent
   - 8-4. GET /api/usage
   - 8-5. GET /api/plans
   - 8-6. GET·DELETE /api/todo/[id]
   - 8-7. GET /api/todo/history
9. [페이지 컴포넌트](#9-페이지-컴포넌트)
10. [공통 컴포넌트](#10-공통-컴포넌트)
11. [Supabase 테이블 구조](#11-supabase-테이블-구조)
12. [비즈니스 불변 규칙 (Invariants)](#12-비즈니스-불변-규칙)
13. [Free vs Pro 티어 차이](#13-free-vs-pro-티어-차이)
14. [보안 포인트](#14-보안-포인트)
15. [데이터 흐름 전체 다이어그램](#15-데이터-흐름-전체-다이어그램)
16. [알려진 기술 부채 및 메모](#16-알려진-기술-부채-및-메모)

---

## 1. 프로젝트 개요

**ToDit**은 이미지·PDF·텍스트를 입력받아 AI가 구조화된 ActionPlan(할 일 목록)으로 변환해 주는 한국어 SaaS 서비스.
원 프로젝트명 **Actonix**에서 리브랜딩·마이그레이션 완료.

### 핵심 기능

| 기능 | 설명 |
|------|------|
| 문서 파싱 | 이미지·PDF·직접 텍스트 → 구조화된 ActionPlan |
| 행동 분해 | 고수준 목표를 실행 가능한 세부 액션으로 분해 (역산 마감일 자동 배정) |
| 할 일 관리 | 체크박스, 우선순위, Google Calendar 연동 |
| 이력 관리 | 생성 이력 저장, 검색·카테고리 필터, 페이지네이션 |
| 구독 관리 | Free / Pro 티어, 월간 사용량 제한 |

---

## 2. 기술 스택 및 의존성

```
Next.js 14.2.35 (App Router)
React 18
TypeScript 5 (strict mode)
```

### 주요 런타임 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `openai` | ^6.26.0 | GPT-4o-mini LLM API |
| `@supabase/supabase-js` | ^2.99.1 | DB + 스토리지 |
| `next-auth` | ^4.24.13 | Google OAuth 인증 |
| `@google-cloud/vision` | ^5.3.4 | OCR (DOCUMENT_TEXT_DETECTION) |
| `pdf-parse` | ^2.4.5 | PDF → 텍스트 추출 |
| `zod` | ^4.3.6 | 입력값 런타임 검증 |
| `react-icons` | ^5.6.0 | 아이콘 |

### 빌드 설정 (next.config.mjs)

```js
// pdf-parse를 서버 컴포넌트 외부 패키지로 등록 (Node.js require() 사용)
experimental: {
  serverComponentsExternalPackages: ["pdf-parse"]
}
```

> ⚠️ **주의**: Next.js 14에서는 `experimental.serverComponentsExternalPackages` 사용.
> Next.js 15+의 `serverExternalPackages`와 다름. 버전 업그레이드 시 반드시 수정 필요.

---

## 3. 디렉토리 구조

```
todit/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 루트 레이아웃 (AdSense, 다크모드 초기화)
│   │   ├── page.tsx                # 랜딩 페이지 (/)
│   │   ├── providers.tsx           # SessionProvider 래퍼
│   │   ├── dashboard/page.tsx      # 대시보드 (/dashboard)
│   │   ├── upload/page.tsx         # 업로드·파싱 (/upload)
│   │   ├── todo/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # 할 일 뷰어 (/todo?id=...)
│   │   ├── plan/page.tsx           # 요금제 (/plan)
│   │   ├── terms/page.tsx          # 이용약관
│   │   ├── privacy/page.tsx        # 개인정보처리방침
│   │   └── api/
│   │       ├── auth/[...nextauth]/ # NextAuth 핸들러
│   │       ├── parse/
│   │       │   ├── route.ts        # 메인 파싱 엔드포인트
│   │       │   └── upload-url/     # 서명된 업로드 URL 생성
│   │       ├── consent/route.ts    # 이용약관 동의
│   │       ├── usage/route.ts      # 사용량 조회
│   │       ├── plans/route.ts      # 이력 목록
│   │       └── todo/
│   │           ├── [id]/route.ts   # 개별 플랜 조회·삭제
│   │           └── history/route.ts
│   ├── components/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── lib/
│   │   ├── openai.ts               # LLM 파이프라인
│   │   ├── schema.ts               # ActionPlan 검증·보정
│   │   ├── google-ocr.ts           # Google Vision OCR
│   │   ├── usage.ts                # 월간 사용량 관리
│   │   ├── subscription.ts         # 구독 티어 조회
│   │   ├── consent.ts              # 이용약관 동의 체크
│   │   ├── auth.ts                 # getServerSession 래퍼
│   │   ├── auth-options.ts         # NextAuth 설정
│   │   ├── validators.ts           # Zod 스키마 + 경로 검증
│   │   ├── action-plan-session.ts  # sessionStorage 캐시
│   │   └── supabase/
│   │       ├── admin.ts            # service-role 클라이언트
│   │       ├── client.ts           # anon 클라이언트
│   │       └── storage.ts          # parse-temp 버킷 I/O
│   ├── middleware.ts               # 라우트 보호
│   └── types/
│       ├── index.ts                # 핵심 타입
│       ├── next-auth.d.ts          # Session 타입 확장
│       └── pdf-parse.d.ts          # 모듈 선언
├── next.config.mjs
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

---

## 4. 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | ✅ | OpenAI API 키 (없으면 503 반환) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth 세션 서명 비밀키 |
| `NEXTAUTH_URL` | ✅ | 앱 URL (없으면 VERCEL_URL → localhost:3000 폴백) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth 시크릿 |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | ✅ | Vision API 서비스 계정 JSON (문자열) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 서버 어드민 키 (RLS 우회) |
| `NEXT_PUBLIC_BETA_OPEN` | ❌ | `"true"` → 무료 사용자 1000 크레딧 |

---

## 5. 타입 정의

### src/types/index.ts

```typescript
// 우선순위
type Priority = "high" | "medium" | "low";

// 문서 카테고리 (8종)
type DocumentCategory =
  | "안내문" | "공지문" | "준비사항" | "논설문"
  | "보고서" | "회의록" | "체크리스트" | "기타";

// 개별 액션 아이템
type ActionItem = {
  task: string;          // 한국어 동사 구문 (e.g. "자료조사하기")
  due: string | null;    // YYYY-MM-DD 형식
  priority?: Priority;   // 기본값: "medium"
  done?: boolean;        // 체크박스 상태
};

// AI가 생성하는 전체 플랜
type ActionPlan = {
  category?: DocumentCategory;
  title?: string;
  analysis?: string;       // 2~5문장 문서 분석
  keywords?: string[];     // 3~10개 키워드 태그
  keyPoints?: string[];    // 3~10개 핵심 포인트
  actions: ActionItem[];   // 분해된 액션 목록
  requirements: string[];  // 필요 자원·사전조건
  unknowns: string[];      // 모호한 정보·연도 추론 안내
};

// 파싱 요청 입력
type ParseInput = {
  type: "image" | "pdf" | "text";
  imageBase64?: string;
  imagesBase64?: string[];
  imageStoragePaths?: string[];
  pdfBase64?: string;
  pdfStoragePath?: string;
  text?: string;
  options?: {
    model?: string;
    usePriority?: boolean;
    customCategory?: string;
    detailLevel?: "brief" | "normal" | "detailed";
  };
};

// DB 저장 플랜 (saved_todo 테이블)
type SavedActionPlan = {
  id: string;
  user_id: string;
  plan: ActionPlan;
  title: string | null;
  created_at: string;
};
```

### src/types/next-auth.d.ts

Session 인터페이스를 확장하여 `session.user.id` (구글 sub claim) 접근 허용.

### src/types/pdf-parse.d.ts

pdf-parse 모듈 선언: `pdfParse(buffer: Buffer) => Promise<{text: string; numpages?: number; info?: unknown}>`

---

## 6. 미들웨어 및 인증 시스템

### src/middleware.ts

```
매처: ["/", "/dashboard/:path*", "/todo/:path*", "/upload/:path*"]

로직:
  JWT 토큰 없음 + 보호 라우트 → / 로 리다이렉트
  JWT 토큰 있음 + pathname === "/" + ?landing=1 없음 → /dashboard 로 리다이렉트
  그 외 → 통과
```

- JWT 파싱은 `getToken()` (next-auth/jwt) 사용 — DB 왕복 없음, 빠름
- `?landing=1` 쿼리 파라미터로 인증된 유저도 랜딩 페이지 강제 조회 가능

### src/lib/auth-options.ts

```typescript
providers: [GoogleProvider({ clientId, clientSecret })]
session: { strategy: "jwt" }
pages: { signIn: "/upload" }  // 로그인 성공 후 /upload로 이동

callbacks:
  jwt: token.sub → token.id 복사
  session: session.user.id = token.id (sub claim)
```

NEXTAUTH_URL 자동 설정:
```
process.env.NEXTAUTH_URL =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
```

### src/lib/consent.ts

```typescript
getTermsAgreed(userId): user_consents 테이블에서 terms_agreed_at 조회
setTermsAgreed(userId): upsert (user_id 기준) → terms_agreed_at = now()
```

---

## 7. 핵심 비즈니스 로직

### 7-1. src/lib/openai.ts — LLM 파이프라인

#### 모델 설정

```typescript
기본 모델: "gpt-4o-mini"
"gpt-5-mini" 요청 시 → "gpt-4o" 로 내부 매핑 (임시)
temperature: 0.2   // 낮은 창의성, 높은 일관성
max_tokens: 2048
response_format: { type: "json_object" }  // 필수 — 제거 시 비파싱 텍스트 반환 가능
```

#### 시스템 프롬프트 (5단계 행동 분해 엔진)

**Step 1 — 문서 유형 분류** (8개 카테고리):
- 안내문, 공지문, 준비사항, 논설문, 보고서, 회의록, 체크리스트, 기타

**Step 2 — 핵심 주제·문맥 추출**:
- 주요 목표, 이해관계자, 마감일, 제약 조건, 날짜, 요구사항

**Step 3 — 작업 세분화 (CRITICAL)**:
- 모든 목표를 즉시 실행 가능한 최소 단위 액션으로 분해
- 예: "발표 수행평가 3/15까지" → [자료조사, PPT 제작, 발표 연습, 발표 수행평가]
- 카테고리별 동사 구문 스타일 강제 (확인하기, 신청하기, 챙기기 등)
- 우선순위 배정 (high/medium/low)

**Step 4 — 역산 마감일 배정**:
- 최종 마감일로부터 역산하여 균등 배분
- 마감일 없으면 today 기준으로 상대 날짜 배정
- **연도 추론 규칙**: 연도 없는 날짜("3/15") → 현재 연도 가정.
  6개월 초과 미래면 전년도 적용 → unknowns에 안내 추가

**Step 5 — JSON 출력**:
```json
{
  "category": "...",
  "title": "...",
  "keywords": ["..."],
  "keyPoints": ["..."],
  "analysis": "...",
  "actions": [{ "task": "...", "due": "YYYY-MM-DD", "priority": "..." }],
  "requirements": ["..."],
  "unknowns": ["..."]
}
```

**금지 규칙**:
- 문서에서 단일 작업 그대로 복사 금지
- 문서에 없는 액션 생성 금지 (hallucination 방지)
- 마감일이 있는데 null 배정 금지
- 동일 마감일 반복 배정 금지
- JSON 외 텍스트 출력 금지

#### Pro 옵션 처리

| 옵션 | 동작 |
|------|------|
| `customCategory` | 프롬프트에 카테고리 강제 지시 추가 |
| `usePriority: false` | 모든 priority를 "medium"으로 통일하도록 지시 |
| `detailLevel: "brief"` | 3~5개 고수준 액션만 생성 |
| `detailLevel: "detailed"` | 최대한 세분화 지시 |

---

### 7-2. src/lib/schema.ts — 검증 및 보정

`validateActionPlan(data: unknown): ActionPlan`

1. **타입 안전 파싱**: LLM 출력(unknown)을 타입별로 검증
2. **우선순위 보정**: 유효하지 않은 priority → "medium" 기본값
3. **카테고리 보정**: 정의되지 않은 카테고리 → "기타"
4. **폴백 날짜 로직**:
   ```
   due가 null인 액션이 있을 경우:
     withDue 중 가장 이른 날짜 찾기
     fallbackDate = earliestDue - 1일
     (earliestDue 없으면 today - 1일)
     due=null인 모든 액션에 fallbackDate 배정
   ```

---

### 7-3. src/lib/google-ocr.ts — OCR

`extractTextFromImages(base64Array: string[]): Promise<string>`

```
1. GOOGLE_APPLICATION_CREDENTIALS_JSON 파싱
2. ImageAnnotatorClient 초기화
3. 각 이미지: DOCUMENT_TEXT_DETECTION 요청
4. 전체 텍스트 줄바꿈 연결하여 반환
```

- 서비스 계정 JSON을 환경변수 문자열로 받아 직접 파싱 (파일 경로 불필요)
- 복수 이미지 처리 지원

---

### 7-4. src/lib/usage.ts — 사용량 관리

#### 상수

```typescript
FREE_MONTHLY_LIMIT = 20  // 무료 티어 월간 최대 생성 횟수
```

#### getOrResetUsage(userId, displayName?)

```
1. user_usage 테이블 조회
2. 레코드 없음 → 신규 생성 (count=0)
3. 레코드 있음:
   - last_refill_at 월 < 현재 월 → count를 0으로 초기화 (월 리셋)
   - 동일 월 → 현재 count 반환
4. displayName 있으면 동시에 업데이트
5. 반환: { count, limit (Pro: null, Free: 20), last_reset_at }
```

#### incrementUsage(userId)

```
Pro 사용자: 카운트+1, 제한 체크 없음 (통계용)
Free 사용자:
  현재 count >= 20 → false 반환 (이미 처리됨)
  count < 20 → count+1, true 반환
```

---

### 7-5. src/lib/subscription.ts — 구독 티어

#### getTier(userId): "free" | "pro"

```
subscriptions 테이블 조회
  → status !== "active" → "free"
  → current_period_end < now() → "free" (만료)
  → 정상 → "pro"
```

#### 제한값

| 항목 | Free | Pro |
|------|------|-----|
| 월간 파싱 횟수 | 20회 | 무제한 |
| 이미지 첨부 수 | 5장 | 50장 |
| 액션 플랜 저장 수 | 10개 | 10개 (동일) |
| 모델 | gpt-4o-mini 고정 | 선택 가능 |
| 우선순위 분석 | ❌ | ✅ |

---

### 7-6. 보조 라이브러리

#### src/lib/validators.ts — Zod 스키마

```typescript
ParseInputSchema: type별 필수 필드 상호 검증 (refine)
UploadUrlSchema: type + fileCount (1~30)
TodoIdSchema: UUID 형식
PaginationSchema: page ≥ 1, category, search

sanitizeStoragePath(path):
  ".." 포함 → 에러 (디렉토리 트래버설 차단)
  "/" 또는 "\" 시작 → 에러 (절대 경로 차단)
  정규식 /^[a-zA-Z0-9_\-/]+\.[a-zA-Z0-9]+$/ 불일치 → 에러

validateStoragePathOwnership(path, userId):
  sanitizeStoragePath() 통과 후
  path.startsWith(`${userId}/`) 확인 → 아니면 403
```

#### src/lib/consent.ts

```typescript
getTermsAgreed(userId): user_consents 테이블 → Boolean
setTermsAgreed(userId): upsert { terms_agreed_at: now() }
```

---

### 7-7. src/lib/supabase/ — DB 클라이언트·스토리지

#### admin.ts — createAdminClient()

```typescript
createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
// RLS 우회, 서버 전용
// null 반환 가능 (env 미설정 시)
```

#### client.ts — getSupabaseClient()

```typescript
createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
// RLS 적용, 클라이언트·서버 양쪽 사용 가능
// 모듈 레벨 변수에 캐시
```

#### storage.ts

```typescript
downloadFromParseTemp(path: string): Promise<Buffer>
  // parse-temp 버킷에서 경로 sanitize 후 다운로드

deleteFromParseTemp(paths: string[]): Promise<void>
  // 배열로 받아 remove() 일괄 삭제
  // 파싱 성공/실패 모두 finally에서 호출
```

---

### 7-8. src/lib/action-plan-session.ts — 클라이언트 세션 캐시

브라우저 sessionStorage 기반. 페이지 새로고침 시 플랜 유지.

```typescript
writeStoredActionPlan(plan: ActionPlan, userId?: string)
  → sessionStorage['todit_action_plan'] = JSON.stringify({ plan, userId })

readStoredActionPlan(userId?: string): ActionPlan | null
  → 저장된 userId !== 현재 userId → null (다른 사용자 데이터 방지)

clearStoredActionPlan()
  → sessionStorage.removeItem('todit_action_plan')
```

---

## 8. API 라우트

### 8-1. POST /api/parse

**전체 파이프라인 (순서 불변)**:

```
1. OPENAI_API_KEY 존재 확인 → 없으면 503
2. getServerSession() → 없으면 401
3. getTermsAgreed(userId) → 미동의 403
4. ParseInputSchema.safeParse() → 실패 400
5. getTier(userId) → "free" | "pro"
   Free 고정: { model: "gpt-4o-mini", usePriority: false }
6. getOrResetUsage() → Free && count >= 20 → 402 (LIMIT_EXCEEDED)
7. validateStoragePathOwnership() → 실패 403
8. 파일 다운로드 (parse-temp):
   PDF storage path → downloadFromParseTemp()
   image storagePaths → Promise.all(downloadFromParseTemp[])
9. 텍스트 추출:
   PDF base64 or 다운로드 → pdf-parse → textToUse
   image base64/storage → extractTextFromImages() → textToUse
   text → 직접 textToUse
10. parseToActionPlan(textToUse, finalOptions) → ActionPlan
11. Free 티어: plan.actions에서 priority 필드 제거
12. incrementUsage(userId)
13. supabase.from("saved_todo").insert({ plan, title, options }) → id 반환
14. NextResponse.json({ ...plan, id })

finally: deleteFromParseTemp(storagePathsToDelete)
```

**에러 코드 맵**:

| 코드 | 원인 |
|------|------|
| 400 | JSON 파싱 실패, 유효성 검증 실패 |
| 401 | 세션 없음 |
| 402 | 월간 한도 초과 (Free) |
| 403 | 미동의 또는 파일 소유권 없음 |
| 500 | LLM 오류 |
| 502 | OCR 실패 또는 PDF 파싱 실패 |
| 503 | OPENAI_API_KEY 미설정 |

---

### 8-2. POST /api/parse/upload-url

```
인증 + 동의 확인
UploadUrlSchema 검증 (type, fileCount)
fileCount 만큼 반복:
  path = `${userId}/${uuidv4()}.${ext}`
  supabase.storage.from("parse-temp").createSignedUploadUrl(path)
반환: { uploads: [{ uploadUrl, storagePath }] }
```

---

### 8-3. GET/POST /api/consent

```
GET: { agreed: boolean }
POST: setTermsAgreed(userId) → 200
```

---

### 8-4. GET /api/usage

```
인증 확인
getOrResetUsage(userId)
반환: { count, limit, last_reset_at }
```

> **수정 내역**: 최근 커밋에서 `credits` → `usage` 시스템으로 변경됨.
> `src/app/api/usage/route.ts`가 `user_credits` 대신 `user_usage` 테이블 사용.

---

### 8-5. GET /api/plans

```
쿼리: ?page=1&category=all&search=""
PaginationSchema 검증
pageSize = 10
offset = (page - 1) * 10

쿼리 빌드:
  saved_todo WHERE user_id = userId
  category !== "all" → AND plan->>category = category (JSONB 쿼리)
  search 있음 → AND title ILIKE %search%
  ORDER BY created_at DESC
  RANGE: offset ~ offset+pageSize-1

반환: { data: SavedActionPlan[], totalCount, page, pageSize }
```

---

### 8-6. GET·DELETE /api/todo/[id]

```
GET:
  TodoIdSchema 검증
  saved_todo WHERE id = id AND user_id = userId → 소유권 검증
  반환: SavedActionPlan

DELETE:
  소유권 검증 후 DELETE
  204 No Content
```

---

### 8-7. GET /api/todo/history

```
saved_todo WHERE user_id = userId
ORDER BY created_at DESC LIMIT 5
반환: [{ id, title, created_at }]
```

---

## 9. 페이지 컴포넌트

### src/app/page.tsx — 랜딩 페이지 (/)

- Hero 섹션: CTA 버튼 (시작하기 → 구글 로그인)
- 기능 소개 카드 3개
- 인증된 유저는 미들웨어에서 `/dashboard`로 자동 리다이렉트 (`?landing=1`로 우회 가능)

---

### src/app/layout.tsx — 루트 레이아웃

```
<head>
  Google AdSense script 삽입
  다크모드 초기화 인라인 스크립트 (React hydration 전 실행 → 깜빡임 방지)
    localStorage['theme'] === 'dark' OR 시스템 prefers-color-scheme dark
    → document.documentElement.classList.add('dark')
</head>
<body>
  <SessionProvider>
    <Navbar />
    <main>{children}</main>
    <Footer />
  </SessionProvider>
</body>
```

OG 메타데이터, Twitter 카드 설정 포함.

---

### src/app/dashboard/page.tsx — 대시보드

**레이아웃**: 2컬럼 (30% 좌측 + 70% 우측)

**좌측 패널**:
- 사용자 인사 + 업로드 CTA
- 사용량 카드 (count / limit, 티어 배지)
- Pro 업그레이드 링크
- 광고 섹션

**우측 패널**:
- 카테고리 필터 버튼 (8개 + 전체)
- 검색창
- 이력 목록 (카드 형태, 클릭 → /todo?id=...)
- 페이지네이션 (최대 5페이지 버튼 표시)

API 호출: `GET /api/plans?page={page}&category={cat}&search={q}`

---

### src/app/upload/page.tsx — 업로드 페이지

**입력 탭 3종**:

| 탭 | 설명 |
|----|------|
| 이미지 | 드래그앤드롭, 복수 첨부, 미리보기, 삭제 버튼 |
| PDF | 단일 파일, 10MB 제한 |
| 텍스트 | 직접 입력 |

**파일 업로드 흐름**:
```
1. /api/parse/upload-url 호출 → 서명된 URL 획득
2. Supabase Storage에 직접 PUT 업로드
3. storagePath 수집
4. /api/parse POST { type, imageStoragePaths or pdfStoragePath, options }
```

**Pro 옵션 사이드바**:
- 모델 선택 (gpt-4o-mini / gpt-5-mini)
- 우선순위 분석 토글
- 상세도 선택 (brief/normal/detailed)
- 커스텀 카테고리 입력

**기타**:
- 사용량/한도 카드 표시
- 최근 이력 사이드바
- 첫 방문 시 이용약관 동의 모달 (POST /api/consent)
- 로딩 오버레이 (Free 사용자에게 광고 표시)
- 에러 코드별 사용자 친화적 메시지 (402 = 한도 초과 등)

---

### src/app/todo/page.tsx — 할 일 뷰어 (/todo?id=...)

**조회 로직**:
```
URL 쿼리 id 있음 → GET /api/todo/{id} 호출
없음 → sessionStorage에서 readStoredActionPlan()
```

**뷰 모드**:
- 제목, 카테고리 배지, 키워드 태그
- 액션 아이템: 체크박스, 태스크명, 마감일, 우선순위 배지
- Google Calendar 버튼: 날짜 파싱 후 `https://calendar.google.com/calendar/r/eventedit?...` 인텐트 URL 생성
- 사이드바: analysis, keyPoints, requirements, unknowns

**편집 모드**:
- 제목 인라인 편집
- 액션 추가/삭제/수정 (task, due, priority)
- 키워드, keyPoints, requirements, unknowns 수정
- 저장: PUT /api/todo/{id} (추정) 또는 DB 직접 upsert

**정렬 기능** (Pro 전용):
- 없음 / 날짜순 / 우선순위순

**삭제**: 확인 다이얼로그 → DELETE /api/todo/{id}

---

### src/app/plan/page.tsx — 요금제 페이지

Free vs Pro 비교 카드, 기능 체크리스트, FAQ.
테스트용 Pro 토글 버튼 → `POST /api/test/toggle-pro` (개발 전용으로 추정).

---

### src/app/terms/page.tsx, src/app/privacy/page.tsx

법적 문서. 7개 섹션 (서비스 목적, 이용 내용, 가입, 의무, 면책, 변경, 연락처).
개인정보처리방침에 외부 연동 명시: OpenAI, Google Cloud Vision, Supabase.
사업자 정보: Aiden Development.

---

## 10. 공통 컴포넌트

### src/components/Navbar.tsx

```
비인증: 로그인 버튼
인증: 아바타(구글 프로필 이미지) + 로그아웃 버튼
다크/라이트 모드 토글 버튼 (localStorage 'theme' 키)
로고 (악센트 컬러)
```

### src/components/Footer.tsx

```
/ 또는 /dashboard 경로 → 전체 푸터 (회사정보, 이용약관, 개인정보처리방침)
그 외 → 미니 푸터
사업자등록번호, 연락처 이메일 포함
```

---

## 11. Supabase 테이블 구조

| 테이블 | 주요 컬럼 | 설명 |
|--------|-----------|------|
| `saved_todo` | id, user_id, plan (JSONB), title, created_at, options (JSONB) | 현재 사용 중인 플랜 저장 테이블 |
| `action_plans` | id, user_id, plan (JSONB), title, created_at | 구 테이블 (레거시, Actonix 시절) |
| `user_usage` | user_id, balance (사용 횟수), last_refill_at, display_name, created_at, updated_at | 월간 사용량 추적 |
| `subscriptions` | user_id, status, current_period_end | 구독 상태 (status="active" + 미만료 = Pro) |
| `user_consents` | user_id, terms_agreed_at | 이용약관 동의 기록 |

> **주의**: `user_usage.balance` 컬럼이 사용량 카운터로 사용됨 (이름이 크레딧 잔액처럼 보이지만 실제로는 사용 횟수).

---

## 12. 비즈니스 불변 규칙

> **CLAUDE.md 명시 사항. 제품 책임자 승인 없이 변경 금지.**

1. **파이프라인 순서 불변**: 인증 → 동의 → 유효성 → 사용량 → OCR → LLM → 검증 → 증가
2. **사용량은 validateActionPlan() 성공 후에만 증가**
3. **OCR 실패 시 LLM 호출 금지**
4. **비용 공식은 calculateParseCost()만 사용** (현재 코드에서는 usage로 대체된 것으로 보임)
5. **getOrRefillCredits()는 월간 리셋의 단일 소스** (현재 getOrResetUsage()로 대응)
6. **모델 = gpt-4o-mini** (변경 시 비용 영향 분석 필수)
7. **response_format: json_object 필수** (제거 시 파싱 불가 자유 텍스트 반환 가능)
8. **parse-temp 버킷 파일은 성공·실패 모두 삭제** (finally 블록)
9. **인증 체인**: session → consent → 비즈니스 로직 (우회 엔드포인트 없음)

---

## 13. Free vs Pro 티어 차이

| 항목 | Free | Pro |
|------|------|-----|
| 월간 파싱 횟수 | 20회 | 무제한 |
| 이미지 첨부 | 5장 | 50장 |
| 모델 | gpt-4o-mini 고정 | 선택 가능 |
| 우선순위 분석 | 결과에서 priority 필드 제거 | ✅ |
| 상세도 설정 | ❌ | brief/normal/detailed |
| 커스텀 카테고리 | ❌ | ✅ |
| 정렬 기능 | ❌ | 날짜·우선순위 |
| 로딩 중 광고 | ✅ | ❌ |

**Free 처리 코드**:
```typescript
// route.ts — 파싱 요청 시
const finalOptions = tier === "pro"
  ? options
  : { model: "gpt-4o-mini", usePriority: false };

// 결과 반환 전 priority 제거
if (tier === "free") {
  plan.actions = plan.actions.map(action => {
    const { priority, ...rest } = action;
    return rest;
  });
}
```

---

## 14. 보안 포인트

### 인증 체인

```
모든 API: getServerSession() 필수
모든 보호 페이지: middleware.ts JWT 검증
동의 없는 사용자: 403 반환 (parse, upload-url)
```

### 스토리지 경로 보안

```typescript
// 디렉토리 트래버설 차단
if (path.includes("..") || path.startsWith("/") || path.startsWith("\\"))
  throw Error("잘못된 스토리지 경로입니다.");

// 정규식 화이트리스트
const SAFE_PATH_RE = /^[a-zA-Z0-9_\-/]+\.[a-zA-Z0-9]+$/;

// 소유권 검증 (RLS 이중 체크)
if (!sanitized.startsWith(`${userId}/`))
  throw Error("접근 권한이 없습니다.");
```

### 이중 권한 검증

Supabase RLS + 백엔드 소유권 체크를 모두 적용.

### Supabase 클라이언트 분리

- `admin.ts` (service-role): 서버 전용, 절대 클라이언트에 노출 금지
- `client.ts` (anon): RLS 준수, 공개 가능

### 환경 분기 에러 메시지

```typescript
// 개발환경: 상세 오류 메시지
// 프로덕션: 일반적인 메시지 (정보 노출 방지)
process.env.NODE_ENV === "development" ? detailedMsg : "서비스를 일시적으로 사용할 수 없습니다."
```

---

## 15. 데이터 흐름 전체 다이어그램

```
[사용자 브라우저]
    │
    ├─ 파일 드래그앤드롭/텍스트 입력
    │
    ▼
[/upload 페이지]
    │
    ├─ POST /api/parse/upload-url
    │     └─ Supabase Storage (parse-temp) ← 서명된 URL 생성
    │
    ├─ PUT {signedUrl} (파일 직접 업로드)
    │     └─ Supabase Storage (parse-temp) ← 파일 저장
    │
    └─ POST /api/parse
          │
          ├─ 1. OPENAI_API_KEY 확인
          ├─ 2. getServerSession() [NextAuth JWT]
          ├─ 3. getTermsAgreed() [Supabase: user_consents]
          ├─ 4. ParseInputSchema 검증 [Zod]
          ├─ 5. getTier() [Supabase: subscriptions]
          ├─ 6. getOrResetUsage() [Supabase: user_usage]
          ├─ 7. validateStoragePathOwnership()
          ├─ 8. downloadFromParseTemp() [Supabase Storage]
          ├─ 9a. PDF → pdf-parse → text
          │   9b. Image → extractTextFromImages() → Google Vision → text
          │   9c. Text → 직접 사용
          ├─ 10. parseToActionPlan() → OpenAI GPT-4o-mini
          ├─ 11. validateActionPlan() [schema.ts]
          ├─ 12. Free 티어: priority 제거
          ├─ 13. incrementUsage() [Supabase: user_usage]
          ├─ 14. saved_todo INSERT [Supabase]
          └─ finally: deleteFromParseTemp() [Supabase Storage]
                │
                ▼
         ActionPlan JSON + id 반환
                │
    ▼
[/todo?id=... 페이지]
    │
    ├─ GET /api/todo/{id} [Supabase: saved_todo]
    ├─ 체크박스 토글 (로컬 상태)
    ├─ 편집 모드 (인라인 수정)
    ├─ Google Calendar 인텐트 URL 생성
    └─ DELETE /api/todo/{id}
```

---

## 16. 알려진 기술 부채 및 메모

### 네이밍 불일치

- `user_usage.balance` 컬럼이 "사용 횟수 카운터"로 사용됨 (balance = 잔액 의미)
- CLAUDE.md의 `calculateParseCost()`, `getOrRefillCredits()`는 마이그레이션 중 `usage.ts`의 함수들로 대체됨 — CLAUDE.md 문서가 최신 상태를 반영하지 못함

### plan/page.tsx의 테스트 엔드포인트

`/api/test/toggle-pro`는 프로덕션 배포 전 제거 또는 개발 환경에서만 활성화되어야 함.

### action_plans 테이블 레거시

Actonix에서 마이그레이션 시 사용하던 `action_plans` 테이블이 남아 있음.
현재 `saved_todo` 테이블만 사용 중. 정리 가능.

### gpt-5-mini 임시 매핑

```typescript
if (modelToUse === "gpt-5-mini") {
  modelToUse = "gpt-4o"; // 가용한 최상위 모델로 임시 매핑
}
```
실제 gpt-5가 출시되면 이 매핑 로직 재검토 필요.

### incrementUsage 이중 쿼리

Pro 사용자의 경우 `incrementUsage()` 내부에서 `getTier()` 한 번 + select 한 번 = 2번의 DB 쿼리.
호출 전에 이미 tier가 알려진 상태이므로 tier를 파라미터로 받으면 쿼리 1회 절약 가능.

### 파싱 실패 시 사용량 증가 없음

`parseToActionPlan()` 또는 `validateActionPlan()` 실패 시 `incrementUsage()` 호출 안 됨. 올바른 동작.
단, 장시간 LLM 호출 후 실패 시 클라이언트는 재시도 가능 → 재시도 제한 로직 없음.

### sessionStorage 플랜 캐시

`writeStoredActionPlan()`이 언제 호출되는지 확인 필요.
`/api/parse` 응답 후 클라이언트에서 저장하는 것으로 추정되며, 브라우저 탭 닫으면 삭제됨.

---

*이 문서는 2026-03-15 기준 `main` 브랜치를 전수 분석하여 작성되었습니다.*
*코드 변경 시 이 문서도 함께 업데이트 권장.*
