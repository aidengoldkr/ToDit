# ToDit 프로젝트 전체 트러블슈팅 및 작업 로그 (종합편)

이 문서는 프로젝트 초기부터 현재까지 발생한 크고 작은 기술적 문제, 사용자 요구사항에 따른 변경, 그리고 이를 해결하기 위한 과정들을 상세히 기록한 종합 로그입니다.

---

## 1. 프론트엔드 및 디자인 (UI/UX)

### 1.1 폰트 시스템 적용 이슈
*   **문제**: 서비스 전반에 통일된 브랜드 아이덴티티가 부족함.
*   **해결**: 
    *   전역 폰트로 `AliceDigitalLearning`을 적용하여 학습 도구로서의 느낌을 강화함.
    *   ToDit 로고 전용 폰트로 `KblJump`를 적용하여 고유한 비주얼을 구축함.
*   **수정 파일**: `src/app/globals.css`, `src/app/layout.tsx`

### 1.2 대시보드 반응형 레이아웃 깨짐 현상
*   **문제**: 모바일 환경(특히 320px ~ 500px 너비)에서 대시보드의 특정 카드나 버튼이 넘치거나 겹치는 현상 발생.
*   **해결**: 메인 대시보드와 업로드 페이지의 CSS 미디어 쿼리를 수정하여 가변 폭 대응을 강화하고, 요소 간 간격(Padding/Margin)을 유동적으로 조절함.
*   **수정 파일**: `src/app/dashboard/page.module.css`, `src/app/upload/page.module.css`

### 1.3 To-Do 관리 기능 보완
*   **문제**: 생성된 To-Do를 수정할 수는 있지만, 개별적으로 삭제할 수 있는 기능이 없어 사용자 불편 초래.
*   **해결**: 수정 버튼 옆에 삭제 아이콘 버튼을 추가하고, 삭제 시 확인 팝업을 띄운 뒤 실제로 DB에서 제거하는 로직을 구현함.
*   **수정 파일**: `src/app/todo/page.tsx`

### 1.4 인위적인 로딩 지연 제거 (성능 개선)
*   **문제**: AI 분석이 완료되었음에도 불구하고, 로딩 애니메이션을 보여주기 위해 강제로 5~10초간 대기하는 로직이 존재하여 사용자 경험 저해.
*   **해결**: `handleSubmit` 함수 내의 `minLoadingTime` 및 `setTimeout` 관련 코드를 모두 제거하여 API 응답 즉시 결과 페이지로 넘어가도록 수정함.
*   **수정 파일**: `src/app/upload/page.tsx`

---

## 2. 백엔드 및 데이터베이스 (Database & API)

### 2.1 사용자 가입 시 이름(Name) 필드 누락
*   **문제**: 신규 사용자가 로그인 시 DB의 `users` 테이블에 이메일은 저장되지만, 계정 이름(`name`)이 누락되는 현상 발견.
*   **해결**: SQL 쿼리를 수정하여 `upsert` 시 세션에서 받아온 사용자 이름을 명시적으로 포함하도록 변경함.

### 2.2 보안 강화: Admin Client 남용 문제 해결
*   **문제**: 모든 API 요청에서 `service_role` 키를 사용하는 Admin Client를 사용하여 Row Level Security(RLS) 보안 정책이 무용지물인 상태였음.
*   **해결**:
    *   **RLS 활성화**: `saved_todo`, `user_usage` 등의 테이블에 RLS를 적용하고, 오직 본인의 데이터만 조회/수정 가능하도록 설정함.
    *   **인증 클라이언트 도입**: `getAuthenticatedClient` 함수를 만들어 `anon` 키와 함께 `x-todit-user-id` 헤더를 전송, DB 레벨에서 사용자 식별이 가능하게 함.
    *   **스키마 이슈**: 처음에 `auth` 스키마에 함수를 생성하려 했으나 권한 문제로 실패, `public` 스키마로 옮겨 `public.get_app_user_id()`를 구현하여 해결함.
