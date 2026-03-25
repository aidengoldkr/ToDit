# ToDit For AI

이 문서는 `ToDit`를 처음 접하는 AI Agent가 코드베이스를 빠르게 이해하고, 안전하게 수정하고, 디버깅할 수 있도록 만든 온보딩 문서다.

목표는 다음 4가지를 한 번에 전달하는 것이다.

1. `ToDit`은 무엇인가
2. 기술적으로 어떻게 구현되어 있는가
3. 디렉토리 구조는 어떻게 생겼는가
4. 핵심 로직은 어디서 어떻게 흐르는가

추가로, 실제 운영상 주의점, 데이터 모델, 변경 시 위험 지점, 문서/코드 간 불일치도 함께 정리한다.

---

## 1. ToDit은 무엇인가

`ToDit`은 한국어 중심의 문서/이미지/텍스트 입력을 받아, 실행 가능한 `To-Do` 계획으로 분해해 주는 Next.js SaaS다.

한 줄로 요약하면:

> 사진, PDF, 텍스트 같은 비정형 입력을 AI가 읽고, 사용자가 바로 실행할 수 있는 구조화된 `ActionPlan`으로 바꿔 저장하는 서비스

### 제품의 핵심 가치

- 단순 요약이 아니라 `행동 분해(action decomposition)`를 한다.
- 입력 문서에서 해야 할 일을 추출하는 데서 끝나지 않고, 더 작은 실행 단위의 작업으로 쪼갠다.
- 각 작업에 마감일과 우선순위를 부여한다.
- 결과를 일회성 응답으로 끝내지 않고, 사용자별 히스토리로 저장하고 다시 편집할 수 있게 한다.

### 대표 사용자 흐름

`랜딩 -> 로그인/회원가입 -> 대시보드 -> 업로드/입력 -> AI 파싱 -> To-Do 결과 확인/수정 -> 히스토리 재조회`

### 현재 제품 상태를 한 문장으로 표현하면

`ToDit`은 이미 핵심 파이프라인은 작동하지만, 결제/구독 연동은 완전히 마감되지 않았고, 일부 문서와 코드의 용어가 최신 상태와 어긋나는 과도기적 SaaS다.

---

## 2. 제품이 실제로 하는 일

사용자는 아래 3가지 방식으로 입력할 수 있다.

- 이미지 업로드
- PDF 업로드
- 텍스트 직접 입력

서버는 입력을 다음처럼 처리한다.

1. 사용자 인증 확인
2. 약관 동의 확인
3. 무료/프로 여부 확인
4. 무료 사용량 제한 확인
5. 이미지면 OCR, PDF면 텍스트 추출
6. OpenAI에 문서 분해 요청
7. 결과 JSON 검증 및 보정
8. 사용자 히스토리에 저장
9. 결과를 `/todo?id=...`에서 보여줌

즉, 이 앱의 본질은 다음 수식으로 이해하면 된다.

`비정형 입력 -> 텍스트화 -> LLM 구조화 -> ActionPlan 저장 -> To-Do 관리 UI`

---

## 3. 기술 스택

### 프론트엔드

- Next.js 14 App Router
- React 18
- CSS Modules
- 전역 CSS 토큰 기반 테마
- `next-auth/react` 세션 사용

### 백엔드

- Next.js Route Handlers (`src/app/api/**`)
- NextAuth
- Supabase
- OpenAI Chat Completions API
- Google Cloud Vision OCR
- `pdf-parse`
- Resend 이메일 발송

### 데이터 저장소

- Supabase Postgres
- Supabase Storage (`parse-temp` 버킷)

### 인증 방식

- Google OAuth
- 자체 이메일/비밀번호 로그인

---

## 4. 이 프로젝트를 이해하는 핵심 개념

### 4.1 `ActionPlan`이 도메인 중심이다

앱 전반의 중심 데이터는 `ActionPlan`이다. 이 타입은 `src/types/index.ts`에 정의되어 있다.

핵심 구조:

- `category`
- `title`
- `analysis`
- `keywords`
- `keyPoints`
- `actions`
- `requirements`
- `unknowns`

