"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import IosKakaoModalProvider from "@/components/IosKakaoModalProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = "투딧 | ToDit";
    return () => {
      document.title = originalTitle;
    };
  }, []);

  return (
    <IosKakaoModalProvider>
      <SessionProvider>{children}</SessionProvider>
    </IosKakaoModalProvider>
  );
}
