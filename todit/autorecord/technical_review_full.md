# ToDit Technical Deep-Dive: System Architecture & Implementation Review

본 문서는 **ToDit** 프로젝트의 시스템 아키텍처, 데이터 모듈화, AI 오케스트레이션 및 보안 설계에 대한 전문가용 기술 리뷰 보고서입니다. 본 프로젝트는 Next.js (App Router) 기반의 Full-stack 환경에서 비정형 데이터(OCR/Text)를 정형화된 Action Plan 데이터로 변환하는 파이프라인을 구축하고 있습니다.

---

## 1. System Architecture Overview

ToDit은 고도로 모듈화된 Serverless 아키텍처를 지향하며, 프론트엔드-API-AI 파이프라인이 유기적으로 연결되어 있습니다.

### 1.1 Tech Stack
- **Framework**: Next.js 14+ (App Router), TypeScript
- **Authentication**: NextAuth.js (Google OAuth 2.0)
- **Database / Storage**: Supabase (PostgreSQL / Storage / Auth Admin)
- **AI / ML**: 
  - **OpenAI**: GPT-4o, GPT-4o-mini (Reasoning & Decomposition)
  - **Google Cloud Vision API**: OCR (Text Detection)
- **Infrastructure**: Vercel (Deployment), Supabase Storage (Ephemeral file storage)

### 1.2 Data Flow Pipeline
1. **Client Tier**: 업로드 객체(Image/PDF)를 Supabase Storage의 `parse-temp` 버킷에 Signed URL을 통해 직접 업로드 (Server overhead 최소화).
2. **API Tier (`/api/parse`)**: 
   - 유저 세션 및 사용량(Usage Limit) 검증.
   - Storage 경로 유효성 및 소유권 검증 (`validateStoragePathOwnership`).
   - OCR 엔진 (`Google Cloud Vision`) 호출하여 비정형 텍스트 추출.
3. **Reasoning Tier (`parseToActionPlan`)**:
   - 추출된 텍스트와 User-defined 옵션(Detail level, Priority 등)을 조합하여 System Prompt 생성.
   - OpenAI의 JSON Mode를 활용하여 정형화된 `ActionPlan` 객체 생성.
4. **Post-processing & Persistence**:
   - `validateActionPlan`을 통한 Schema Validation 및 누락된 메타데이터(연도 보정 등) 후처리.
   - DB 저장 (`saved_todo`) 및 임시 스토리지 파일 삭제 (Cleanup).

---

## 2. Core Module Implementation Details

### 2.1 AI Reasoning Engine (`src/lib/openai.ts`)
본 프로젝트의 핵심은 **"문서의 할 일 분해(Decomposition)"**를 수행하는 Prompt Engineering에 있습니다.

#### Reasoning Logic (System Prompt):
- **5-Step Execution**: 
  1. 분류(Classification) 
  2. 컨텍스트 추출 
  3. **Atomic Decomposition (핵심)**: 문장을 최소 실행 단위로 쪼갬.
  4. 역산 마감일(Back-calculated Deadlines): 마감일로부터 역순으로 일정 분배.
  5. JSON 정형화.
- **Year Inference Algorithm**: 
  - `today` 대비 6개월 이상의 미래 날짜가 연도 없이 등장할 경우, 이를 과거(전년도) 문서로 판별하는 휴리스틱 로직 포함.
- **Granularity Control**: Pro 유저는 `brief` | `normal` | `detailed` 옵션을 통해 AI의 분해 깊이를 동적으로 조절 가능.

#### Error Handling & Sanitization:
- API 응답 내 Markdown backtick 제거 로직 및 JSON parsing 예외 처리 내장.
- `response_format: { type: "json_object" }`를 통한 스키마 안정성 확보.