특히 `actions` 배열이 실제 To-Do 목록이며, 각 항목은 다음을 가진다.

- `task`
- `due`
- `priority`
- `done`

즉, ToDit의 모든 UI/DB/API는 결국 이 `ActionPlan`을 생성, 저장, 수정, 표시하는 방향으로 맞춰져 있다.

### 4.2 이 앱은 서버 컴포넌트 중심 앱이 아니다

App Router를 쓰지만 실제 UX의 대부분은 클라이언트 컴포넌트에서 돌아간다.

핵심 페이지 대부분이 `use client`이며 다음 패턴을 반복한다.

- 페이지 로드
- 세션 확인
- 클라이언트 fetch
- API 응답으로 상태 갱신
- optimistic update 또는 폼 상태 관리

즉, 이 프로젝트는 "React 클라이언트 앱 + Next API 백엔드"에 가깝게 이해하는 편이 맞다.

### 4.3 Supabase는 두 가지 방식으로 쓴다

1. 관리자 권한 클라이언트
- 파일: `src/lib/supabase/admin.ts`
- `SERVICE_ROLE_KEY` 사용
- RLS 우회 가능
- 서버 내부 로직, 저장, 사용량 갱신 등에 사용

2. 인증 흉내 클라이언트
- 파일: `src/lib/supabase/authenticated.ts`
- anon key 사용
- `x-todit-user-id` 헤더를 붙여 RLS 정책과 연결
- 특정 사용자 소유 데이터 조회/수정에 사용

즉, 이 앱은 "Supabase Auth를 정식 사용자 세션으로 쓰는 구조"가 아니라, "NextAuth 세션 + 커스텀 헤더 기반 RLS" 구조다.

이 점을 놓치면 데이터 접근 로직을 잘못 수정하게 된다.

### 4.4 `users.balance`는 돈이 아니라 사용량 카운터다

과거 문서에는 credit 개념이 남아 있지만, 현재 코드 기준 `users.balance`는 사실상 월간 사용 횟수 카운터다.

- 무료 사용자: 월 20회 제한
- 프로 사용자: 사실상 무제한 (`limit: null`)

관련 파일:

- `src/lib/usage.ts`
- `src/lib/subscription.ts`

이 용어 부채 때문에 "balance = 크레딧"으로 오해하면 안 된다.

---

## 5. 디렉토리 구조

아래는 AI Agent가 먼저 봐야 하는 실제 구조다.

```text
src/
  middleware.ts
  app/
    layout.tsx
    providers.tsx
    page.tsx
    api/
      auth/
        [...nextauth]/route.ts
        signup/route.ts
        verify/route.ts
      consent/route.ts
      parse/route.ts
      parse/upload-url/route.ts
      plans/route.ts
      todo/history/route.ts
      todo/[id]/route.ts
      usage/route.ts
    auth/
      signin/page.tsx
      signup/page.tsx
    dashboard/page.tsx
    upload/page.tsx
    todo/page.tsx
    plan/page.tsx
    terms/page.tsx
    privacy/page.tsx
    refund/page.tsx
  components/
    Navbar.tsx
    Footer.tsx
    GoogleAd.tsx
    MockUI.tsx
    InAppRedirectHandler.tsx
    IosKakaoModalProvider.tsx
    IosKakaoModal.tsx
  lib/
    action-plan-session.ts
    auth.ts
    auth-options.ts
    consent.ts
    google-ocr.ts
    in-app.ts
    openai.ts
    resend.ts
    schema.ts
    subscription.ts
    usage.ts
    validators.ts
    supabase/
      admin.ts
      authenticated.ts
      client.ts
      storage.ts
  styles/
    globals.css
    tokens.css
  types/
    index.ts
    next-auth.d.ts
    pdf-parse.d.ts

supabase/
  schema.sql
  migrations/
    20260315_secure_auth_rls.sql
    20260322_add_email_verification_columns.sql
    20260322_merge_user_usage.sql
    security_fix_rls.sql
```

### 디렉토리 역할 요약

