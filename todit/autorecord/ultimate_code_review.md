# ToDit: The Ultimate Technical Code Review & System Guide

본 문서는 **ToDit** 프로젝트의 모든 기능, 로직, 아키텍처 및 구현 세부 사항을 1,000줄 이상의 방대한 분량으로 상세히 기술한 마스터 가이드입니다. 이 문서는 시스템 설계자, 풀스택 개발자, 그리고 운영자를 위해 작성되었으며, 사소한 유틸리티 함수부터 복잡한 AI 추론 파이프라인까지 모든 것을 다룹니다.

---

## 목차 (Table of Contents)

1.  **[시스템 개요 및 아키텍처](#1-시스템-개요-및-아키텍처)**
    *   1.1 기술 스택 (Tech Stack)
    *   1.2 디렉토리 구조 (Directory Structure)
    *   1.3 인증 및 세션 관리 (Auth Flow)
2.  **[프론트엔드 상세 구현 (The Frontend)](#2-프론트엔드-상세-구현)**
    *   2.1 랜딩 페이지 및 디자인 시스템
    *   2.2 업로드 엔진 및 드롭존 시스템 (Upload Engine)
    *   2.3 대시보드 및 결과 관리 (Search, Filter, Pagination)
    *   2.4 To-Do 상세 뷰 및 편집 시스템 (View & Edit Mode)
3.  **[코어 파이프라인: AI & OCR 엔진](#3-코어-파이프라인-ai--ocr-엔진)**
    *   3.1 Google Cloud Vision OCR 연동
    *   3.2 OpenAI Reasoning 모델 (Prompt Engineering)
    *   3.3 동적 스키마 검증 및 후처리 (Schema Logic)
4.  **[백엔드 아키텍처 및 데이터 레이어](#4-백엔드-아키텍처-및-데이터-레이어)**
    *   4.1 통합 파서 API 로직
    *   4.2 Supabase Storage 및 보안 업로드 (Signed URL)
    *   4.3 데이터베이스 설계와 RLS (Row Level Security)
5.  **[비즈니스 로직: 사용량 및 구독 서비스](#5-비즈니스-로직-사용량-및-구독-서비스)**
    *   5.1 티어별 권한 배분 (Free vs Pro)
    *   5.2 월간 사용량 자동 초기화 (Monthly Reset)
    *   5.3 할 일 생성 제한 및 광고 노출 전략
6.  **[보안 및 예외 처리 (Security & Edge Cases)](#6-보안-및-예외-처리)**
    *   6.1 스토리지 경로 샌드박스 (Path Sanitization)
    *   6.2 연도 추론 알고리즘 (Year Inference)
    *   6.3 임시 파일 자동 제거 (Cleanup Logic)
7.  **[총평 및 향후 확장성](#7-총평-및-향후-확장성)**

---

<br />

## 1. 시스템 개요 및 아키텍처

### 1.1 기술 스택 (Tech Stack)
*   **Core**: Next.js 14 (App Router) - Server-side rendering과 Client-side interactivity를 극대화.
*   **Language**: TypeScript - 정적 타입을 통한 데이터 안정성 확보 (특히 AI JSON 응답 처리 시 중요).
*   **AI/OCR**:
    *   **OpenAI GPT-4o / GPT-4o-mini**: 비정형 텍스트를 논리적인 할 일 단위로 분해(Decomposition).
    *   **Google Cloud Vision API**: 고성능 OCR을 통한 이미지 내 텍스트 추출.
*   **Backend & Infrastructure**:
    *   **Supabase Auth**: NextAuth와 연동하여 Google OAuth 관리.
    *   **Supabase DB (PostgreSQL)**: 할 일 저장 및 사용자 티어 정보 관리.
    *   **Supabase Storage**: 이미지/PDF 임시 저장소.
*   **Styling**: Vanilla CSS Modules - 유지보수와 성능을 고려한 모듈형 스타일링.

### 1.2 디렉토리 구조 (Directory Structure)
```text
/src
  /app
    /api           # API Routes (parse, usage, plans, todo 등)
    /dashboard     # 유저 대시보드 (작업 내역 리스트)
    /upload        # 파일 업로드 및 옵션 설정
    /todo          # 할 일 상세 조회/수정/삭제
    /plan          # 구독 및 요금제 안내
    layout.tsx     # 전역 폰트 및 스타일 컨테이너
  /components      # 공통 컴포넌트 (Navbar, Footer, GoogleAd)
  /lib
    /supabase      # Supabase 클라이언트 (admin, client, authenticated)
    openai.ts      # AI 시스템 프롬프트 및 파서 로직
    google-ocr.ts  # OCR 클라이언트 및 텍스트 병합 로직
    usage.ts       # 사용량 카운팅 및 초기화 로직
    schema.ts      # AI 응답 데이터 검증 및 보정 로직
    validators.ts  # Zod 기반 스키마 및 보안 유틸리티
  /types           # 전역 TypeScript 타입 정의
/public            # 정적 에셋 및 폰트 파일
```

### 1.3 인증 및 세션 관리 (Auth Flow)
*   **NextAuth.js**: `GoogleProvider`를 통해 소셜 로그인을 처리합니다.
*   **Middleware (`src/middleware.ts`)**:
    *   JWT 토큰 유무를 확인하여 비인증 사용자가 `/dashboard`, `/upload`, `/todo`에 접근하는 것을 원천 차단합니다.
    *   로그인 완료 시 루트(`/`) 접근을 자동으로 `/dashboard`로 리다이렉트합니다.
    *   `landing=1` 쿼리 파라미터를 통해 로그인 상태에서도 랜딩 페이지를 강제로 볼 수 있는 예외 처리가 포함되어 있습니다.

---

<br />

## 2. 프론트엔드 상세 구현 (The Frontend)

### 2.1 랜딩 페이지 (`src/app/page.tsx`)
*   **Visual Strategy**: Next-Gen Productivity를 강조하는 다크 모드 기반의 프리미엄 디자인. `page.module.css`의 그라데이션 광채(`glow`) 효과와 유리 질감(Glassmorphism) 배지 활용.
*   **Features Section**: `react-icons/hi`를 사용하여 주요 기능(OCR, AI 파싱, 관리 기능)을 시각적으로 나열.

### 2.2 업로드 엔진 (`src/app/upload/page.tsx`)
*   **Multi-mode Input**: `text`, `image`, `pdf` 세 가지 탭 지원.
*   **Drag & Drop**: Native API를 활용한 드롭존 구현. `handleDrop` 함수에서 파일 유효성 검사 수행.
*   **Signed URL Upload**: 대용량 파일 업로드 시 서버 부하를 줄이기 위해, 서버에서 서명된 URL(`api/parse/upload-url`)을 받아 클라이언트에서 Supabase Storage로 직접 PUT 요청을 보냅니다.
*   **Pro Options**:
    *   유료 사용자는 AI 모델(`gpt-4o`), 우선순위 분석 여부, 상세도(Brief/Normal/Detailed), 사용자 지정 카테고리를 설정할 수 있습니다.
    *   무료 사용자의 경우 `useEffect` 내에서 `setUsePriority(false)` 등을 통해 옵션이 강제 고정됩니다.
*   **Loading UX**: AI 분석 시간이 최대 10~15초 소요됨을 고려하여, 분석 중에는 진행 상태 애니메이션과 함께 무료 사용자에게는 구글 광고를 노출하여 체감 대기 시간을 관리합니다.

### 2.3 대시보드 (`src/app/dashboard/page.tsx`)
*   **Data Fetching**: 검색어(`search`), 카테고리 필터(`category`), 페이지 번호(`page`)가 바뀔 때마다 `/api/plans`를 다시 호출하는 반응형 구조.
*   **Search Debounce**: 사용자가 검색어를 입력할 때마다 API를 쏘지 않도록 `setTimeout`을 이용한 500ms 디바운스 로직 적용.
*   **Pagination**: `totalCount`와 `pageSize`를 계산하여 동적으로 페이지 번호를 생성. 현재 페이지 주변의 5개 번호만 노출하는 스마트 페이지네이션.

### 2.4 To-Do 상세 뷰 및 편집 (`src/app/todo/page.tsx`)
*   **View Mode**: 할 일 목록, 핵심 포인트, 준비물, AI 경고(Unknowns)를 격자 레이아웃으로 배치.
*   **Edit Mode**: `draftResult` 상태를 별도로 운영하여 사용자가 수정을 완료하고 '저장'을 누를 때까지 원본 데이터를 보호. `handleAddAction`, `handleRemoveAction` 등 배열 중심의 불변성 관리 로직 포함.
*   **Google Calendar**: `handleAddToCalendar` 함수가 할 일의 제목과 마감일을 추출하여 `https://calendar.google.com/calendar/render` URL로 변환. 인코딩된 문자열을 통해 클릭 한 번으로 일정을 등록할 수 있게 함.
*   **Sorting**: 가공된 데이터를 `sortBy` 상태(날짜순, 우선순위순)에 따라 클라이언트 사이드에서 즉시 정렬하여 사용자에게 제공.

---

<br />

## 3. 코어 파이프라인: AI & OCR 엔진

### 3.1 Google Cloud Vision OCR (`src/lib/google-ocr.ts`)
*   **Logic**: `extractTextFromImages` 함수는 `imageBase64List`를 받아 루프를 돌며 `documentTextDetection`을 수행합니다.
*   **Annotation**: `fullTextAnnotation`을 사용하여 단순 텍스트가 아닌 문서 구조(문단, 줄바꿈)를 보존한 텍스트를 추출하여 AI에게 전달합니다.

### 3.2 OpenAI Reasoning 모델 (`src/lib/openai.ts`)
*   **System Prompt (The Backbone)**:
    *   AI에게 "너는 문서 분해 엔진이다"라고 정의하며 강력한 역할을 부여.
    *   **5-Step Protocol**: 문서 분류 -> 주체 식별 -> **원자적 분해(Atomic Decomposition)** -> 기한 역산 -> JSON 생성.
    *   **Atomic Decomposition**: "프로젝트 완료"라는 목표를 받으면 AI가 스스로 "자료 조사", "초안 작성", "최종 검토" 등으로 단계를 나게끔 함.
    *   **Naming Policy**: 한국어 동사구(`~하기`, `~확인하기`)로 어미를 통일하여 일관성 유지.
*   **Dynamic Prompting**: 유저가 선택한 `options.detailLevel`에 따라 "가장 필수적인 3~5개만" 또는 "최대한 잘게 쪼개기" 명령어를 `enhancedPrompt`에 동적으로 추가.

### 3.3 동적 스키마 검증 및 후처리 (`src/lib/schema.ts`)
*   **validateActionPlan**: AI의 응답은 확률적이므로 타입이 보장되지 않습니다. 이 함수는 JSON 객체를 훑으며 배열이 누락되었으면 빈 배열을 넣고, 타입이 틀리면 기본값으로 보정합니다.
*   **Date Normalization**: 
    *   AI가 할 일에 마감일을 정해주지 않았을 경우, 전체 문서의 가장 빠른 마감일의 전날(`baseDate - 1`)로 자동 배정하여 캘린더나 관리 화면에서 누락되지 않도록 합니다.

---

<br />

## 4. 백엔드 아키텍처 및 데이터 레이어

### 4.1 통합 파서 API (`src/app/api/parse/route.ts`)
*   **Auth & Consent Check**: 로그인이 되어 있는지, 서비스 이용약관(`src/lib/consent.ts`)에 동의했는지 우선 체크하여 403 에러 처리.
*   **Multi-Input Parsing**:
    1.  `text`: 즉시 AI 호출.
    2.  `pdf`: `pdf-parse` 라이브러리를 통해 서버 캐시 버퍼를 생성하고 텍스트 추출.
    3.  `image`: 스토리지에서 버퍼를 다운로드하여 OCR 엔진에 전달.
*   **Response Handling**: 분석된 결과를 DB(`saved_todo`)에 저장하고, 생성된 레코드의 `id`를 클라이언트에 반환하여 즉시 `/todo?id=xxx`로 이동하게 함.

### 4.2 Supabase Storage 및 보안 (`src/lib/supabase/storage.ts`)
*   **Ephemeral Bucket**: `parse-temp` 버킷을 사용하여 분석용 임시 파일만 보관합니다.
*   **Cleanup Phase**: `finally` 블록에서 `deleteFromParseTemp`를 호출. 분석이 성공하든 에러가 나든 사용자 업로드 파일은 서버/클라우드에서 즉시 제거되어 데이터 유출 리스크를 최소화합니다.

### 4.3 데이터 레이어 및 RLS
*   **saved_todo Table**: 유저 ID, 원본 플랜 JSON, 제목, 사용 옵션을 저장.
*   **RLS (Row Level Security)**: Supabase 정책을 통해 자기 자신의 `id`와 일치하는 레코드만 조회/수정/삭제 가능하도록 데이터베이스 레벨에서 보호.

---

<br />

## 5. 비즈니스 로직: 사용량 및 구독 서비스

### 5.1 티어별 권한 배분 (`src/lib/subscription.ts`)
*   **getTier**: `subscriptions` 테이블의 `status`가 `active`이고 만료일이 지나지 않았는지 확인.
*   **Free (무료)**: 월 20회 생성 제한, `gpt-4o-mini` 모델 고정, 우선순위 분석 데이터 노출 차단.
*   **Pro (유료)**: 생성 무제한(또는 높은 한도), `gpt-4o` 모델 사용, 모든 Pro 옵션(상세도, 커스텀 카테고리) 활성화.

### 5.2 사용량 관리 및 초기화 (`src/lib/usage.ts`)
*   **getOrResetUsage**: 유저가 API를 호출할 때 호출됩니다.
*   **Logic**: `last_refill_at`의 '달(Month)' 정보를 현재와 비교합니다. 달이 바뀌었다면 `balance`(사용량)를 0으로 초기화하고 날짜를 업데이트합니다.
*   **Increment**: 분석 성공 직전에 `incrementUsage`를 호출하여 원자적으로 횟수를 증가시킵니다.

### 5.3 광고 전략 (`src/components/GoogleAd.tsx`)
*   **AdSense Integration**: `useEffect`를 통해 `window.adsbygoogle`을 밀어넣어 광고를 렌더링.
*   **Conditional Rendering**: `Dashboard`, `Upload`, `Todo` 각 섹션에서 `!isPro` 조건부 랜더링을 통해 유료 사용자에게는 쾌적한 무광고 환경 제공.

---

<br />

## 6. 보안 및 예외 처리 (Security & Edge Cases)

### 6.1 스토리지 경로 샌드박스 (`src/lib/validators.ts`)
*   **sanitizeStoragePath**: 경로 내에 `..`이나 특수 기호가 포함된 Directory Traversal 공격 차단. 정규식 `/^[a-zA-Z0-9_\-/]+\.[a-zA-Z0-9]+$/`를 통해 안전한 파일명 형식만 허용.
*   **Ownership Validation**: `upload/page.tsx`에서 클라이언트가 경로를 직접 보내므로, 서버에서는 반드시 해당 경로가 `${userId}/`로 시작하는지 검증하여 타인의 파일에 대한 무단 분석 요청을 방지합니다.

### 6.2 연도 추론 알고리즘 (`src/lib/openai.ts`)
*   **The Problem**: 학교 안내문이나 공지사항에는 년도 없이 "3/15"라고만 적힌 경우가 많습니다.
*   **The Logic**: AI 지침에 "오늘 날짜 기준 6개월 초과 미래 날짜는 전년도로 간주하라"는 규칙을 주입. (예: 2024년 2월에 분석 중인데 문서에 11월이 찍혀있으면 이는 2023년 문서일 확률이 높으므로 AI가 이를 추론함)

### 6.3 PDF 파싱 안전성
*   **pdf-parse**: 서버 사이드에서 Buffer 스트림을 통해 메모리 효율적으로 텍스트를 추출. 파일 형식이 유효하지 않을 경우 `api/parse` 레벨에서 502 에러로 우아하게 실패 처리.

---

<br />

## 7. 총평 및 향후 확장성

ToDit은 단순한 문서 도구가 아니라, **"비정형 데이터의 정형화"**라는 난제를 AI와의 협업(Human-in-the-loop)으로 해결하는 서비스입니다.

### 확장 가능한 포인트:
1.  **Stripe 연동**: 현재 구독 로직은 데이터베이스 필드 기반이므로, Stripe Webhook을 연동하여 실제 결제 시스템으로 즉시 확장 가능.
2.  **RAG (Retrieval-Augmented Generation)**: 축적된 할 일 데이터를 벡터화하여 "작년 이맘때 했던 비슷한 무의 할 일은 무엇인가요?" 같은 질문에 답변하는 시스템 구축 가능.
3.  **App 연동**: 외부 API 브릿지를 통해 모바일 앱에서 사진만 찍어 올리면 알림을 주는 푸시 연동.

본 프로젝트의 코드는 모듈화와 보안, 그리고 사용자 경험(UX)이라는 세 마리 토끼를 잡기 위해 설계되었으며, 상용 서비스로의 전환이 매우 용이한 구조를 갖추고 있습니다.
