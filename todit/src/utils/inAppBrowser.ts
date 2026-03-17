export const isInAppBrowser = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("kakao") ||
    ua.includes("instagram") ||
    ua.includes("facebook") ||
    ua.includes("fban") ||
    ua.includes("fbav") ||
    ua.includes("line")
  );
};

export const handleInAppBrowserRedirection = () => {
  if (typeof window === "undefined") return false;
  
  const ua = navigator.userAgent.toLowerCase();
  const currentUrl = window.location.href;

  if (ua.includes("kakao")) {
    window.location.href = `kakaotalk://web/openExternalApp?url=${encodeURIComponent(currentUrl)}`;
    return true;
  }
  
  // For other in-app browsers, we can't always force open, 
  // but for Android we can try the intent scheme.
  if (ua.includes("instagram") || ua.includes("facebook") || ua.includes("line")) {
    if (ua.includes("android")) {
      window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
      return true;
    }
  }

  return false;
};