- `src/app`: 라우트와 페이지, API 엔드포인트
- `src/components`: 재사용 UI
- `src/lib`: 비즈니스 로직과 외부 서비스 연동
- `src/lib/supabase`: Supabase 접근 계층
- `src/styles`: 공통 스타일/토큰
- `src/types`: 핵심 타입
- `supabase`: DB 스키마와 마이그레이션
- `autorecord`: 과거 분석/리뷰 문서 아카이브

### 눈에 띄는 구조적 특징

- `src/hooks`, `src/utils`는 현재 비어 있다.
- `src/app/globals.css`가 있지만 실제 루트 레이아웃은 `../styles/globals.css`를 import한다.
- 즉, `src/app/globals.css`는 현재 기준 거의 레거시/잔여 파일로 보는 것이 안전하다.

---

## 6. 주요 화면과 역할

### `/`

랜딩 페이지다.

- 제품 소개
- 가격
- FAQ
- 로그인 유도 CTA

파일:

- `src/app/page.tsx`

### `/auth/signin`

로그인 페이지다.

- Google 로그인
- 이메일/비밀번호 로그인
- 인증 결과 메시지 처리

파일:

- `src/app/auth/signin/page.tsx`

### `/auth/signup`

회원가입 페이지다.

- 이메일/비밀번호 회원가입
- 가입 후 이메일 인증 안내 UI
- Google 로그인 대체 진입 제공

파일:

- `src/app/auth/signup/page.tsx`

### `/dashboard`

로그인 후 메인 홈이다.

- 사용량 표시
- 업로드 진입
- 히스토리 조회
- 검색
- 카테고리 필터
- 페이지네이션

파일:

- `src/app/dashboard/page.tsx`

### `/upload`

실제 작업 시작 화면이다.

- 이미지 업로드
- PDF 업로드
- 텍스트 입력
- Pro 옵션 설정
- 약관 동의 모달
- 파싱 요청

파일:

- `src/app/upload/page.tsx`

### `/todo?id=...`

결과 확인/수정 화면이다.

- 생성된 To-Do 렌더링
- 완료 체크
- 정렬
- 직접 편집
- 저장
- 삭제
- Google Calendar 링크 생성

파일:

- `src/app/todo/page.tsx`

### `/plan`

요금제 안내 화면이다.

중요한 점:

- 디자인상으로는 업그레이드 화면이지만
- 실제 결제 연동은 아직 완전히 붙어 있지 않다

파일:

- `src/app/plan/page.tsx`

### 정책 페이지

- `/terms`
- `/privacy`
- `/refund`

정적 정책 페이지다.

---

## 7. 전역 앱 구조

루트 레이아웃은 `src/app/layout.tsx`다.

전역적으로 다음을 붙인다.

- 글로벌 스타일
- `Providers`
- `Navbar`
- `Footer`
- `InAppRedirectHandler`
- Google AdSense 스크립트

즉, 모든 페이지는 기본적으로 공통 네비게이션, 푸터, 세션 컨텍스트, 인앱 브라우저 우회 로직을 공유한다.

### `Providers`

`src/app/providers.tsx`

역할:

- `SessionProvider`
- `IosKakaoModalProvider`
- 클라이언트 title 보정

---

## 8. 핵심 서버 로직: 파싱 파이프라인

이 프로젝트에서 가장 중요한 파일은 `src/app/api/parse/route.ts`다.

이 파일이 ToDit의 핵심 서비스 로직이다.

### 파싱 파이프라인 전체 흐름

1. `OPENAI_API_KEY` 존재 확인
2. 세션 확인
3. 약관 동의 확인
4. 입력 JSON 파싱
5. `ParseInputSchema`로 요청 검증
6. 사용자 구독 등급 확인
7. 무료 사용량 제한 확인
8. 업로드된 스토리지 경로 소유권 검증
9. 입력 타입별 텍스트 추출
10. OpenAI로 `ActionPlan` 생성
11. 무료 사용자면 priority 정보 제거
12. 사용량 증가
13. `saved_todo`에 저장
14. 응답 반환
15. `finally`에서 임시 업로드 파일 삭제

### 입력 타입별 처리

#### 텍스트

- 사용자가 입력한 문자열을 그대로 LLM에 보낸다.

#### 이미지

- Supabase Storage에 올린 파일을 읽거나
- base64를 직접 받는다
- Google Vision OCR로 텍스트를 추출한다

