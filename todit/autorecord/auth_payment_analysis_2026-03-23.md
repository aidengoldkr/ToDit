# ToDit 로그인 및 결제 로직 분석

작성일: 2026-03-23
대상 워크스페이스: `c:\project\Insight_Paser\ToDit\todit`

## 1. 요약

ToDit의 인증은 `NextAuth` 기반이며, 현재 두 가지 로그인 방식이 공존한다.

- OAuth 로그인: `GoogleProvider`
- 자체 로그인: `CredentialsProvider` + 별도 회원가입 API + 이메일 인증

두 방식 모두 최종적으로는 Supabase `users` 테이블을 공통 사용자 저장소로 사용한다. 세션은 NextAuth JWT 전략을 사용하고, 서버 API는 `getServerSession()`으로 로그인 사용자를 확인한다.

결제는 PortOne(아임포트) 브라우저 SDK와 서버 검증 API를 조합한 단순 구조다.

- 클라이언트: PortOne SDK로 결제 요청
- 서버: PortOne REST API로 결제 단건 조회 후 금액/상태 검증
- 내부 반영: `subscriptions` 테이블을 `active` 상태로 upsert

현재 구현은 "1회 결제 성공 시 Pro 기간 1개월 부여" 수준으로는 동작하지만, 정기결제 수명주기 전체를 관리하는 구조는 아니다.

## 2. 인증 구조 개요

핵심 파일:

- `src/lib/auth-options.ts`
- `src/lib/auth.ts`
- `src/types/next-auth.d.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/verify/route.ts`
- `src/middleware.ts`
- `src/app/auth/signin/page.tsx`
- `src/app/auth/signup/page.tsx`
- `src/app/providers.tsx`

핵심 저장소:

- `users`
- `user_consents`
- `subscriptions`

세션 구조:

- `SessionProvider`가 앱 전체를 감싼다.
- 서버에서는 `src/lib/auth.ts`의 `getServerSession()` 래퍼를 사용한다.
- `session.user.id`는 `src/types/next-auth.d.ts`에서 타입 확장되어 있고, 실제 값은 `auth-options.ts`의 `session` callback에서 `token.sub`를 주입받는다.

## 3. Google OAuth 로그인 로직

### 3.1 진입점

Google 로그인은 여러 곳에서 호출된다.

- `/auth/signin` 페이지의 `signIn("google", { callbackUrl: "/dashboard" })`
- `/auth/signup` 페이지의 동일 버튼
- 대시보드/업로드 비로그인 상태에서 직접 `signIn("google")`

즉, UX상으로는 커스텀 로그인 페이지가 존재하지만 일부 화면에서는 Google 로그인으로 바로 진입한다.

### 3.2 NextAuth provider 설정

`src/lib/auth-options.ts`에서 `GoogleProvider`를 사용한다.

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

`NEXTAUTH_URL`이 없으면 `VERCEL_URL` 또는 `http://localhost:3000`로 보정한다.

### 3.3 Google 로그인 후 사용자 동기화

`callbacks.signIn`에서 `account.provider === "google"`일 때 Supabase `users` 테이블과 계정을 동기화한다.

주요 동작:

1. `createAdminClient()`로 Supabase admin client 획득
2. `user.id` 기준 기존 사용자 조회
3. `user.email` 기준 기존 사용자 조회
4. `id`는 있는데 `email`이 비어 있는 기존 레코드면 email 보강
5. 기존 사용자가 있으면 `user.id = existingUser.id`로 교체
6. 기존 사용자가 없으면 `users` 테이블에 신규 insert

삽입 필드:

- `id`
- `email`
- `name`
- `provider: "google"`
- `image`

즉, Google 로그인의 실질적인 기준 ID는 "Google 프로필 ID"가 아니라 "Supabase `users.id`"로 수렴하려고 설계되어 있다.

### 3.4 JWT/Session 정규화

`callbacks.jwt`에서 로그인 직후 DB의 실제 사용자 ID를 다시 조회해서 `token.sub`로 덮어쓴다.

의도:

- OAuth 공급자 ID와 내부 사용자 PK를 분리
- 이후 서버 API 전역에서 `session.user.id`를 내부 PK로 통일

`callbacks.session`은 `session.user.id = token.sub ?? ""`를 수행한다.

결과적으로 서버 로직은 로그인 방식과 무관하게 `session.user.id` 하나만 신뢰하면 된다.

