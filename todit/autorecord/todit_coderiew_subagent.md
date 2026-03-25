# ToDit 전체 코드리뷰 (결제 로직 삭제 후 재검토)

작성일: 2026-03-24  
대상 저장소: `c:\project\Insight_Paser\ToDit\todit`

리뷰 참여:

- Aiden: 코드리뷰 총괄
- Nahida: 로그인, 보안, 정책 정합성
- Ineffa: 백엔드, DB 연동, 마이그레이션
- Inno: 프론트엔드 UX/상태
- Jin: ToDo 생성, OCR, OpenAI, parse 파이프라인
- Navia: 기타 로직, 동의/정책/잔여 플로우

검토 방식:

- 역할별 서브 에이전트 병렬 리뷰
- 메인 에이전트 교차 검증
- `cmd /c npm run build` 실행

빌드 상태:

- `next build`는 현재 완료됨
- 다만 `src/app/api/auth/verify/route.ts` 때문에 build 로그에 `Dynamic server usage` 예외가 계속 남음

## 핵심 결론

결제 코드 자체는 제거됐지만, 제품/정책/UI/환경변수에는 결제 시스템이 살아 있는 것처럼 보이는 흔적이 많이 남아 있습니다. 동시에 이전부터 있던 parse, quota, consent, schema 정합성 문제는 그대로 유지되고 있어 현재 우선순위는 "결제 잔여 흔적 제거"보다 "고비용 서버 경계와 데이터 일관성 정리"가 더 높습니다.

## Findings

### P1. Pro 전용 PDF/대량 이미지 제한이 UI에만 있고 서버에서 강제되지 않음

무료 사용자가 `/api/parse/upload-url`과 `/api/parse`를 직접 호출하면 PDF와 5장 초과 이미지를 그대로 처리할 수 있습니다. 현재 제한은 업로드 화면에서만 막고 있어, 스크립트 요청으로 Pro 수준 OCR/parse 자원을 무료로 소비할 수 있습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\upload-url\route.ts:37`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\upload-url\route.ts:42`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:64`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:85`
- `c:\project\Insight_Paser\ToDit\todit\src\app\upload\page.tsx:147`

간단한 해결책:

- `upload-url`와 `parse` 양쪽에서 `getTier()`와 `getImageLimit()`를 다시 체크해 free 사용자의 PDF 요청과 초과 이미지 요청을 서버에서 즉시 403/402로 차단
- 클라이언트 제한은 UX 보조로만 두고, 실제 정책은 서버에서 강제

### P1. `/api/parse`가 저장 성공 전에 사용량을 차감하고, 차감 결과도 무시함

현재 parse 성공 후 먼저 `incrementUsage()`를 호출하고 그 다음 `saved_todo`에 저장합니다. 저장이 실패하면 사용자는 결과를 못 받는데 월간 사용량은 이미 줄어들 수 있습니다. 게다가 차감 함수 반환값도 무시하므로 실패를 감지하지 못합니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:180`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:184`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:205`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\usage.ts:91`
- `c:\project\Insight_Paser\ToDit\todit\src\app\upload\page.tsx:287`

간단한 해결책:

- 최소 수정: 저장 성공 후에만 사용량 차감
- 더 안전한 수정: Supabase RPC 또는 단일 서버 트랜잭션으로 `quota reserve -> save -> commit`을 원자적으로 처리
- 저장 실패 시 `id` 없는 성공 응답을 내지 말고 명시적으로 실패 처리

### P1. 무료 사용량 제한이 경쟁 상태에 취약해 동시 요청으로 월간 한도를 넘길 수 있음

사전 한도 체크와 실제 차감이 분리되어 있고, `incrementUsage()`도 read-then-update 구조입니다. 동시 parse 요청이 들어오면 모두 사전 체크를 통과한 뒤 생성과 저장을 계속 진행할 수 있습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:71`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:73`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:184`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\usage.ts:105`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\usage.ts:121`

간단한 해결책:

- `balance < FREE_MONTHLY_LIMIT` 조건이 포함된 단일 SQL update/RPC로 quota reservation 먼저 확보
- reservation 실패 시 OpenAI/OCR 호출 전에 즉시 중단

### P1. `NEXTAUTH_SECRET` 누락 시 `/api/parse`가 fail-open으로 공개 엔드포인트가 됨

인증과 동의 검사가 `if (process.env.NEXTAUTH_SECRET)` 블록 안에만 있습니다. 배포 환경이 잘못 설정되면 가장 비용이 큰 OCR/OpenAI 경로가 로그인 없이 열립니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:27`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:28`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:36`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:64`

간단한 해결책:

- env 존재 여부와 무관하게 항상 `getServerSession()` 검사
- auth 설정이 깨진 경우에는 익명 허용이 아니라 `503`으로 fail-closed

### P1. 결제 제거 후에도 구독/자동갱신/해지 플로우가 제품 전반에 그대로 노출됨

결제 코드는 빠졌지만 랜딩, `/plan`, `/refund`, `/dashboard`, `/upload`는 여전히 월 정기결제, 자동 갱신, 해지 가능, Pro 업그레이드를 실제 제공하는 것처럼 안내합니다. 실제 업그레이드는 "준비 중" alert뿐이고, Pro 사용자는 존재하지 않는 `/api/test/toggle-pro`를 호출합니다. 현재 제품 계약과 실제 동작이 맞지 않습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\page.tsx:26`
- `c:\project\Insight_Paser\ToDit\todit\src\app\page.tsx:54`
- `c:\project\Insight_Paser\ToDit\todit\src\app\plan\page.tsx:49`
- `c:\project\Insight_Paser\ToDit\todit\src\app\plan\page.tsx:56`
- `c:\project\Insight_Paser\ToDit\todit\src\app\plan\page.tsx:159`
- `c:\project\Insight_Paser\ToDit\todit\src\app\refund\page.tsx:12`
- `c:\project\Insight_Paser\ToDit\todit\src\app\refund\page.tsx:30`
- `c:\project\Insight_Paser\ToDit\todit\src\app\dashboard\page.tsx:166`
- `c:\project\Insight_Paser\ToDit\todit\src\app\upload\page.tsx:641`

