"use client";

import React from "react";
import styles from "./MockUI.module.css";
import { SiGooglecalendar } from "react-icons/si";

const MockUI = () => {
  return (
    <div className={styles.mockCard}>
      <div className={styles.mockHeader}>
        <div className={styles.mockDot}></div>
        <div className={styles.mockDot}></div>
        <div className={styles.mockDot}></div>
      </div>

      <div className={styles.mockScrollArea}>
        <div className={styles.mockAppHeader}>
          <div className={styles.mockTopBadge}>수행평가 안내문</div>
          <h2 className={styles.mockAppTitle}>국어 수행 평가 안내문: 문학 작품 해석하기</h2>
          <div className={styles.mockAppTags}>
            <span className={styles.mockAppTag}>#국어</span>
            <span className={styles.mockAppTag}>#수행평가</span>
            <span className={styles.mockAppTag}>#문학 작품</span>
            <span className={styles.mockAppTag}>#해석</span>
            <span className={styles.mockAppTag}>#PPT 제출</span>
          </div>
        </div>

        <div className={styles.mockLayout}>
          <div className={styles.mockMain}>
            <div className={styles.mockSectionHeader}>
              <div className={styles.mockSectionTitle}>To-Do</div>
              <div className={styles.mockSortGroup}>
                <div className={styles.mockSortBtn}>서순</div>
                <div className={`${styles.mockSortBtn} ${styles.mockActiveSort}`}>날짜순</div>
                <div className={styles.mockSortBtn}>우선순위</div>
              </div>
            </div>

            <div className={styles.mockTodoList}>
              {[
                { title: "한국문학 작품 2작품 선택하기", date: "2026-03-14", priority: "높음", pClass: styles.mockBadgeHigh },
                { title: "문학 작품 해석 방법 학습하기", date: "2026-03-14", priority: "낮음", pClass: styles.mockBadgeLow },
                { title: "선택한 작품에 대한 자료 조사하기", date: "2026-03-15", priority: "보통", pClass: styles.mockBadgeMedium },
                { title: "문학 작품의 네 가지 감상 방법 학습하기", date: "2026-03-15", priority: "낮음", pClass: styles.mockBadgeLow },
                { title: "작품 해석 초안 작성하기", date: "2026-03-16", priority: "보통", pClass: styles.mockBadgeMedium }
              ].map((item, i) => (
                <div key={i} className={styles.mockTodoItem}>
                  <div className={styles.mockCheck}></div>
                  <div className={styles.mockTodoContent}>
                    <div className={styles.mockTodoTitle}>{item.title}</div>
                    <div className={styles.mockTodoMeta}>
                      <span className={styles.mockMetaDate}>{item.date}</span>
                      <span className={`${styles.mockBadge} ${item.pClass}`}>{item.priority}</span>
                    </div>
                  </div>
                  <div className={styles.mockCalendarLink}><SiGooglecalendar />ㅤGoogle Calendar에 추가</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.mockSidebar}>
            <div className={styles.mockSideTitle}>Info</div>

            <div className={styles.mockSideCard}>
              <div className={styles.mockCardHeader}>AI 문서 요약</div>
              <div className={styles.mockCardText}>
                이 문서는 국어 수행 평가에 대한 안내문으로, 문학 작품 해석하기 평가의 진행 방법과 주의 사항을 설명하고 있다. 한국문학 작품을 대상으로 하며...
              </div>
            </div>

            <div className={styles.mockSideCard}>
              <div className={styles.mockCardHeader}>핵심 정보</div>
              <ul className={styles.mockCardList}>
                <li>평가 대상은 한국문학 작품만 가능하다.</li>
                <li>각 작품을 시험지 양식에 작성해야 한다.</li>
                <li>PPT 제출 기한은 10월 17일 금요일 밤 11시 59분까지이다.</li>
              </ul>
            </div>

            <div className={styles.mockSideCard}>
              <div className={styles.mockCardHeader}>준비물 & 참고</div>
              <ul className={styles.mockCardList}>
                <li>시험지 양식</li>
                <li>리소스 제출 계정</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockUI;
