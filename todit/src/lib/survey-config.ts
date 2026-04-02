export type QuestionType = "multiple_choice" | "text";

export interface MultipleChoiceQuestion {
  id: string;
  type: "multiple_choice";
  label: string;
  options: string[];
  required: boolean;
}

export interface TextQuestion {
  id: string;
  type: "text";
  label: string;
  placeholder?: string;
  required: boolean;
}

export type SurveyQuestion = MultipleChoiceQuestion | TextQuestion;

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    type: "multiple_choice",
    label: "ToDit을 알게 된 경로는 무엇인가요?",
    options: ["SNS", "지인 추천", "검색", "기타"],
    required: true,
  },
  {
    id: "q2",
    type: "multiple_choice",
    label: "주로 어떤 문서를 처리하시나요?",
    options: ["학교 과제/공지", "업무 문서", "개인 일정 메모", "기타"],
    required: true,
  },
  {
    id: "q3",
    type: "multiple_choice",
    label: "현재 가장 불편한 점은 무엇인가요?",
    options: ["할 일 추출이 어려움", "정리가 번거로움", "일정 관리가 힘듦", "기타"],
    required: true,
  },
  {
    id: "q4",
    type: "multiple_choice",
    label: "ToDit에서 가장 기대하는 기능은 무엇인가요?",
    options: ["PDF 분석", "AI 우선순위 추천", "캘린더 연동", "기타"],
    required: true,
  },
  {
    id: "q5",
    type: "text",
    label: "ToDit에 바라는 점이나 자유롭게 의견을 남겨주세요",
    placeholder: "자유롭게 작성해 주세요 (선택 사항)",
    required: false,
  },
];

export const REQUIRED_QUESTION_IDS = SURVEY_QUESTIONS
  .filter((q) => q.required)
  .map((q) => q.id);
