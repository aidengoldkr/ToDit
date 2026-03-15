# ToDit 보안 아키텍처 개선 보고서 (Admin Client 남용 해결)

**작업 일시**: 2026-03-15
**작업자**: Antigravity AI
**목표**: `service_role` (Admin Client)의 무분별한 사용을 줄이고, DB 수준의 **Row Level Security (RLS)**를 강제하여 보안성 향상.

---

## 1. 주요 변경 사항

### 🛡️ DB: NextAuth 연동 RLS 정책 구축
*   **파일**: `supabase/migrations/20260315_secure_auth_rls.sql`
*   **내용**:
    *   `auth.get_app_user_id()` 함수 생성: HTTP 헤더 `x-todit-user-id`에서 사용자 ID를 추출하도록 설계.
    *   `saved_todo`, `user_usage`, `user_consents` 테이블에 대해 RLS 활성화.
    *   소유권 확인 정책(`USING (user_id = auth.get_app_user_id())`) 적용.

### 🛡️ API: Authenticated Client 도입
*   **파일**: `src/lib/supabase/authenticated.ts`
*   **내용**:
    *   `anon` 키를 기반으로 하되, 모든 요청에 `x-todit-user-id` 헤더를 자동으로 포함하는 전용 클라이언트 생성 기기 구현.
    *   이제 서버 측에서도 "마스터 키"가 아닌 "유저의 키"로 DB에 안전하게 접근 가능.

### 🛡️ API: 라우트 리팩토링 (POC)
*   **파일**: `src/app/api/todo/[id]/route.ts`
*   **내용**:
    *   기존 `createAdminClient` 호출부를 `getAuthenticatedClient(session.user.id)`로 전면 교체.
    *   개발자가 실수로 필터링 조건을 누락하더라도, 데이터베이스 엔진 수준에서 타 사용자의 데이터 접근을 원천 차단.

---

## 2. 보안 기대 효과
| 항목 | 기존 (수동 검증) | 개선 (RLS 강제) |
| :--- | :--- | :--- |
| **데이터 격리** | 개발자의 `.eq('user_id', ...)` 작성에 의존 | DB 수준에서 자동 격리 |
| **실수 방지** | 코드 누락 시 전체 데이터 유출 위험 | 코드 누락 시 빈 데이터(Error) 반환 |
| **관리 권한** | 모든 API가 마스터 권한 소지 | 유저 권한 범위 내로 권한 축소 |

---

## 3. 향후 권장 사항
- **전수 리팩토링**: `api/usage`, `api/history` 등 남은 API 라우트들도 순차적으로 `Authenticated Client` 체제로 전환할 것을 권장합니다.
- **SQL 실행**: 생성된 마이그레이션 SQL(`20260315_secure_auth_rls.sql`)을 Supabase SQL Editor에서 반드시 실행해야 정책이 활성화됩니다.
- **Middleware 활용**: NextAuth 세션 확인 로직을 미들웨어로 통합하여 API 코드의 중복을 더욱 줄일 수 있습니다.