*   **수정 파일**: `src/lib/supabase/authenticated.ts`, `supabase/migrations/20260315_secure_auth_rls.sql`, 각종 API 라우트.

### 2.3 API 라우트 리팩토링
*   **문제**: API 라우트마다 인증 체크와 에러 핸들링 로직이 중복되어 코드가 복잡함.
*   **해결**: 공통 인증 로직을 정리하고, Admin Client 대신Authenticated Client를 사용하도록 하여 보안과 코드 가독성을 동시에 개선함.

---

## 3. AI 및 OpenAI 연동 (OpenAI API)

### 3.1 `max_tokens` 파라미터 미지원 에러
*   **문제**: 최신 모델을 사용할 때 `400 Unsupported parameter: 'max_tokens'` 에러 발생.
*   **해결**: OpenAI의 새로운 표준 파라미터인 `max_completion_tokens`로 명칭을 변경함.

### 3.2 Reasoning 모델의 `temperature` 이슈
*   **문제**: GPT-5 mini와 같은 추론 모델 호출 시 `400 Unsupported value: 'temperature'` 에러 발생.
*   **해결**: 모델 ID에 `gpt-5` 또는 `o1` 계열이 포함될 경우 `temperature` 파라미터를 요청 객체에서 제외하도록 조건부 로직 추가.

### 3.3 Responses API 전환 및 다시 컴플리션으로 복귀
*   **문제**: GPT-5 전용인 Responses API를 도입하려 했으나, 파라이터명(`output_types` vs `output`)과 구조가 빈번하게 변하여 서비스가 불안정해짐.
*   **해결**: 다시 안정적인 **Chat Completions API**로 전환하되, 성능이 우수한 `gpt-4o` 모델을 Pro 전용으로 자동 할당하는 방식으로 선회함.

### 3.4 JSON 파싱 및 데이터 정제 로직 강화
*   **문제**: AI가 응답 시 JSON 외에 "물론입니다!" 같은 인사말이나 마크다운 코드 블록(```json)을 포함하여 파싱 에러(JSON.parse)가 빈번함.
*   **해결**:
    *   정규식을 사용하여 응답 텍스트 내의 마크다운 태그를 먼저 제거함.
    *   최종적으로 `{` 로 시작하고 `}` 로 끝나는 가장 긴 구간을 찾아내어 실제 JSON 객체만 추출하는 로직을 적용함.
*   **수정 파일**: `src/lib/openai.ts`

### 3.5 사용자 티어별 모델 자동 최적화
*   **문제**: 사용자가 직접 모델을 고르는 기능이 오히려 혼란을 주고 에러 가능성을 높임.
*   **해결**: UI에서 모델 선택 드롭다운을 제거하고, 서버 측에서 Pro 사용자에게는 `gpt-4o`, 일반 사용자에게는 `gpt-4o-mini`를 자동으로 할당하도록 로직 단순화.
*   **수정 파일**: `src/app/api/parse/route.ts`, `src/app/upload/page.tsx`

---

## 4. 인프라 및 배포 (Infra & Deployment)

### 4.1 사이트 오픈 그래프(OG) 로딩 실패
*   **문제**: `todit.app`으로 배포 후 카카오톡 등에서 링크 공유 시 미리보기 이미지가 안 뜨는 현상.
*   **해결**: `layout.tsx`의 메타데이터 설정을 보강하고, Next.js의 Metadata API 가이드에 맞춰 절대 경로 URL을 명시함.

### 4.2 구글 애드센스 적용
*   **문제**: 수익화를 위해 모든 페이지에 동일한 애드센스 스크립트 삽입 필요.
*   **해결**: Root Layout 파일의 `<head>` 영역에 비동기 방식의 AdSense 스크립트 태그를 전역으로 추가함.
*   **수정 파일**: `src/app/layout.tsx`

---

*본 로그는 프로젝트의 투명한 관리와 향후 유지보수를 위해 지속적으로 업데이트됩니다.*
*마지막 업데이트: 2026년 3월 15일*
