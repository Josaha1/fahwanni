"use client";

import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useDragControls, useMotionValue, animate } from "motion/react";
import { useT } from "@/i18n/client";
import { detentOffsets, nextDetent, snapDetent, type Detent } from "./detents";

export function BottomSheet({ detent, onChange, reducedMotion, children }: {
  detent: Detent; onChange: (detent: Detent) => void; reducedMotion: boolean; children: ReactNode;
}) {
  const t = useT();
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const controls = useDragControls();
  const y = useMotionValue(0);
  const [height, setHeight] = useState(0);
  const initialDetent = useRef(detent);
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const update = () => setHeight(parent.clientHeight);
    y.set(detentOffsets(parent.clientHeight)[initialDetent.current]);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [y]);
  const offsets = detentOffsets(height);
  useEffect(() => {
    const animation = animate(y, detentOffsets(height)[detent], reducedMotion
      ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 });
    if (body.current) body.current.scrollTop = 0;
    return () => animation.stop();
  }, [detent, height, reducedMotion, y]);
  return <motion.section ref={ref} className="home-sheet" data-detent={detent} aria-label={t("สถานการณ์น้ำท่วมตอนนี้")}
    style={{ y }} drag="y" dragControls={controls} dragListener={false}
    dragConstraints={{ top: offsets.full, bottom: offsets.peek }} dragElastic={0.05} dragMomentum={false}
    onDragStart={() => { dragged.current = true; }}
    onDragEnd={(_, info) => {
      const next = snapDetent(y.get(), info.velocity.y, offsets);
      onChange(next);
      animate(y, offsets[next], reducedMotion
        ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 });
    }}>
    <button type="button" className="home-grab" aria-controls={id} aria-expanded={detent !== "peek"}
      aria-label={t("เปลี่ยนระดับรายละเอียด: {level}", { level: t(detent === "peek" ? "ทั่วไป" : detent === "half" ? "อาสา" : "เจ้าหน้าที่") })}
      onPointerDown={(event) => { dragged.current = false; controls.start(event); }}
      onClick={() => { if (!dragged.current) onChange(nextDetent(detent)); }}
      onKeyDown={(event) => {
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          onChange(event.key === "Home" ? "full" : event.key === "End" ? "peek" : event.key === "ArrowUp" ? detent === "peek" ? "half" : "full" : detent === "full" ? "half" : "peek");
        }
      }}><span aria-hidden="true" /></button>
    <div ref={body} id={id} className="home-sheet-body" style={{ height: height ? height - offsets[detent] - 28 : undefined }}>{children}</div>
  </motion.section>;
}
