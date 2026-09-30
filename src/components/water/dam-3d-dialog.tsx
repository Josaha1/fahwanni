"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useLite } from "@/hooks/use-lite";
import { useT } from "@/i18n/client";
import type { DamHistory } from "@/lib/dams/history";
import type { Dam } from "@/lib/dams/types";
import { DamSection } from "./dam-section";

type SectionProps = React.ComponentProps<typeof DamSection>;
const PlaceholderContext = createContext<SectionProps | null>(null);

function ScenePlaceholder() {
  const props = useContext(PlaceholderContext);
  return props && <DamSection {...props} />;
}

const Dam3D = dynamic(() => import("./dam-3d").then((module) => module.Dam3D).catch(() => DamSection), {
  ssr: false,
  loading: () => <ScenePlaceholder />,
});

let historyRequest: Promise<DamHistory | null> | null = null;
function loadHistory() {
  // All dam rows share the same report, including an in-flight request.
  historyRequest ??= fetch("/api/dams-history")
    .then((response) => { if (!response.ok) throw new Error("dam history unavailable"); return response.json() as Promise<DamHistory>; })
    .catch(() => null);
  return historyRequest;
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): "light" | "dark" {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" || theme === "night" ? "dark" : "light";
}

function hasWebGL() {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch { return false; }
}

function DamScene({ dam, history }: { dam: Dam; history?: DamHistory | null }) {
  const { lite, reducedMotion } = useLite();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const [webgl] = useState(hasWebGL);
  const [fallback, setFallback] = useState(false);
  const props = { dam, history, theme };
  return <PlaceholderContext.Provider value={props}>
    {!lite && !reducedMotion && webgl && !fallback
      ? <Dam3D {...props} reducedMotion={reducedMotion} onFallback={() => setFallback(true)} />
      : <DamSection {...props} />}
  </PlaceholderContext.Provider>;
}

export function Dam3DDialog({ dam, damsHistory, className }: {
  dam: Dam; damsHistory?: DamHistory | null; className?: string;
}) {
  const t = useT();
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<DamHistory | null>(null);
  const name = t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh;

  useEffect(() => {
    if (!open || damsHistory || history) return;
    let active = true;
    void loadHistory().then((data) => { if (active) setHistory(data); });
    return () => { active = false; };
  }, [open, damsHistory, history]);

  return <>
    <button ref={trigger} type="button" className={className} aria-haspopup="dialog"
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>{t("ดูแบบ 3 มิติ")}</button>
    <dialog ref={dialog} aria-labelledby={titleId}
      className="m-auto max-h-[80dvh] w-[min(560px,calc(100vw-24px))] overflow-auto rounded-[20px] border border-border bg-card p-3 text-foreground shadow-xl backdrop:bg-black/35"
      onKeyDown={(event) => event.stopPropagation()}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold">{name} · {t("ดูแบบ 3 มิติ")}</h2>
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border"
          aria-label={t("ปิด")} onClick={() => dialog.current?.close()}>✕</button>
      </div>
      {open && <DamScene dam={dam} history={damsHistory ?? history} />}
    </dialog>
  </>;
}