관련 파일:

- `src/lib/google-ocr.ts`

#### PDF

- Supabase Storage 또는 base64에서 PDF를 읽는다
- `pdf-parse`로 텍스트를 추출한다

### 파싱 결과

최종적으로 OpenAI 응답은 `ActionPlan` 구조로 변환되고, `saved_todo.plan`에 JSONB 형태로 저장된다.

---

## 9. LLM 로직

LLM 호출 로직은 `src/lib/openai.ts`에 있다.

### 역할

- 시스템 프롬프트 생성
- 옵션에 따라 프롬프트 강화
- OpenAI Chat Completions 호출
- JSON 문자열 추출
- JSON 파싱
- 스키마 검증 함수 호출

### 프롬프트의 핵심 의도

이 앱은 문서를 "요약"하는 것이 아니라 "실행 계획으로 분해"하도록 모델을 강하게 유도한다.

프롬프트는 대략 아래를 강제한다.

- 문서 유형 분류
- 핵심 맥락 추출
- 작업을 세분화
- 역산된 마감일 부여
- JSON만 출력

### 모델 사용 방식

- 기본 모델은 `gpt-4o-mini`
- Pro 사용자는 `gpt-4o`로 override
- `response_format: { type: "json_object" }`
- `temperature: 0.2`

### Pro 옵션

업로드 화면에서 전달하는 옵션:

- `usePriority`
- `customCategory`
- `detailLevel`

이 옵션들은 프롬프트를 직접 바꾸는 방식으로 반영된다.

### 실제 의미

ToDit의 "AI 품질"은 모델 자체보다도 `src/lib/openai.ts`의 시스템 프롬프트 설계에 많이 의존한다.

즉, 제품 성능을 바꾸고 싶다면 먼저 이 파일을 봐야 한다.

---

## 10. 스키마 검증과 후처리

`src/lib/schema.ts`는 LLM 출력 검증/보정 레이어다.

### 하는 일

- category 값 정규화
- action 배열 정제
- priority 기본값 보정
- `done` 처리
- `requirements`, `unknowns`, `keywords`, `keyPoints` 정제
- `due`가 비어 있으면 fallback date 부여

### 중요한 특징

LLM이 완벽한 결과를 주지 않아도 이 레이어가 어느 정도 보정한다.

특히:

- `due`가 없으면 가장 이른 due 기준 하루 전 날짜를 fallback으로 채운다

즉, 저장된 마감일은 항상 "모델이 직접 쓴 값"이라고 가정하면 안 된다.

---

## 11. 인증 구조

인증 핵심 파일:

- `src/lib/auth-options.ts`
- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`

### 지원 인증 방식

- Google OAuth
- 이메일/비밀번호 credentials

### Credentials 로그인

- `users` 테이블에서 사용자 조회
- `password_hash`와 `bcryptjs.compare`
- `email_verified_at`가 없으면 로그인 차단

### Google 로그인

Google 로그인 시 앱은 사용자 row를 다음 순서로 맞춘다.

1. Google에서 받은 `user.id` 기준 조회
2. 이메일 기준 조회
3. 있으면 기존 사용자 row 재사용
4. 없으면 새로 insert

그 뒤 JWT callback에서 `token.sub`를 DB 사용자 ID로 교체하고, session callback에서 `session.user.id`에 넣는다.

즉, 프론트와 API는 최종적으로 `session.user.id`를 내부 사용자 식별자로 사용한다.

### 이메일 회원가입 흐름

파일:

- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/verify/route.ts`
- `src/lib/resend.ts`

흐름:

1. 이메일, 이름, 비밀번호 검증
2. 비밀번호 해시
3. `verification_token` 생성
4. `users` insert
5. Resend로 인증 메일 발송
6. `/api/auth/verify?token=...`에서 인증 완료

---

## 12. 라우트 보호 방식

`src/middleware.ts`는 페이지 접근 제어를 담당한다.

### 익명 사용자는 막히는 경로

- `/dashboard`
- `/todo`
- `/upload`

### 추가 동작

