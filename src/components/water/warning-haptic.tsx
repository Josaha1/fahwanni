"use client";

import { useEffect, useRef } from "react";
import { buzzNewWarnings } from "@/lib/water/warning-haptics";

export function WarningHaptic({ ids }: { ids: readonly string[] }) {
  const marker = useRef<HTMLSpanElement>(null);
  const key = JSON.stringify(ids);
  useEffect(() => {
    const element = marker.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (document.hidden || !entries.some((entry) => entry.isIntersecting)) return;
      buzzNewWarnings(JSON.parse(key));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [key]);
  return <span ref={marker} aria-hidden="true" className="block h-px w-px" />;
}
