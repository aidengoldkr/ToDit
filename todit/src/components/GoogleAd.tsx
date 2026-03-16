"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface GoogleAdProps {
  slot: string;
  format?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  responsive?: "true" | "false";
  style?: React.CSSProperties;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * Google AdSense Component for Next.js (App Router)
 * Manually inserts an ad unit and triggers the push() call.
 */
export default function GoogleAd({ 
  slot, 
  format = "auto", 
  responsive = "true", 
  style, 
  className 
}: GoogleAdProps) {
  const pathname = usePathname();
  const adRef = useRef<boolean>(false);

  useEffect(() => {
    // We want to trigger push() after the component is mounted and the ins tag is in the DOM.
    // In SPAs, we sometimes need to re-trigger this on route changes if the ad is inside a layout.
    // However, if the component unmounts and remounts, that's usually enough.
    
    const loadAd = () => {
      try {
        if (typeof window !== "undefined" && window.adsbygoogle) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          adRef.current = true;
        }
      } catch (err) {
        console.error("AdSense push error:", err);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(loadAd, 300);
    return () => clearTimeout(timer);
  }, [pathname, slot]); // Re-run if path or slot changes

  return (
    <div 
      key={`ad-${slot}-${pathname}`} // Unique key to force re-render on route change
      className={className} 
      style={{ overflow: "hidden", minHeight: "90px", ...style }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center", ...style }}
        data-ad-client="ca-pub-9143389587385709"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}
