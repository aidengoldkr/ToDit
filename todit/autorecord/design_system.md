# To-Do 리스트의 정점: ToDit 디자인 시스템

ToDit은 사용자에게 깨끗하고 생산적인 환경을 제공하기 위해 **'소프트 프리미엄(Soft Premium)'** 스타일을 지향합니다. 부드러운 여백, 명확한 색상 대비, 그리고 세련된 타이포그래피가 핵심입니다.

## 1. 타이포그래피 (Typography)

| 구분 | 폰트명 | 용도 | 특징 |
| :--- | :--- | :--- | :--- |
| **Main Sans** | `Paperozi` | 본문, 메뉴, 일반 텍스트 | 높은 가독성과 현대적인 느낌 (Weight 100~900 지원) |
| **Brand Logo** | `KblJump` | 로고, 강조 타이틀 | 역동적이고 독창적인 브랜드 아이덴티티 표현 |

- **Fallback**: Inter, Pretendard, system-ui

## 2. 컬러 시스템 (Color Palette)

### Core Colors
- **Accent**: `#10b981` (Emerald Green) - 생산성, 활력, 완료를 상징하는 핵심 액션 컬러.
- **Background**: `#f2f2f2` (Light) / `#111111` (Dark) - 눈이 편안한 배경색.
- **Surface**: `#ffffff` (Light) / `#1d1d1d` (Dark) - 카드 및 콘텐츠 배경.

### Status Colors
- **Urgent**: `#b91c1c` (Red) - 높은 우선순위.
- **Normal**: `#92400e` (Amber) - 중간 우선순위.
- **Muted**: `#6b7280` (Gray) - 보조 설명 및 비활성 상태.

## 3. UI 컴포넌트 스타일

- **Border Radius**:
  - `lg (18px)`: 메인 컨테이너, 카드
  - `md (14px)`: 섹션, 작은 카드
  - `sm (12px)`: 버튼, 입력창
- **Shadow**: `0 8px 24px rgba(29, 29, 29, 0.06)` - 떠 있는 느낌의 부드러운 그림자 (다크 모드에서는 제거하여 플랫한 디자인 유지).
- **Glassmorphism**: 내비게이션 바 등에 `backdrop-filter: blur`를 적용하여 고급스러운 레이어 효과 제공.

## 4. 인터랙션 및 애니메이션

- **Transitions**: 모든 테마 전환 및 호버 효과에 `0.2s ease` 적용으로 매끄러운 사용자 경험 제공.
- **Micro-animations**: 버튼 클릭, 체크박스 토글 시 미세한 반응형 피드백 제공.