- 로그인된 사용자가 `/`에 오면 `/dashboard`로 보낸다
- 단, `?landing=1`이면 랜딩 유지 가능

### 매우 중요한 점

middleware는 API를 보호하지 않는다.

즉, API는 각 route handler에서 반드시 다시 세션 검사를 한다.

---

## 13. 사용량/구독 로직

### 사용량

파일:

- `src/lib/usage.ts`
- `src/app/api/usage/route.ts`

현재 로직:

- 무료 사용자: 월 20회
- Pro 사용자: 제한 없음
- 월이 바뀌면 `users.balance`를 0으로 리셋
- `last_refill_at`로 리셋 기준 추적

### 구독

파일:

- `src/lib/subscription.ts`

구독 판단 기준:

- `subscriptions.status === "active"`
- `current_period_end`가 현재 시각보다 뒤여야 함

둘 다 만족해야 `pro`

### 중요한 현실

`activateSubscription()`는 존재하지만, 현재 repo 안에서 실제로 연결된 결제 webhook/승인 흐름은 보이지 않는다.

즉, "구독 도메인 모델은 존재하지만 실제 상용 결제 흐름은 미완성" 상태로 보는 것이 맞다.

---

## 14. 약관 동의 로직

파일:

- `src/lib/consent.ts`
- `src/app/api/consent/route.ts`

역할:

- 사용자가 약관/개인정보 처리방침에 동의했는지 조회
- 동의 시 timestamp upsert

중요:

- parse API
- upload-url API

이 두 군데는 동의가 필수다.

반면, 모든 API에 전역적으로 강제되는 것은 아니다.

즉 "consent는 parse 관련 고위험 흐름의 게이트"로 이해하는 편이 맞다.

---

## 15. 파일 업로드와 스토리지 로직

### 업로드 준비

파일:

- `src/app/api/parse/upload-url/route.ts`

역할:

- 로그인 확인
- 동의 확인
- Supabase Storage signed upload URL 생성

업로드 경로 형식:

`<userId>/<uuid>.<ext>`

버킷 이름:

- `parse-temp`

### 보안 장치

파일:

- `src/lib/validators.ts`
- `src/lib/supabase/storage.ts`

중요 함수:

- `sanitizeStoragePath`
- `validateStoragePathOwnership`

즉, parse API는 업로드된 경로가 반드시 현재 사용자 디렉토리 아래에 있는지 검사한다.

이 검증을 깨면 다른 사용자의 임시 파일에 접근할 수 있는 취약점이 생긴다.

### 파일 수명

파싱이 끝나면 성공/실패와 무관하게 `finally`에서 삭제한다.

이건 ToDit의 중요한 invariant다.

---

## 16. DB 모델

DB 스키마 기준 핵심 테이블은 4개다.

### `users`

역할:

- 사용자 계정
- 프로필
- credentials 인증 데이터
- 사용량 카운터

주요 컬럼:

- `id`
- `email`
- `password_hash`
- `name`
- `image`
- `provider`
- `balance`
- `last_refill_at`
- `email_verified_at`
- `verification_token`

### `user_consents`

역할:

- 약관 동의 기록

주요 컬럼:

- `user_id`
- `terms_agreed_at`

### `subscriptions`

역할:

- 무료/프로 구분

주요 컬럼:

- `user_id`
- `status`
- `current_period_end`

### `saved_todo`

역할:

- 생성된 결과 저장

주요 컬럼:

- `id`
- `user_id`
- `plan` (`JSONB`)
- `title`
- `options`
- `created_at`
- `updated_at`

### 중요한 이력

`20260322_merge_user_usage.sql` 때문에 과거 `user_usage` 개념이 `users`에 흡수되었다.

즉:

- 예전 사고방식: 계정 테이블 + 사용량 테이블 분리
- 현재 사고방식: `users`가 계정과 사용량을 함께 가짐

이 때문에 옛 문서와 현재 코드가 어긋나는 부분이 있다.

---

## 17. RLS와 보안 모델

이 프로젝트의 보안 구조를 단순화하면 아래와 같다.

### 1차 보호

애플리케이션 코드에서 세션/소유권 검사

예:

- `getServerSession()`
- `validateStoragePathOwnership()`
- `eq("user_id", session.user.id)`