### 2.2 OCR Integration (`src/lib/google-ocr.ts`)
- **Engine**: Google Cloud Vision - `DOCUMENT_TEXT_DETECTION`.
- **Optimization**: 단일 또는 복수 이미지(최대 5개)를 비동기로 호출하며 결과를 `join('\n\n')`으로 병합하여 컨텍스트 손실을 최소화.
- **Security**: Google Service Account Key를 환경 변수(`GOOGLE_APPLICATION_CREDENTIALS_JSON`)를 통해 런타임에 동적으로 주입하여 보안 강화.

### 2.3 Middleware & Authentication Auth (`src/middleware.ts`)
- **Path Protection**: `/dashboard`, `/todo`, `/upload` 등 핵심 경로에 대해 JWT 기반의 세션 체크 수행.
- **Conditional Redirect**: 비로그인 사용자가 루트 경로 접근 시 랜딩 페이지를 노출하고, 로그인 사용자는 대시보드로 자동 리다이렉션 (Landing Bypass Parameter 지원).

---

## 3. Data Schema & Validation (`src/types/`, `src/lib/schema.ts`)

ToDit은 Zod 또는 수동 Validation 로직을 통해 데이터의 무결성을 보장합니다.

### 3.1 Domain Types (`types/index.ts`)
- `ActionPlan`: `category`, `title`, `analysis`, `keywords`, `keyPoints`, `actions`, `requirements`, `unknowns`로 구성된 복합 객체.
- `ActionItem`: 각 태스크의 성격(`task`), 기한(`due`), 우선순위(`priority`), 완료 상태(`done`)를 포함.

### 3.2 Schema Post-processing (`lib/schema.ts`)
- AI가 생성한 Raw JSON에 대해 엄격한 형 변환 적용.
- **Date Normalization**: `due` 날짜가 누락된 항목에 대해 가장 이른 마감일의 전날로 자동 배치하는 로직을 통해 시각화 안정성 확보.

---

## 4. Usage & Subscription Logic (`src/lib/usage.ts`)

- **Quota Management**: `user_usage` 테이블을 통한 월간 사용량 추적.
- **Monthly Roll-over**: `last_refill_at` 컬럼을 체크하여 매월 1일 자정에 `balance`를 0으로 초기화하는 로직 구현.
- **Tier-based Logic**: 
  - `Free`: 월 20회 제한, `gpt-4o-mini` 고정, 우선순위 분석 제한.
  - `Pro`: 무제한(또는 높은 한도), `gpt-4o` 사용, 모든 파싱 옵션 개방.

---

## 5. Security & Stability Considerations

1. **Signed URL Uploads**: 클라이언트가 서버를 거치지 않고 Storage에 업로드함으로써 서버 리소스 소모 및 파일 사이즈 제한 이슈 해결.
2. **Ephemeral Storage Cleanup**: 분석이 완료된 후 `finally` 블록에서 `deleteFromParseTemp`를 호출하여 민감 정보가 포함된 파일을 즉시 삭제.
3. **Storage Ownership Check**: `validateStoragePathOwnership`를 통해 타인의 스토리지 경로를 통한 API 호출(Attack vector)을 원천 차단.
4. **Environment Isolation**: 개발/운영 환경별 API Key 및 DB URL 분리 운용.

---

## 6. Optimization Opportunities (Future)

- **Worker Thread PDF Parsing**: 대용량 PDF의 경우 `pdf-parse`를 Web Worker 또는 분리된 Lambda에서 처리하여 Event loop 블로킹 방지 필요.
- **Streaming UI**: OpenAI 응답 생성 시 Streaming API를 활용하여 사용자 경험(LCP) 개선.
- **Vector Search (RAG)**: 저장된 할 일 목록에 대해 벡터 임베딩을 적용하여 유사 작업 추천 기능 확장 가능.

---

## Conclusion

ToDit 프로젝트는 인공지능의 불확실한 결과물을 정형화된 비즈니스 데이터로 전환하기 위한 견고한 파이프라인 디자인을 보여주고 있습니다. 특히, 스토리지 보안 처리와 멀티 티어 사용량 관리 로직은 상용 서비스 수준의 완성도를 갖추고 있습니다.
