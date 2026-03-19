import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../styles/globals.css";
import Providers from "./providers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import InAppRedirectHandler from "@/components/InAppRedirectHandler";

export const metadata: Metadata = {
  metadataBase: new URL('https://todit.app'),
  title: "투딧 - ToDit | 사진 한 장으로 끝내는, 맞춤형 To-Do 생성",
  description: "사진 한 장으로 끝내는, 맞춤형 To-Do 생성",
  keywords: ["투딧", "ToDit", "To-Do", "할일", "할일관리", "할일생성", "할일추천", "할일목록", "이미지 todo", "수행평가 todo", "학교생활 todo", "업무 todo", "이미지 todo", "이미지 투두", "사진으로 계획", "수행평가 계획", "자동 일정 생성기"],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "투딧 | ToDit",
    description: "사진 한 장으로 끝내는, 맞춤형 To-Do 생성",
    url: "https://todit.app",
    siteName: "ToDit",
    images: [
      {
        url: "/OG.png",
        width: 1200,
        height: 630,
        alt: "사진 한 장으로 끝내는, 맞춤형 To-Do 생성",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "투딧 | ToDit",
    description: "사진 한 장으로 끝내는, 맞춤형 To-Do 생성",
    images: ["/OG.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9143389587385709"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const setting = localStorage.getItem('theme');
                if (setting === 'dark' || !setting) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          <InAppRedirectHandler />
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", overflowX: "hidden" }}>
            <Navbar />
            <main style={{ flex: 1, width: "100%" }}>{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