### 2차 보호

Supabase RLS

핵심 마이그레이션:

- `supabase/migrations/20260315_secure_auth_rls.sql`

여기서 `public.get_app_user_id()` 함수를 만들고, HTTP 헤더 `x-todit-user-id`를 읽어 정책에 연결한다.

즉, 일반적인 `auth.uid()` 기반 Supabase Auth 패턴이 아니라, NextAuth 세션을 RLS에 맞추기 위한 커스텀 설계다.

### 주의

서비스 롤 클라이언트는 RLS를 우회한다.

그래서 관리자 클라이언트를 쓰는 코드는 반드시 애플리케이션 레벨 소유권 검사를 동반해야 한다.

고위험 파일:

- `src/lib/supabase/admin.ts`
- `src/app/api/parse/route.ts`
- `src/app/api/plans/route.ts`
- `src/app/api/todo/[id]/route.ts`

---

## 18. 프론트엔드 UI 구조

### 핵심 공통 컴포넌트

#### `Navbar`

- 로그인/로그아웃 UI
- 사용자 프로필
- 테마 토글
- 인앱 브라우저 우회 로그인 CTA

파일:

- `src/components/Navbar.tsx`

#### `Footer`

- 페이지별로 풀 버전/미니 버전 푸터 처리

파일:

- `src/components/Footer.tsx`

#### `GoogleAd`

- Free 사용자의 광고 노출
- 라우트 변경 시 AdSense 재호출

파일:

- `src/components/GoogleAd.tsx`

#### `MockUI`

- 랜딩 페이지 hero용 데모 UI

파일:

- `src/components/MockUI.tsx`

### 업로드 화면의 의미

`src/app/upload/page.tsx`는 단순 업로드 폼이 아니다.

이 화면은 다음을 동시에 관리한다.

- 입력 모드 전환
- Free/Pro 기능 차이
- 파일 선택/드래그앤드롭
- 약관 동의 모달
- 업로드 signed URL 발급
- parse 실행
- 결과 저장 후 이동
- 히스토리 미리보기

즉, 사용자 생산성 흐름의 중심 화면이다.

### Todo 화면의 의미

`src/app/todo/page.tsx`는 단순 결과 뷰어가 아니다.

여기서 사용자는:

- 작업 완료 체크
- 정렬
- 직접 편집
- 개별 액션 추가/삭제
- 요구사항/unknowns 편집
- Google Calendar 등록
- 삭제

까지 수행한다.

즉, 생성 이후의 "실행 관리 UI" 역할도 같이 한다.

---

## 19. 인앱 브라우저 우회 로직

ToDit는 모바일 메신저 인앱 브라우저 환경을 중요한 운영 이슈로 다룬다.

관련 파일:

- `src/components/InAppRedirectHandler.tsx`
- `src/components/IosKakaoModalProvider.tsx`
- `src/components/IosKakaoModal.tsx`
- `src/lib/in-app.ts`

### Android

- 인앱 브라우저 감지 시 Chrome intent scheme으로 외부 브라우저 이동

### iOS KakaoTalk

- 자동 강제 이동 대신 안내 모달 노출
- 외부 열기
- 링크 복사

### 왜 중요한가

이 로직은 부가 기능이 아니라 로그인 성공률과 직결되는 운영 안정성 로직이다.

무심코 제거하면 인증 흐름이 모바일 환경에서 깨질 수 있다.

---

## 20. 스타일 시스템

### 방식

- CSS Modules
- 전역 CSS 변수
- 라이트/다크 모드 토글

핵심 파일:

- `src/styles/tokens.css`
- `src/styles/globals.css`

### 디자인 특징

- 메인 accent: 초록색 `#10b981`
- 커스텀 폰트 `Paperlogy`, `KBLJump`
- `html.dark` 클래스 기반 다크 모드

### 특이점

초기 테마 결정은 서버가 아니라 `layout.tsx`의 inline script가 `localStorage.theme`를 읽어 처리한다.

즉, hydration 이전에도 테마를 맞추려는 설계다.

---

## 21. API 엔드포인트 맵

### 인증

