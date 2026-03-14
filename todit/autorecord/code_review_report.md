# ToDit 코드 리뷰 & 보안 감사 보고서

## 1. 개요
ToDit는 문서를 AI로 분석하여 실행 가능한 To-Do 리스트로 분해하는 Next.js 애플리케이션입니다. NextAuth(Google) 인증, Supabase 백엔드를 사용합니다.

## 2. 로직 분석 (컴포넌트별)

### 인증 & 권한 관리
- **구현**: NextAuth + Google Provider. JWT 기반 세션.
- **미들웨어**: [src/middleware.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/middleware.ts)에서 `/dashboard`, `/todo`, `/upload` 경로를 보호.
- **분석**: 세션의 [id](file:///c:/project/Insight_Paser/ToDit/todit/src/middleware.ts#7-30)는 JWT `sub`에서 정상적으로 매핑됨. 로그인 상태가 아닌 사용자는 랜딩 페이지(`/`)로 리다이렉트됨.

### 데이터 접근 계층 (Supabase)
- **관리자 클라이언트**: [src/lib/supabase/admin.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/admin.ts)에서 `SUPABASE_SERVICE_ROLE_KEY` 사용.
- **위험**: 이 키는 RLS(Row Level Security)를 우회함. 모든 API 라우트에서 수동으로 소유권 검증(`data.user_id !== session.user.id`)을 해야 함. 하나라도 누락되면 타 사용자 데이터 접근 가능(BOLA 취약점).
- **권장**: 사용자 작업에는 RLS를 준수하는 표준 클라이언트를 사용하고, 관리자 클라이언트는 관리 작업에만 사용.

### 핵심 엔진 (OpenAI 연동)
- **파일**: [src/lib/openai.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/openai.ts)
- **로직**: 구조화된 프롬프트로 "요약"이 아닌 "분해"를 강제함. Temperature: 0.2.
- **세부 로직**: 시스템 프롬프트에 동적 날짜(`today`, `currentYear`)를 사용하여 문서에 연도가 누락된 경우 올바른 연도를 추론.

### 프론트엔드 상태 (세션 스토리지)
- **파일**: [src/lib/action-plan-session.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/action-plan-session.ts)
- **로직**: `sessionStorage`에 마지막 결과를 저장하여 페이지 새로고침 시 데이터 손실 방지.
- **세부 로직**: `userId` 검증 포함. 로그아웃 후 다른 사용자가 로그인하면 이전 결과가 무시됨.

### 사용량 & 요금제 제한
- **파일**: [src/lib/usage.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/usage.ts), [src/app/api/usage/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/usage/route.ts)
- **로직**: [getOrResetUsage](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/usage.ts#12-89)에서 월별 초기화 로직 수행. `FREE_MONTHLY_LIMIT` = 20.
- **세부 로직**: `api/parse`에서 사용량 증가가 DB 저장보다 먼저 실행됨. DB 저장 실패 시에도 사용량은 소모됨. (영향도 낮지만 기록)

### 파일 업로드 (서명된 URL)
- **파일**: [api/parse/upload-url/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/parse/upload-url/route.ts)
- **로직**: 클라이언트 측 업로드를 위해 Supabase Storage에 임시 서명된 URL 생성.
- **분석**: 사용자 ID 기반 경로 접두사(`${userId}/...`) 사용으로 격리 구현됨. 양호.

## 3. 보안 취약점

### [치명적] 보호되지 않은 테스트 라우트 (`/api/test/toggle-pro`)
인증된 사용자라면 누구나 자신의 구독 상태를 `active`(Pro)로 전환할 수 있는 라우트가 존재함.
- **영향**: 결제 없이 Pro 기능 사용 가능. 직접적인 재정적 손실.
- **조치**: 즉시 삭제하거나 `process.env.NODE_ENV === 'development'` 가드 추가.

### [높음] RLS 우회 / 관리자 키 남용
애플리케이션이 거의 모든 DB 작업에 `SERVICE_ROLE_KEY`를 사용함.
- **영향**: 어떤 API 라우트에서든 소유권 검증이 누락되면 타 사용자 데이터 유출.
- **조치**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용하는 표준 클라이언트를 구현하고 DB에 RLS를 활성화.

### [중간] 스토리지 경로 주입
[downloadFromParseTemp](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/storage.ts#5-23)와 [deleteFromParseTemp](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/storage.ts#24-36)가 문자열 경로를 직접 받음. 사용자 입력에 의해 경로가 조작되면 버킷 내 비인가 파일 접근/삭제 가능.
- **조치**: 경로를 검증하여 사용자가 자신의 임시 파일만 접근할 수 있도록 제한.

### [중간] API 파라미터 검증 부재
`/api/plans`, `/api/todo/[id]` 등의 라우트에서 입력 타입을 엄격하게 검증하지 않음 (예: [id](file:///c:/project/Insight_Paser/ToDit/todit/src/middleware.ts#7-30)가 UUID인지 확인하지 않음).
- **조치**: Zod 등의 스키마 검증 추가.

### [낮음] 데이터 노출
`api/plans`가 전체 JSON 객체를 반환함. 프론트엔드에 불필요한 민감 메타데이터가 노출되지 않는지 확인 필요.

## 4. 제안된 보안 패치
1. RLS 활성화된 Supabase 클라이언트 구현
2. API 요청 검증을 위한 Zod 스키마 추가
3. 권한 검증 중앙화
4. 테스트 라우트 삭제
5. 스토리지 경로 검증 강화
