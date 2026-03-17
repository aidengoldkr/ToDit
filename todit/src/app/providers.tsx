"use client";

import { SessionProvider } from "next-auth/react";
import IosKakaoModalProvider from "@/components/IosKakaoModalProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <IosKakaoModalProvider>
      <SessionProvider>{children}</SessionProvider>
    </IosKakaoModalProvider>
  );
}