## 4. 자체 로그인 로직

### 4.1 회원가입

회원가입 API는 `src/app/api/auth/signup/route.ts`에 있다.

입력 검증:

- `email`: 유효한 이메일
- `password`: 최소 6자
- `name`: 필수

처리 순서:

1. `users` 테이블에서 동일 이메일 조회
2. 이미 존재하면 차단
3. 기존 계정의 `provider === "google"`이면 "Google로 가입된 계정"으로 간주하고 자체 가입 차단
4. 비밀번호를 `bcryptjs`로 salt/hash
5. 새 UUID 사용자 ID 생성
6. 이메일 인증용 `verification_token` 생성
7. `users` 테이블에 insert
8. Resend로 인증 메일 발송

저장 필드:

- `id`
- `email`
- `password_hash`
- `name`
- `provider: "credentials"`
- `verification_token`
- `email_verified_at: null`

### 4.2 이메일 인증

이메일 링크는 `/api/auth/verify?token=...`를 호출한다.

`src/app/api/auth/verify/route.ts` 동작:

1. 쿼리에서 `token` 읽기
2. `users.verification_token = token`으로 사용자 조회
3. 사용자가 없으면 `/auth/signin?error=InvalidToken`으로 리다이렉트
4. 이미 `email_verified_at`이 있으면 `/auth/signin?message=AlreadyVerified`
5. 아니면 `email_verified_at`을 현재 시각으로 업데이트하고 `verification_token`을 null 처리
6. `/auth/signin?message=Verified`로 리다이렉트

### 4.3 자체 로그인 authorize

`CredentialsProvider.authorize`가 실제 검증을 수행한다.

검증 순서:

1. email/password 존재 확인
2. `users` 테이블에서 `id, email, password_hash, name, provider, email_verified_at` 조회
3. 사용자가 없으면 실패
4. `provider === "google"`이면 자체 로그인 차단
5. `email_verified_at`이 없으면 이메일 인증 미완료로 차단
6. `password_hash` 없으면 차단
7. `bcrypt.compare`로 비밀번호 검증
8. 성공 시 `{ id, email, name }` 반환

즉, 자체 로그인은 "이메일 인증 완료된 credentials 계정"만 허용한다.

## 5. 공통 인증/인가 흐름

### 5.1 라우트 보호

`src/middleware.ts`는 다음 경로를 보호한다.

- `/dashboard`
- `/todo`
- `/upload`

동작:

- 비로그인 사용자가 보호 경로 접근 시 `/`로 리다이렉트
- 로그인 사용자가 `/` 접근 시 `?landing=1`이 없으면 `/dashboard`로 리다이렉트

즉, 공개 랜딩은 `/`, 실사용 영역은 `/dashboard`, `/upload`, `/todo`다.

### 5.2 서버 API 인증 방식

여러 API가 공통적으로 `getServerSession()` 후 `session.user.id`를 검사한다.

대표 예:

- `/api/usage`
- `/api/plans`
- `/api/todo/[id]`
- `/api/consent`
- `/api/payment/verify`
- `/api/parse/upload-url`
- `/api/parse`

### 5.3 추가 게이트

`/api/parse`와 `/api/parse/upload-url`은 로그인 외에 `user_consents` 기반 약관 동의도 요구한다.

즉, 주요 문서 처리 흐름은 다음 순서다.

1. 로그인 확인
2. 약관 동의 확인
3. 사용량/플랜 확인
4. 실제 기능 수행

## 6. 사용자/구독 데이터 모델

`supabase/schema.sql` 기준 핵심 테이블:

### 6.1 `users`

역할이 섞여 있다.

- 인증 계정 저장
- 프로필 저장
- 월간 사용량(`balance`) 저장

주요 컬럼:

- `id`
- `email`
- `password_hash`
- `name`
- `image`
- `provider`
- `balance`
- `last_refill_at`

실제 코드상 추가로 사용되는 컬럼:

- `email_verified_at`
- `verification_token`

이 두 컬럼은 마이그레이션(`20260322_add_email_verification_columns.sql`)에서 추가된다.

### 6.2 `subscriptions`

Pro 판정 소스다.

주요 컬럼:

- `user_id`
- `status`
- `current_period_end`

`src/lib/subscription.ts`의 `getTier(userId)`는 다음 조건일 때만 `pro`를 반환한다.

