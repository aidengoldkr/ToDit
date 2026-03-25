"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import styles from "./page.module.css";
import { HiOutlineLightningBolt, HiOutlineSparkles, HiOutlineCollection, HiChevronDown } from "react-icons/hi";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MockUI from "@/components/MockUI";

import { useIosKakaoModal } from "@/components/IosKakaoModalProvider";
import { createStartClickHandler } from "@/lib/in-app";

export default function Home() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const { openModal } = useIosKakaoModal();
  const router = useRouter();

  const handleLogin = createStartClickHandler(() => {
    router.push("/auth/signin");
  }, openModal);

  const faqs = [
    {
      q: "언제든지 취소할 수 있나요?",
      a: "네, 구독은 언제든지 취소하실 수 있으며 다음 결제일에 자동으로 종료됩니다. 해지 시점의 남은 기간 동안은 유료 기능을 계속 이용하실 수 있습니다."
    },
    {
      q: "Free 플랜 횟수는 언제 초기화되나요?",
      a: "매월 1일에 초기화됩니다. 매달 5회의 무료 생성 기회가 새롭게 제공됩니다."
    },
    {
      q: "사진의 화질이 안 좋아도 인식이 되나요?",
      a: "AI가 노이즈를 최대한 제거하고 분석하지만, 글자를 알아보기 힘들 정도로 흐릿하거나 빛 반사가 심한 경우에는 정확도가 떨어질 수 있습니다. 가급적 밝은 곳에서 정면으로 촬영해 주시는 것이 좋습니다."
    },
    {
      q: "PDF 파일의 모든 페이지를 한 번에 변환할 수 있나요?",
      a: "PDF 업로드 및 분석 기능은 Pro 플랜 전용으로 제공됩니다. Pro 플랜 이용 시 업로드하신 PDF의 모든 텍스트를 분석하여 핵심적인 할 일을 추출하며, 더욱 고도화된 AI 엔진으로 정확한 결과를 얻으실 수 있습니다."
    },
    {
      q: "모바일에서도 사용할 수 있나요?",
      a: "네, ToDit은 완전한 반응형 웹으로 제작되었습니다. 스마트폰 카메라로 할 일을 바로 찍어 업로드하고 대시보드에서 관리하는 등 모든 기능을 모바일에서 원활하게 이용하실 수 있습니다."
    },
    {
      q: "데이터 보안은 안전한가요?",
      a: "사용자가 업로드한 이미지나 PDF 파일은 분석 즉시 안전하게 파기됩니다. 또한 모든 데이터 전송은 SSL 암호화로 보호되어 외부 유출 걱정 없이 안전하게 사용하실 수 있습니다."
    },
    {
      q: "PG사 입점 대기 중인 이유가 무엇인가요?",
      a: "ToDit의 개발자가 고등학생인 관계로, 사업자 등록 및 PG 심사 승인 절차에 일반적인 경우보다 시간이 조금 더 소요되고 있습니다. 현재 Pro 플랜은 테스트 모드로 제공 중이며, 정식 출시 전까지 모든 기능을 자유롭게 경험해 보실 수 있습니다."
    },
    {
      q: "서비스 제공 기간은 어떻게 되나요?",
      a: "월 정기 구독 상품이며, 결제일로부터 1개월(30일) 이용 후 자동 갱신됩니다. 매월 동일한 날짜에 자동 결제가 진행됩니다."
    }
  ];

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>Next-Gen Productivity AI</div>
          <h1 className={styles.title}>
            모든 문서를 <br /><span>ToDit</span> 으로 <br />한 번에 계획하세요
          </h1>
          <p className={styles.subtitle}>
            안내문, 공지사항, 문제지까지. 사진 한 장이면 ToDit이 할 일을 추출하고
            바로 할 수 있는 To-Do를 만들어 드립니다.
          </p>
          <div className={styles.ctaGroup}>
            <button className={styles.primaryBtn} onClick={handleLogin}>
              지금 무료로 시작하기
            </button>
            <button className={styles.secondaryBtn} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              기능 보기
            </button>
          </div>
        </div>

        <div className={styles.visualSection}>
          <MockUI />
        </div>
      </section>

      {/* Diff / Transformation Section */}
      <section className={styles.diffSection}>
        <div className={styles.diffHeader}>
          <h2 className={styles.diffTitle}>막연한 할 일이 바로 할 수 있는 계획으로</h2>
          <p className={styles.diffSubtitle}>단순한 정보 전달을 넘어 실질적인 변화를 만듭니다.</p>
        </div>

        <div className={styles.diffFlow}>
          <div className={`${styles.diffCard} ${styles.otherCard}`}>
            <div className={styles.cardTop}>
              <span className={styles.cardTag}>일반 AI / Chat GPT</span>
            </div>
            <p className={styles.cardInstruction}>Input: "발표 준비해줘"</p>
            <div className={styles.instructionBox}>발표 준비하기</div>
            <div className={styles.contentBody}>
              <div className={styles.chatPreview}>
                발표를 준비하기 위해 먼저 주제를 선정하고 자료를 조사해야 합니다. 그 다음 슬라이드를 제작하고...
              </div>
            </div>
          </div>

          <div className={styles.flowArrow}>
            <HiOutlineSparkles />
          </div>

          <div className={`${styles.diffCard} ${styles.toditCard}`}>
            <div className={styles.cardTop}>
              <span className={styles.cardTag}>ToDit</span>
            </div>
            <p className={styles.cardInstruction}>Actionable Plan</p>
            <div className={styles.instructionBox}>발표 준비를 위한 4단계 To-Do</div>
            <div className={styles.contentBody}>
              <div className={styles.actionPlan}>
                <div className={styles.planItem}>
                  <span>1</span> 자료 조사 및 핵심 메시지 도출
                </div>
                <div className={styles.planItem}>
                  <span>2</span> 슬라이드 초안 및 시각 자료 제작
                </div>
                <div className={styles.planItem}>
                  <span>3</span> 대본 작성 및 리허설 3회 실시
                </div>
                <div className={styles.planItem}>
                  <span>4</span> 피드백 반영 및 최종 자료 점검
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className={styles.features} id="features">
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <HiOutlineLightningBolt />
            </div>
            <h3 className={styles.featureTitle}>초고속 OCR 파싱</h3>
            <p className={styles.featureDesc}>
              복잡한 표나 손글씨가 포함된 이미지에서도 AI가 정확하게 할 일을 식별하고 텍스트로 전환합니다.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <HiOutlineSparkles />
            </div>
            <h3 className={styles.featureTitle}>지능형 To-Do 생성</h3>
            <p className={styles.featureDesc}>
              단순히 텍스트를 옮기는 것이 아닙니다. AI가 큰 목표를 잘게 쪼개고, 순서를 정하고, 바로 시작할 수 있는 할 일로 만들어 드립니다.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <HiOutlineCollection />
            </div>
            <h3 className={styles.featureTitle}>체계적인 할 일 관리</h3>
            <p className={styles.featureDesc}>
              추출된 할 일을 대시보드에서 카테고리별로 관리하고, Google Calendar에 연동하여 일정을 놓치지 마세요.
            </p>
          </div>
        </div>
      </section>


      {/* Pricing Section */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.pricingHeader}>
          <h2 className={styles.pricingTitle}>내게 맞는 플랜을 선택하세요</h2>
          <p className={styles.pricingSubtitle}>문서를 To-Do로 만드는 가장 스마트한 방법</p>
        </div>

        <div className={styles.pricingGrid}>
          {/* Free Plan */}
          <div className={styles.card}>
            <div className={styles.planHeader}>
              <h2 className={styles.planName}>Free</h2>
              <div className={styles.price}>₩0<span>/월</span></div>
              <p className={styles.planDesc}>기본적인 To-Do 생성 기능이 필요한 분들을 위한 플랜</p>
            </div>

            <ul className={styles.planFeatures}>
              <li className={styles.planFeature}>
                <span className={styles.check}>✓</span> 월 5회 무료 생성
              </li>
              <li className={styles.planFeature}>
                <span className={styles.check}>✓</span> 기본 AI 모델 사용
              </li>
              <li className={styles.planFeature}>
                <span className={styles.check}>✓</span> 이미지 분석 지원
              </li>
              <li className={styles.planFeatureDisabled}>
                <span className={styles.cross}>×</span> PDF 문서 분석 제외
              </li>
              <li className={styles.planFeatureDisabled}>
                <span className={styles.cross}>×</span> 광고 포함
              </li>
              <li className={styles.planFeatureDisabled}>
                <span className={styles.cross}>×</span> 상세 분해 옵션 제외
              </li>
            </ul>

            <button className={styles.planBtn} onClick={handleLogin}>
              시작하기
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`${styles.card} ${styles.proCard}`}>
            <div className={styles.planHeader}>
              <h2 className={styles.planName}>Pro</h2>
              <div className={styles.price}>₩2,900<span>/월</span></div>
              <p className={styles.planDesc}>제한 없는 최신 AI 분석과 강력한 상세 설정을 원하시는 분들을 위해</p>
            </div>

            <ul className={styles.planFeatures}>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> <strong>무제한</strong> To-Do 생성
              </li>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> 더 강력한 <strong>AI 분석 엔진</strong> 탑재
              </li>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> 상세도 커스텀 (3단계)
              </li>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> 사용자 지정 카테고리 설정
              </li>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> 우선순위 자동 할당 기능
              </li>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> <strong>PDF 문서</strong> 분석 지원
              </li>
              <li className={styles.planFeature}>
                <span className={styles.checkPro}>✓</span> <strong>광고 전면 제거</strong>
              </li>
            </ul>

            <button className={`${styles.planBtn} ${styles.proBtn}`} onClick={handleLogin}>
              Pro로 업그레이드
            </button>
          </div>
        </div>
      </section>


      {/* FAQ Section */}
      <section className={styles.faq}>
        <h3 className={styles.faqTitle}>자주 묻는 질문</h3>
        <div className={styles.faqGrid}>
          {faqs.map((faq, index) => (
            <div key={index} className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => toggleFaq(index)}
                aria-expanded={activeFaq === index}
              >
                <span>Q. {faq.q}</span>
                <HiChevronDown
                  className={`${styles.chevron} ${activeFaq === index ? styles.chevronActive : ""}`}
                />
              </button>
              <div className={`${styles.faqAnswer} ${activeFaq === index ? styles.faqAnswerShow : ""}`}>
                <div className={styles.answerContent}>
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}