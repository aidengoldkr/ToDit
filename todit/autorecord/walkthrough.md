# ToDit 코드 리뷰 & 보안 패치 워크스루

## 수행한 작업

### 1. 전체 코드 리뷰
48개의 전체 소스 파일을 분석하여 아래 항목별 로직을 문서화했습니다:
- 인증 & 세션 관리 (NextAuth + Google)
- 데이터 접근 계층 (Supabase Admin Client, RLS 우회 리스크)
- OpenAI 연동 엔진 (프롬프트 구조, 카테고리 검증)
- 사용량 제한 & 구독 관리
- 프론트엔드 상태 관리 (세션 스토리지)

### 2. 보안 취약점 식별
| 심각도 | 취약점 | 파일 |
|--------|--------|------|
| 치명적 | 보호되지 않은 구독 전환 라우트 | `api/test/toggle-pro` |
| 높음 | RLS 우회 (Admin Key 남용) | [supabase/admin.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/admin.ts) |
| 중간 | 스토리지 경로 주입 | [supabase/storage.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/storage.ts) |
| 중간 | API 입력 검증 부재 | `api/parse`, `api/todo/[id]`, `api/plans` |

### 3. 보안 패치 적용

#### 신규 파일
| 파일 | 설명 |
|------|------|
| [validators.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/validators.ts) | Zod 스키마 (Parse, Todo ID, Pagination, 경로 검증) |
| [client.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/client.ts) | RLS 준수 표준 Supabase 클라이언트 |
| [security_fix_rls.sql](file:///c:/project/Insight_Paser/ToDit/todit/supabase/migrations/security_fix_rls.sql) | RLS 정책 마이그레이션 SQL |

#### 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| [api/parse/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/parse/route.ts) | Zod 스키마 검증 + 스토리지 경로 소유권 검증 |
| [api/todo/[id]/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/todo/%5Bid%5D/route.ts) | UUID 형식 검증 |
| [api/plans/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/plans/route.ts) | Zod 페이지네이션 파라미터 검증 |
| [supabase/storage.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/storage.ts) | 경로 sanitization |
| [supabase/admin.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/admin.ts) | 보안 경고 주석 |
| [upload/page.tsx](file:///c:/project/Insight_Paser/ToDit/todit/src/app/upload/page.tsx) | toggle-pro 참조 제거 |

#### 삭제된 파일
| 파일 | 사유 |
|------|------|
| [api/test/toggle-pro/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/test/toggle-pro/route.ts) | 결제 우회 가능한 치명적 취약점 |

### 4. 대시보드 UI 개선
- 카테고리 태그를 제목 왼쪽으로 이동하여 가독성 향상

## 검증 결과
- **TypeScript 빌드**: ✅ `npx tsc --noEmit` 오류 없이 통과
- **toggle-pro 참조**: ✅ 소스 코드에서 완전히 제거됨

## 배포 전 필요 사항

> [!IMPORTANT]
> [security_fix_rls.sql](file:///c:/project/Insight_Paser/ToDit/todit/supabase/migrations/security_fix_rls.sql)을 Supabase SQL Editor에서 실행하여 RLS 정책을 활성화해야 합니다.
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` 환경 변수를 설정해야 [client.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/supabase/client.ts)가 동작합니다.
