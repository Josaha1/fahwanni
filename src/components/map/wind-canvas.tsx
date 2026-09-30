"use client";

import { useEffect, useRef } from "react";
import type { Map } from "maplibre-gl";
import { sampleField, type WindField } from "@/lib/wind/field";
import { WIND_BBOX } from "@/lib/wind/constants";
import { spawnArea, spawnParticle, speedColor, stepParticle, type Bounds, type Particle } from "@/lib/wind/particles";

interface Props {
  map: Map;
  field: WindField | null;
  animate: boolean;
  count: number;
}

/**
 * Canvas-2D wind overlay. Particles live in lon/lat and are projected every frame,
 * so they stay glued to the map; drawing pauses while the map moves.
 */
export function WindCanvas({ map, field, animate, count }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef(field);
  const redraw = useRef<(() => void) | null>(null);

  useEffect(() => {
    fieldRef.current = field;
    if (!animate) redraw.current?.();
  }, [field, animate]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let frame = 0;
    let moving = false;
    let area: Bounds = fieldRef.current?.bbox ?? WIND_BBOX;
    let zoom = map.getZoom();
    const sample = (lon: number, lat: number) => {
      const current = fieldRef.current;
      return current ? sampleField(current, lon, lat) : undefined;
    };
    const respawn = () => {
      const b = map.getBounds();
      const bbox = fieldRef.current?.bbox ?? WIND_BBOX;
      area = spawnArea(bbox, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      zoom = map.getZoom();
      particles = Array.from({ length: count }, () => spawnParticle(bbox, Math.random, area));
    };
    let particles: Particle[] = [];
    respawn();

    const resize = () => {
      const { clientWidth, clientHeight } = map.getContainer();
      el.width = Math.round(clientWidth * dpr);
      el.height = Math.round(clientHeight * dpr);
      el.style.width = `${clientWidth}px`;
      el.style.height = `${clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const clear = () => ctx.clearRect(0, 0, el.width, el.height);

    const drawArrows = () => {
      clear();
      const current = fieldRef.current;
      if (!current) return;
      ctx.lineWidth = 1.5;
      const [west, south, east, north] = current.bbox;
      for (let lat = south; lat <= north; lat += 2) {
        for (let lon = west; lon <= east; lon += 2) {
          const wind = sampleField(current, lon, lat);
          if (!wind) continue;
          const speed = Math.hypot(wind.u, wind.v);
          if (speed < 0.5) continue;
          const p = map.project([lon, lat]);
          const len = 8 + Math.min(speed, 15) * 1.2;
          const ux = wind.u / speed, uy = -wind.v / speed;
          const tipX = p.x + ux * len, tipY = p.y + uy * len;
          ctx.strokeStyle = speedColor(speed);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(tipX - ux * 5 - uy * 3, tipY - uy * 5 + ux * 3);
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - ux * 5 + uy * 3, tipY - uy * 5 - ux * 3);
          ctx.stroke();
        }
      }
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (moving) return;
      // Fade the previous frame to leave short trails.
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.2;
      particles = particles.map((p) => {
        const next = stepParticle(p, sample, Math.random, area, zoom);
        if (next.age === 0) return next;
        const wind = sample(p.lon, p.lat);
        const from = map.project([p.lon, p.lat]);
        const to = map.project([next.lon, next.lat]);
        ctx.strokeStyle = speedColor(wind ? Math.hypot(wind.u, wind.v) : 0);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        return next;
      });
    };

    const onMoveStart = () => { moving = true; clear(); };
    const onMoveEnd = () => { moving = false; clear(); respawn(); if (!animate) drawArrows(); };
    const onResize = () => { resize(); onMoveEnd(); };

    resize();
    redraw.current = drawArrows;
    map.on("movestart", onMoveStart);
    map.on("moveend", onMoveEnd);
    map.on("resize", onResize);
    if (animate) frame = requestAnimationFrame(tick);
    else drawArrows();

    return () => {
      cancelAnimationFrame(frame);
      map.off("movestart", onMoveStart);
      map.off("moveend", onMoveEnd);
      map.off("resize", onResize);
      redraw.current = null;
      clear();
    };
  }, [map, animate, count]);

  return <canvas ref={canvas} data-wind-canvas className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" />;
}