간단한 해결책:

- 단기: 구독/환불/해지/자동갱신 카피와 CTA를 전부 제거하거나 “출시 예정”으로 통일
- `/plan`은 결제 페이지가 아니라 waitlist 또는 announcement 페이지로 축소
- `/api/test/toggle-pro` 호출 제거

### P2. 동의(consent) 로직이 DB 장애 시 fail-open으로 동작함

`createAdminClient()`를 만들지 못하면 `getTermsAgreed()`는 `true`, `setTermsAgreed()`는 조용히 return 합니다. 즉 동의 저장소가 죽으면 오히려 동의 게이트가 사라집니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\lib\consent.ts:6`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\consent.ts:18`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\route.ts:36`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\parse\upload-url\route.ts:16`

간단한 해결책:

- admin client 생성 실패 시 `false` 또는 예외 반환
- 동의 관련 API는 503/500을 명시적으로 응답하도록 변경

### P2. 회원가입 후 인증 메일 발송 실패를 삼켜서 죽은 계정이 남음

계정은 먼저 insert되고, 인증 메일 발송 실패는 로그만 남기고 성공 처리됩니다. 이후 `email_verified_at`이 없으면 credentials 로그인은 막히므로, 같은 이메일이 로그인도 재가입도 안 되는 상태에 빠질 수 있습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts:53`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts:79`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\auth-options.ts:46`

간단한 해결책:

- 메일 발송 실패 시 insert 롤백
- 또는 `pending_verification` 상태와 재발송 엔드포인트 추가

### P2. 이메일 인증 토큰에 만료가 없어 유출 시 무기한 사용 가능함

현재 저장되는 것은 `verification_token`뿐이며, 검증 시에도 단순 token equality만 봅니다. 만료 시점이나 재발급 정책이 없어 토큰이 오래 살아 있습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts:62`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\verify\route.ts:21`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\verify\route.ts:38`

간단한 해결책:

- `verification_expires_at` 추가
- 만료 토큰 거절
- 재발송 시 토큰 rotate

### P2. `PATCH /api/todo/[id]`가 임의의 `plan` JSON을 검증 없이 저장함

현재는 `plan` 존재 여부만 보고 그대로 DB에 저장합니다. 대시보드와 todo 상세는 `plan.title`, `plan.category`, `plan.actions`가 정상 구조라고 가정하고 렌더링하므로, 한번 깨진 JSON이 들어가면 목록/상세/재편집이 같이 흔들립니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\api\todo\[id]\route.ts:103`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\todo\[id]\route.ts:111`
- `c:\project\Insight_Paser\ToDit\todit\src\app\dashboard\page.tsx:237`
- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:292`

간단한 해결책:

- OpenAI 응답 검증에 쓰는 동일한 ActionPlan schema를 PATCH 입력에도 적용
- malformed payload는 400으로 거절

### P2. 최근 결과 복구 CTA가 끊겨 있음

업로드 페이지는 session cache가 있으면 `/todo`로 보내지만, todo 페이지는 `id`가 없으면 바로 `/dashboard`로 리다이렉트합니다. 사용자가 기대하는 “방금 결과 다시 보기” 경로가 실질적으로 죽어 있습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\upload\page.tsx:58`
- `c:\project\Insight_Paser\ToDit\todit\src\app\upload\page.tsx:555`
- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:35`
- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:37`

간단한 해결책:

- `id`가 없을 때 `readStoredActionPlan()` fallback 복구
- 아니면 해당 CTA를 삭제하고 persisted history만 노출

### P2. Todo 낙관적 업데이트가 실패 시 `sessionStorage`를 롤백하지 않음

`toggleAction()`은 서버 응답 확인 전 React state와 `sessionStorage`를 먼저 갱신합니다. PATCH 실패 후에도 캐시에 성공한 것처럼 남아 서버 상태와 UI 상태가 엇갈릴 수 있습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:75`
- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:86`
- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:91`
- `c:\project\Insight_Paser\ToDit\todit\src\app\todo\page.tsx:155`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\action-plan-session.ts:28`

