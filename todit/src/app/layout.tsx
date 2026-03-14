import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import Providers from "./providers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "ToDit - 모든 문서를 To-Do로 한 번에 변환",
  description: "안내문, 공지사항, 이미지 속 할 일을 AI가 즉시 추출하여 체크리스트로 만들어 드립니다.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "ToDit",
    description: "AI 기반 스마트 문서-할 일 변환 서비스",
    images: [
      {
        url: "/OG.png",
        width: 1200,
        height: 630,
        alt: "ToDit 서비스 소개 이미지",
      },
    ],
    type: "website",
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