- row 존재
- `status === "active"`
- `current_period_end`가 현재 시각 이후

아니면 모두 `free`다.

## 7. 결제 로직 개요

핵심 파일:

- `src/hooks/usePayment.ts`
- `src/app/plan/page.tsx`
- `src/app/api/payment/verify/route.ts`
- `src/lib/subscription.ts`
- `src/lib/usage.ts`
- `src/app/layout.tsx`

외부 연동:

- 브라우저 SDK: PortOne/Iamport (`https://cdn.iamport.kr/v1/iamport.js`)
- 서버 REST 검증: `https://api.iamport.kr`

요금제 반영 방식:

- Pro 여부는 `usage.limit === null`로 UI에서 판별
- `usage.limit === null`이 되려면 `getTier()`가 `pro`를 반환해야 함
- 결국 `subscriptions` 테이블이 결제 결과의 단일 소스 역할을 함

## 8. 결제 상세 흐름

### 8.1 플랜 페이지

`src/app/plan/page.tsx`는 로그인 후 `/api/usage`를 호출해 현재 사용량과 플랜을 읽는다.

- `usage.limit !== null`이면 Free
- `usage.limit === null`이면 Pro

업그레이드 버튼은 Free 사용자에게만 활성화된다.

### 8.2 클라이언트 결제 요청

`src/hooks/usePayment.ts`의 `requestPayment()`가 PortOne SDK 호출을 담당한다.

처리 순서:

1. `window.IMP` 존재 확인
2. `NEXT_PUBLIC_PORTONE_IMP_UID`로 `IMP.init()`
3. `merchant_uid = "mid_" + Date.now()` 생성
4. PG 값을 `"kakaopay"`로 고정
5. `customer_uid`를 `merchant_uid` 기반으로 생성
6. `IMP.request_pay(...)` 호출
7. 성공 시 `rsp` 전체를 resolve
8. 실패 시 alert 후 null resolve

결제 파라미터 특징:

- `amount = 2900`
- `pay_method = "card"`
- `name = "ToDit Pro 1개월 구독"` 기본값
- `buyer_email`, `buyer_name`은 세션 사용자 정보 사용

중요한 점:

- 코드 주석은 "정기 구독(빌링키 발급)"을 언급하지만, 실제 후속 빌링키 저장/재청구 로직은 없다.
- `customer_uid`가 사용자 고정값이 아니라 매 요청마다 바뀌는 값이다.

즉, 현재 구조는 "안정적인 정기결제 식별자"를 만들고 있지 않다.

### 8.3 서버 결제 검증

클라이언트 결제 성공 후 `src/app/plan/page.tsx`는 `/api/payment/verify`에 다음 값만 전달한다.

- `imp_uid`
- `merchant_uid`

서버(`src/app/api/payment/verify/route.ts`) 처리 순서:

1. 세션 확인
2. body에서 `imp_uid`, `merchant_uid` 읽기
3. `imp_uid` 없으면 400
4. PortOne `/users/getToken`으로 access token 발급
5. PortOne `/payments/{imp_uid}`로 결제 상세 조회
6. 결제 금액이 `2900`인지 확인
7. 결제 상태가 `"paid"`인지 확인
8. `activateSubscription(session.user.id)` 호출
9. 성공 시 `success: true`

### 8.4 내부 구독 활성화

`src/lib/subscription.ts`의 `activateSubscription(userId)`는 다음 동작을 한다.

1. 현재 시각 계산
2. `nextMonth`를 "현재 날짜의 다음 달 같은 일자"로 계산
3. `subscriptions` 테이블에 upsert

저장 값:

- `user_id`
- `status: "active"`
- `current_period_end: nextMonth`
- `updated_at`

즉, 결제 성공 후 내부적으로는 "해당 사용자에게 한 달짜리 Pro 만료 시각을 부여"하는 구조다.

## 9. 결제와 사용량/플랜 연동

`src/lib/usage.ts`는 사용량 반환 시 먼저 `getTier()`를 호출한다.

- `pro`면 `limit = null`
- `free`면 `limit = 20`

따라서 결제 성공 후 `subscriptions.status = active`와 미래 `current_period_end`만 맞으면 UI 전체가 Pro로 바뀐다.

영향 받는 영역:

