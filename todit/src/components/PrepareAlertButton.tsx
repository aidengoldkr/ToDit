"use client";

import type { ReactNode } from "react";

type PrepareAlertButtonProps = {
  className?: string;
  children: ReactNode;
};

export default function PrepareAlertButton({
  className,
  children,
}: PrepareAlertButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.alert("준비 중 입니다.")}
    >
      {children}
    </button>
  );
}
