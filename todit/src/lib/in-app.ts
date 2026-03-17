"use client";

export const isInAppBrowser = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /KAKAOTALK/i.test(ua) ||
    /Instagram/i.test(ua) ||
    /Telegram/i.test(ua) ||
    /FBAN/i.test(ua) ||
    /FBAV/i.test(ua) ||
    /Line/i.test(ua)
  );
};

export const isAndroid = () => {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
};

export const isIOS = () => {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const isKakaoTalk = () => {
  if (typeof window === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
};

export const getExternalUrl = () => {
  if (typeof window === "undefined") return "";
  return window.location.href;
};

/**
 * Android Intent Scheme을 사용하여 외부 브라우저(Chrome)로 이동시킵니다.
 */
export const redirectToAndroidChrome = (url: string) => {
  const targetUrl = url.replace(/^https?:\/\//, "");
  // Intent scheme for Android Chrome
  window.location.href = `intent://${targetUrl}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
};

/**
 * iOS 카카오톡 외부 브라우저 열기 스킴
 */
export const openIosKakaoExternal = (url: string) => {
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
};

/**
 * 클릭 핸들러 생성 (로그인 버튼 등에 사용)
 */
export const createStartClickHandler = (onOriginalClick: () => void, openModal: () => void) => {
  return (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isAndroid() && isInAppBrowser()) {
      redirectToAndroidChrome(getExternalUrl());
      return;
    }

    if (isIOS() && isKakaoTalk()) {
      openModal();
      return;
    }

    // 그 외 일반 브라우저거나 대응 미흡한 경우 원래 동작 수행
    onOriginalClick();
  };
};

/**
 * 링크 클릭 핸들러 생성 (일반 <a> 태그나 Link 등에 사용)
 */
export const createLinkClickHandler = (targetUrl: string, openModal: () => void) => {
  return (e: React.MouseEvent) => {
    if (isAndroid() && isInAppBrowser()) {
      e.preventDefault();
      redirectToAndroidChrome(targetUrl);
      return;
    }

    if (isIOS() && isKakaoTalk()) {
      e.preventDefault();
      openModal();
      return;
    }

    // 일반 동작
  };
};