- `GET/POST /api/auth/[...nextauth]`
  - NextAuth 핸들러
- `POST /api/auth/signup`
  - credentials 회원가입
- `GET /api/auth/verify`
  - 이메일 인증 완료 처리

### 동의/사용량

- `GET /api/consent`
  - 동의 여부 조회
- `POST /api/consent`
  - 동의 처리
- `GET /api/usage`
  - 현재 월간 사용량 조회

### 파싱

- `POST /api/parse/upload-url`
  - 임시 업로드 URL 생성
- `POST /api/parse`
  - 핵심 파싱 API

### 저장된 결과

- `GET /api/plans`
  - 페이지네이션 + 검색 + 카테고리 필터
- `GET /api/todo/history`
  - 최근 5개 기록
- `GET /api/todo/[id]`
  - 단건 조회
- `PATCH /api/todo/[id]`
  - 편집 저장
- `DELETE /api/todo/[id]`
  - 삭제

---

## 22. 실제 유저 플로우를 코드로 보면

### 플로우 A: 텍스트 입력

1. 사용자가 `/upload`에서 text 입력
2. `/api/parse` 호출
3. OpenAI가 `ActionPlan` 반환
4. DB 저장
5. `/todo?id=...` 이동

### 플로우 B: 이미지 입력

1. `/api/parse/upload-url`로 signed URL 발급
2. 클라이언트가 Supabase Storage에 업로드
3. `/api/parse`에 storage path 전달
4. 서버가 파일 다운로드
5. Google OCR
6. OpenAI
7. 저장
8. 임시 파일 삭제

### 플로우 C: PDF 입력

1. signed URL 발급
2. Storage 업로드
3. `/api/parse`
4. `pdf-parse`
5. OpenAI
6. 저장
7. 임시 파일 삭제

---

## 23. 변경할 때 특히 조심해야 할 파일

### 절대 흐름을 깨면 안 되는 곳

- `src/app/api/parse/route.ts`
- `src/lib/openai.ts`
- `src/lib/schema.ts`
- `src/lib/usage.ts`
- `src/lib/subscription.ts`
- `src/lib/validators.ts`
- `src/lib/supabase/authenticated.ts`
- `supabase/migrations/20260315_secure_auth_rls.sql`

### 이유

- 파싱 순서
- 사용량 제한
- 파일 소유권 검증
- RLS 연결 방식
- ActionPlan 스키마

이 다섯 가지는 제품의 핵심 invariant다.

---

## 24. 코드 읽기 우선순위

새로운 AI Agent가 가장 먼저 읽어야 할 순서를 추천하면:

1. `src/types/index.ts`
2. `src/app/api/parse/route.ts`
3. `src/lib/openai.ts`
4. `src/lib/schema.ts`
5. `src/lib/usage.ts`
6. `src/lib/subscription.ts`
7. `src/app/upload/page.tsx`
8. `src/app/todo/page.tsx`
9. `src/lib/auth-options.ts`
10. `supabase/schema.sql`
11. `supabase/migrations/20260315_secure_auth_rls.sql`

이 순서로 보면 ToDit의 도메인, 핵심 흐름, 보안, UI를 가장 빨리 잡을 수 있다.

---

## 25. 현재 코드베이스의 불일치/과도기 포인트

이 섹션은 중요하다. AI Agent가 실수하는 지점이 대부분 여기서 나온다.

### 1. 오래된 문서와 현재 코드가 다르다

`CLAUDE.md`에는 credit 기반 설명이 남아 있지만, 현재 코드는 `usage count` 중심이다.

즉:

- 문서보다 코드가 더 최신이다

### 2. 결제/구독은 도메인만 있고 완결 흐름은 약하다

- `subscriptions` 테이블은 있음
- `getTier()`도 있음
- `activateSubscription()`도 있음
- 하지만 repo 안에서 결제 webhook이나 실제 활성화 플로우는 보이지 않음

즉:

- 프로 구독 UI는 있지만 상용 결제는 미완성 가능성이 높다

### 3. `/api/test/toggle-pro`를 호출하는 UI가 있는데 실제 route는 보이지 않는다

