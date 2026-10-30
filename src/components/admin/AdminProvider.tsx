"use client";

import { createContext, useContext } from "react";

interface AdminContextValue {
  admin: { id: string; email: string; name: string; role: string };
  csrfToken: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({
  admin,
  csrfToken,
  children,
}: AdminContextValue & { children: React.ReactNode }) {
  return (
    <AdminContext.Provider value={{ admin, csrfToken }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside AdminProvider");
  return value;
}
