"use client";

import React, { useEffect, useState } from "react";
import styles from "./IosKakaoModal.module.css";
import { openIosKakaoExternal, getExternalUrl } from "@/lib/in-app";

interface IosKakaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IosKakaoModal({ isOpen, onClose }: IosKakaoModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const url = getExternalUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenExternal = () => {
    openIosKakaoExternal(getExternalUrl());
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>외부 브라우저로 열기</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.content}>
          <p>
            카카오톡 인앱 브라우저에서는 구글 로그인이 제한될 수 있습니다. 
            원활한 이용을 위해 <strong>외부 브라우저</strong> 사용을 권장합니다.
          </p>
          
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span>아래 버튼을 눌러 바로 이동하기</span>
            </div>
            <button className={styles.primaryBtn} onClick={handleOpenExternal}>
              외부 브라우저에서 열기
            </button>
            
            <div className={styles.divider}>또는</div>
            
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span>링크를 복사해서 브라우저(Safari 등)에 붙여넣기</span>
            </div>
            <button className={`${styles.secondaryBtn} ${copied ? styles.copied : ""}`} onClick={handleCopy}>
              {copied ? "복사 완료!" : "링크 복사하기"}
            </button>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.textBtn} onClick={onClose}>그대로 진행할게요</button>
        </div>
      </div>
    </div>
  );
}
