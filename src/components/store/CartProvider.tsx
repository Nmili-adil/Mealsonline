"use client";

import { useEffect, useState } from "react";
import { CartDrawer } from "./CartDrawer";

/**
 * Wraps the app and mounts the slide-out cart drawer. Zustand persistence
 * hydrates on the client; the drawer renders only after hydration to avoid
 * SSR mismatches.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      {children}
      {mounted ? <CartDrawer /> : null}
    </>
  );
}