간단한 해결책:

- `res.ok` 확인 후에만 storage 반영
- 실패 시 React state와 storage를 같은 snapshot으로 롤백

### P2. `schema.sql`과 런타임 auth 스키마가 어긋나 fresh setup 시 깨질 수 있음

`schema.sql`의 `users` 정의에는 `email_verified_at`, `verification_token`이 없지만, 실제 런타임은 이를 사용합니다. 마이그레이션을 모두 적용하면 맞아질 수 있지만, bootstrap source로 `schema.sql`만 쓰면 credentials 가입/검증이 깨집니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\supabase\schema.sql:4`
- `c:\project\Insight_Paser\ToDit\todit\supabase\migrations\20260322_add_email_verification_columns.sql:3`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\signup\route.ts:56`
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\verify\route.ts:21`
- `c:\project\Insight_Paser\ToDit\todit\src\lib\auth-options.ts:32`

간단한 해결책:

- `schema.sql`을 실제 운영 스키마와 동기화
- 또는 “schema.sql은 참고용, migrations만 사용”으로 문서화

### P2. `20260322_merge_user_usage.sql`은 여전히 파괴적인 마이그레이션임

이 스크립트는 시작하자마자 `public.users`를 drop하고 `user_usage`를 rename합니다. 기존 사용자 계정이 들어 있는 DB에서는 치명적이며, fresh DB에서도 전제 테이블이 없으면 실패합니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\supabase\migrations\20260322_merge_user_usage.sql:2`
- `c:\project\Insight_Paser\ToDit\todit\supabase\migrations\20260322_merge_user_usage.sql:5`

간단한 해결책:

- additive migration으로 재작성
- 기존 테이블 drop은 별도 수동 단계로 분리

### P2. `/api/auth/verify`는 빌드는 통과하지만 build 로그에 계속 dynamic-server 예외를 남김

현재는 빌드가 완료되지만, `req.url` 사용 때문에 `Dynamic server usage` 로그가 남습니다. 당장 차단은 아니어도 추후 Next.js 업그레이드나 빌드 정책 변경 시 다시 깨질 가능성이 있습니다.

근거:

- 빌드 실행 로그
- `c:\project\Insight_Paser\ToDit\todit\src\app\api\auth\verify\route.ts:6`

간단한 해결책:

- `export const dynamic = "force-dynamic";` 명시
- 또는 redirect URL 생성을 build-time static analysis와 덜 충돌하는 형태로 정리

### P2. 약관이 여전히 Google OAuth만 가입 경로라고 설명함

실제 앱은 credentials 가입과 이메일 인증을 제공하지만, 약관은 Google OAuth만 전제합니다. 정책/동의 문구와 실제 제품 동작이 어긋납니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\terms\page.tsx:23`
- `c:\project\Insight_Paser\ToDit\todit\src\app\auth\signup\page.tsx:1`

간단한 해결책:

- 약관과 동의 모달을 현재 가입 방식과 정확히 동기화

### P2. 결제 제거 후에도 사용하지 않는 결제 관련 환경변수가 남아 있음

런타임 코드에서는 더 이상 결제 처리를 하지 않지만, 로컬 설정에는 결제 관련 env가 남아 있습니다. 현재 가치 없이 비밀 회전/노출 관리 부담만 남기는 상태입니다.

근거:

- `.env.local` 내 결제 관련 변수 존재 확인

간단한 해결책:

- 사용하지 않는 결제 env 제거
- 이미 발급한 키는 회전

### P3. `Providers`가 hydration 후 모든 페이지의 제목을 같은 값으로 덮어씀

App Router metadata를 써도 `src/app/providers.tsx`가 `document.title`을 강제로 바꾸기 때문에 페이지별 title이 죽습니다.

근거:

- `c:\project\Insight_Paser\ToDit\todit\src\app\providers.tsx:9`
- `c:\project\Insight_Paser\ToDit\todit\src\app\providers.tsx:10`

간단한 해결책:

- client-side title override 제거
- route metadata에 제목 관리 위임

## 우선 수정 순서

1. `/api/parse`의 서버 측 티어 검증, auth fail-closed, quota reservation 구조 먼저 수정
2. consent fail-open 제거
3. 저장 전 사용량 차감 구조를 원자적으로 정리
4. 결제 제거 후 남은 Pro/구독/환불/해지 문구와 dead path 정리
5. todo PATCH schema 검증 추가
6. signup 메일 실패/토큰 만료 처리 보강
7. `schema.sql`과 마이그레이션 정합성 정리
8. `/api/auth/verify` dynamic 설정과 title override 정리

## Residual Risks / Testing Gaps

- 자동화 테스트가 없어 auth, parse, todo edit, consent, policy alignment 회귀를 막지 못함
- 외부 연동(OpenAI, Google Vision, Resend)은 정적 코드 기준으로만 검토
- 현재 저장소에는 결제 제거 이후 제품 설명을 한 번에 검증하는 smoke test가 없음

