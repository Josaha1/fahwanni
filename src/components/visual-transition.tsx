"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Next's App Router supplies the canary React integration, which checks startViewTransition.
// Plain React (including server-rendered unit tests) and older browsers keep normal navigation.
export function VisualTransition({ name, children }: { name: string; children: ReactNode }) {
  return typeof ViewTransition !== "undefined" ? <ViewTransition name={name} share="auto" default="none">{children}</ViewTransition> : children;
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const participating = ["/", "/water", "/rain", "/map"].includes(pathname) || pathname.startsWith("/water/dam/");
  return typeof ViewTransition !== "undefined" && participating ? <ViewTransition key={pathname} name="tab-content" share="auto" enter="auto" default="none">
    <div>{children}</div>
  </ViewTransition> : children;
}
