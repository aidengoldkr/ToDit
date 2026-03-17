"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import IosKakaoModal from "./IosKakaoModal";

interface IosKakaoModalContextType {
  openModal: () => void;
  closeModal: () => void;
}

const IosKakaoModalContext = createContext<IosKakaoModalContextType | undefined>(undefined);

export const useIosKakaoModal = () => {
  const context = useContext(IosKakaoModalContext);
  if (!context) {
    throw new Error("useIosKakaoModal must be used within an IosKakaoModalProvider");
  }
  return context;
};

export default function IosKakaoModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <IosKakaoModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <IosKakaoModal isOpen={isOpen} onClose={closeModal} />
    </IosKakaoModalContext.Provider>
  );
}