`src/app/plan/page.tsx`는 `/api/test/toggle-pro`를 호출하지만, 현재 파일 트리에서 그 route를 찾지 못했다.

즉:

- 이 페이지의 일부 동작은 현재 repo 기준 불완전하거나 제거 중일 수 있다

### 4. 한국어 문자열이 터미널에서 깨져 보일 수 있다

PowerShell/터미널 인코딩에 따라 한글이 mojibake처럼 보일 수 있다.

대부분의 경우:

- 파일이 깨진 것이 아니라 콘솔 출력이 깨진 것이다

### 5. `src/app/globals.css`는 사실상 비주류다

실제 루트 레이아웃이 import하는 파일은 `src/styles/globals.css`다.

즉:

- 스타일 수정은 `src/styles/globals.css`와 각 `*.module.css`를 우선 봐야 한다

---

## 26. 디버깅 포인트

### 파싱이 실패할 때

먼저 확인:

- `OPENAI_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- 세션 존재 여부
- 약관 동의 여부
- 무료 사용량 초과 여부
- uploaded storage path 소유권

### 로그인 문제가 날 때

확인:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- Google OAuth env
- `users.email_verified_at`
- 인앱 브라우저 여부

### 저장/조회가 꼬일 때

확인:

- `saved_todo.user_id`
- session의 `user.id`
- RLS 마이그레이션 적용 여부
- `x-todit-user-id` 헤더 기반 정책 존재 여부

### 구독 판정이 이상할 때

확인:

- `subscriptions.status`
- `subscriptions.current_period_end`
- 서버 시간과 만료일 비교

---

## 27. 환경 변수

코드 기준으로 중요한 env는 아래다.

- `OPENAI_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

즉, 이 앱은 최소한 OpenAI, NextAuth, Supabase, OCR, 이메일이 연결돼야 핵심 기능이 전부 돈다.

---

## 28. 이 프로젝트를 한 문장으로 다시 정의하면

ToDit은 `문서를 읽는 AI 서비스`가 아니라, `문서를 실행 계획으로 바꾸고 저장하는 작업 운영 서비스`다.

즉:

- 입력 처리 서비스이면서
- 계획 생성 서비스이고
- 결과 관리 서비스다

이 세 층이 모두 있어야 제품 전체를 이해한 것이다.

---

## 29. AI Agent용 최종 요약

ToDit를 가장 정확하게 이해하는 방식은 아래와 같다.

- 중심 도메인은 `ActionPlan`
- 핵심 백엔드는 `src/app/api/parse/route.ts`
- 핵심 AI 품질 레이어는 `src/lib/openai.ts`
- 핵심 보정 레이어는 `src/lib/schema.ts`
- 핵심 사용량/구독 로직은 `src/lib/usage.ts`, `src/lib/subscription.ts`
- 핵심 저장소는 `saved_todo`
- 핵심 위험 지점은 `service-role Supabase 사용`, `custom RLS`, `temp file ownership`, `old docs vs current code`

새 AI Agent가 이 프로젝트에서 무언가를 수정하려면, 먼저 아래 질문에 답할 수 있어야 한다.

1. 이 변경이 `ActionPlan` 스키마를 건드리는가?
2. 이 변경이 parse 파이프라인 순서를 깨는가?
3. 이 변경이 무료/프로 제약을 바꾸는가?
4. 이 변경이 RLS 또는 소유권 검증을 우회하게 만드는가?
5. 이 변경이 모바일 인앱 브라우저 로그인 안정성을 해치는가?

이 다섯 질문을 통과하면 대부분 안전하다.

---

## 30. 추천 읽기 세트

최소 읽기 세트:

- `src/types/index.ts`
- `src/app/api/parse/route.ts`
- `src/lib/openai.ts`
- `src/lib/schema.ts`
- `src/lib/usage.ts`
- `src/lib/subscription.ts`
- `src/lib/auth-options.ts`
- `src/app/upload/page.tsx`
- `src/app/todo/page.tsx`
- `supabase/schema.sql`
- `supabase/migrations/20260315_secure_auth_rls.sql`

이 문서까지 읽었다면, ToDit의 제품 구조와 코드 구조를 실제로 작업 가능한 수준까지 이해한 것이다.
