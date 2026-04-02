"use client";

import { SessionProvider } from "next-auth/react";
import IosKakaoModalProvider from "@/components/IosKakaoModalProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <IosKakaoModalProvider>
        <SessionProvider>{children}</SessionProvider>
      </IosKakaoModalProvider>
    </QueryClientProvider>
  );
}
