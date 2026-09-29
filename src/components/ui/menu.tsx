"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type MenuItem = { label: string; onSelect: () => void; disabled?: boolean };

export function Menu({ label, items, align = "start" }: { label: string; items: MenuItem[]; align?: "start" | "end" }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (dialog.current?.open && !wrapper.current?.contains(event.target as Node)) dialog.current.close();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && dialog.current?.open) {
        event.preventDefault();
        dialog.current.close();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggle() {
    if (dialog.current?.open) { dialog.current.close(); return; }
    dialog.current?.show();
    setOpen(true);
    dialog.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const enabled = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    if (!enabled.length) return;
    event.preventDefault();
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    enabled[(index + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length].focus();
  }

  return <div ref={wrapper} className="relative">
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={toggle}
      className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
      {label} <span aria-hidden="true">⌄</span>
    </button>
    <dialog ref={dialog} role="menu" aria-label={label} onKeyDown={onMenuKeyDown}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      className={`absolute top-full z-30 m-0 mt-1 min-w-48 rounded-xl border border-border bg-card p-1 text-foreground shadow-lg ${align === "end" ? "right-0 left-auto" : "left-0 right-auto"}`}>
      {items.map((item) => <button key={item.label} type="button" role="menuitem" disabled={item.disabled}
        onClick={() => { dialog.current?.close(); item.onSelect(); }}
        className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-foreground hover:bg-muted/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given disabled:opacity-60">
        {item.label}
      </button>)}
    </dialog>
  </div>;
}
