import { ReactNode } from "react";
import { Navigation } from "./Navigation";

interface LayoutProps {
  children: ReactNode;
  hideNavigation?: boolean;
}

export function Layout({ children, hideNavigation = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className={hideNavigation ? "" : "pb-20"}>{children}</main>
      {!hideNavigation && <Navigation />}
    </div>
  );
}
