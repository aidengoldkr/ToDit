"use client";

import { useEffect } from "react";
import { isInAppBrowser, isAndroid, isIOS, isKakaoTalk, redirectToAndroidChrome, getExternalUrl } from "@/lib/in-app";
import { useIosKakaoModal } from "./IosKakaoModalProvider";

/**
 * 페이지 진입 시 인앱 브라우저 여부를 판단하여 
 * Android는 자동 리다이렉트, iOS 카카오톡은 안내 모달을 띄웁니다.
 */
export default function InAppRedirectHandler() {
  const { openModal } = useIosKakaoModal();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Android 인앱 브라우저 대응
    if (isAndroid() && isInAppBrowser()) {
      redirectToAndroidChrome(getExternalUrl());
      return;
    }

    // iOS 카카오톡 대응
    if (isIOS() && isKakaoTalk()) {
      // 잠깐의 지연 후 모달 오픈 (사용자가 페이지 로드를 인지한 뒤 띄우기 위함)
      const timer = setTimeout(() => {
        openModal();
      }, 500);
      return () => clearTimeout(timer);
    }
    
    // 타 서비스 인앱(인스타 등)에 대해서도 Android는 이미 위에서 처리됨. 
    // iOS의 경우 범용적인 대응이 불가능하여 필요한 페이지에서 가이드 문구나 모달을 추가로 열 수 있음.
  }, [openModal]);

  return null;
}
