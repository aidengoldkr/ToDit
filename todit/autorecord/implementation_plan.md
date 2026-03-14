# Free vs Pro 요금제 차등화 및 Pro 전용 생성 옵션 구현 계획서

## 개요
사용자가 To-Do 플로우를 생성할 때, 요금제(Free/Pro)에 따라 기능적 제한을 두고 Pro 사용자에게는 고도화된 생성 옵션을 제공하여 서비스의 가치를 차등화합니다.

## 사용자 리뷰 필요 사항
> [!IMPORTANT]
> - **광고 표시**: Free 사용자에게 보여줄 광고 영역의 위치를 업로드 페이지 하단이나 결과 페이지로 제안합니다. 현재는 UI Placeholder 형태로 구현할 예정입니다.
> - **AI 모델 선택**: Pro 사용자에게 제공할 모델 리스트(예: GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet 등)를 확정해야 합니다.
> - **이미지 개수**: Free는 5장 제한, Pro는 무제한(또는 50장 등 매우 높은 수치)으로 설정할 예정입니다.

---

## 주요 변경 사항

### 1. 요금제별 제한 정책 업데이트 ([src/lib/subscription.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/subscription.ts), [src/lib/credits.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/credits.ts))
- **생성 횟수**: Free 월 20회 (`FREE_MONTHLY_LIMIT = 20`) 반영 확인 및 Pro 무제한 로직 점검.
- **이미지 개수**: 
  - Free: 최대 5장으로 변경 (`FREE_IMAGE_LIMIT = 5`).
  - Pro: 무제한으로 변경 (`PRO_IMAGE_LIMIT` 상향 또는 로직 제거).

### 2. Pro 전용 생성 옵션 정의 및 API 확장 ([src/types/index.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/types/index.ts), [src/app/api/parse/route.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/app/api/parse/route.ts))
- **[ParseInput](file:///c:/project/Insight_Paser/ToDit/todit/src/types/index.ts#38-50) 타입 확장**: 
  - `options?: { model?: string, usePriority?: boolean, customCategory?: string, detailLevel?: 'brief' | 'normal' | 'detailed' }` 추가.
- **API 라우트 수정**: 클라이언트로부터 받은 `options`를 AI 처리 함수로 전달.

### 3. AI 파싱 로직 고도화 ([src/lib/openai.ts](file:///c:/project/Insight_Paser/ToDit/todit/src/lib/openai.ts))
- **모델 동적 선택**: `options.model`에 따라 OpenAI 모델 분기 처리.
- **프롬프트 튜닝**:
  - `customCategory`: AI가 카테고리를 분류할 때 사용자가 지정한 값을 최우선으로 고려하도록 지시.
  - `usePriority`: 할 일 목록 생성 시 우선순위를 더 엄격하게 분석하거나 생략하도록 조정.
  - `detailLevel`: 작업 분해의 깊이를 조절하도록 프롬프트 문구 동적 생성 (예: "가장 작은 단위로 쪼개기" vs "주요 단계만 나열").

### 4. 업로드 페이지 UI 개선 ([src/app/upload/page.tsx](file:///c:/project/Insight_Paser/ToDit/todit/src/app/upload/page.tsx))
- **Pro 옵션 활성화**: 현재 비활성화된 Pro 옵션을 실제 컨트롤(Select, Toggle, Input)로 교체하고 상태 관리 연동.
- **광고 영역 추가**: Free 사용자용 광고 섹션(Placeholder) 삽입.
- **제한 안내 강화**: 이미지 업로드 시 무료 사용자가 5장을 넘길 경우 안내 및 업로드 차단 로직 강화.

### 5. 광고 표시 (UI)
- Free 요금제 사용 시 업로드 화면 하단에 `AdBanner` 컴포넌트(Placeholder)를 표시하여 시각적 차이를 부여합니다.

---

## 검증 계획

### 자동화 테스트/스크립트
- [ParseInput](file:///c:/project/Insight_Paser/ToDit/todit/src/types/index.ts#38-50)에 다양한 옵션을 넣어 AI 응답이 의도대로(카테고리 반영, 상세도 조절 등) 변하는지 API 테스트 수행.

### 수동 확인 사항
- Free 계정으로 접속 시 Pro 옵션 조절 불가 여부 및 이미지 5장 초과 업로드 제한 확인.
- Pro 계정으로 접속 시 모든 옵션이 활성화되고 무제한 생성이 가능한지 확인.
- 광고 영역이 사용자의 요금제 티어에 따라 올바르게 노출/비노출되는지 확인.