- `/plan`의 현재 플랜 표시
- `/dashboard`의 업그레이드 CTA/광고 노출
- `/upload`의 PDF 허용 여부
- `/upload`의 Pro 옵션 활성화
- `/api/parse`의 모델/옵션/제한 처리

## 10. 현재 구현상 관찰사항

### 10.1 로그인 로직 측면

장점:

- OAuth와 자체 로그인 모두 `users` 테이블로 수렴한다.
- `session.user.id`를 내부 사용자 PK로 통일하려는 의도가 명확하다.
- 자체 로그인은 이메일 인증을 강제한다.
- Google 계정 이메일과 자체 로그인 이메일 충돌을 어느 정도 방지한다.

주의점:

- 일부 비로그인 화면은 `/auth/signin`이 아니라 바로 Google 로그인으로 보낸다. 따라서 "로그인 UI는 둘 다 제공"하지만 "유입 경로는 Google 편향" 상태다.
- `NextAuth`의 `error` 페이지도 `/auth/signin`으로 돌리므로, 커스텀 오류 메시지 처리는 해당 페이지 쿼리 파라미터에 의존한다.
- 인증/사용량/프로필 정보가 `users` 테이블에 섞여 있어 책임 분리가 약하다.

### 10.2 결제 로직 측면

현재 코드가 실제로 하는 일:

- 결제 완료 단건 조회
- 금액 검증
- 상태 검증
- 내부 구독 만료일 1개월 갱신

현재 코드에 없는 것:

- 결제 이력 저장 테이블
- `merchant_uid`와 사용자/order 매핑 저장
- 웹훅 기반 비동기 상태 동기화
- 정기결제 재청구 스케줄링
- 결제 취소/환불/해지 API
- 빌링키 저장 및 재사용

즉, 명칭은 "구독"에 가깝지만 구현은 "결제 성공 시 한 달짜리 Pro 플래그 부여"에 더 가깝다.

### 10.3 명시적인 구현 공백

`src/app/plan/page.tsx`에는 Pro 사용자가 Free로 전환할 때 `/api/test/toggle-pro`를 호출하는 분기가 있다. 하지만 현재 코드베이스에는 해당 API 파일이 존재하지 않는다.

해석:

- 테스트용 다운그레이드 UI 흔적이 남아 있음
- 실제 운영 가능한 해지/플랜 변경 로직은 아직 구현되지 않음

## 11. 로그인 흐름 요약

### 11.1 Google OAuth

1. 클라이언트에서 `signIn("google")`
2. NextAuth Google 인증 완료
3. `signIn` callback에서 `users` 테이블 동기화
4. `jwt` callback에서 DB 사용자 ID를 `token.sub`로 고정
5. `session` callback에서 `session.user.id` 제공
6. 보호 페이지/API가 `session.user.id` 기반으로 동작

### 11.2 자체 로그인

1. `/auth/signup`에서 회원가입 요청
2. `users` 테이블에 `provider=credentials`, `password_hash`, `verification_token` 저장
3. 이메일 인증 링크 발송
4. `/api/auth/verify`에서 `email_verified_at` 갱신
5. `/auth/signin`에서 `signIn("credentials")`
6. `authorize`가 비밀번호/이메일 인증 상태 검증
7. 이후 세션 구조는 OAuth와 동일하게 사용

## 12. 결제 흐름 요약

1. `/plan`에서 업그레이드 클릭
2. `usePayment()`가 PortOne SDK로 결제 요청
3. 성공 시 `imp_uid`를 서버로 전달
4. 서버가 PortOne REST API로 결제 단건 재검증
5. 금액과 상태가 맞으면 `subscriptions`를 `active`로 upsert
6. 이후 `/api/usage`와 `getTier()`가 Pro 상태를 반영

## 13. 결론

현재 ToDit는 인증 측면에서는 "Google OAuth + 이메일/비밀번호 로그인"을 모두 지원하고 있으며, 두 방식을 하나의 내부 사용자 ID 체계로 통합하려는 설계가 잘 보인다.

반면 결제는 아직 "정식 구독 결제 시스템"보다는 "결제 성공 확인 후 Pro 기간을 부여하는 1차 구현"에 가깝다. 특히 정기결제 지속 관리, 해지, 웹훅 동기화, 결제 이력 보존이 빠져 있으므로 운영 관점에서는 후속 보강이 필요한 상태다.

