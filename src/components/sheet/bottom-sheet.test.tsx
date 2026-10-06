import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import type { motion } from "motion/react";
import { LocaleProvider } from "@/i18n/client";
import { BottomSheet } from "./bottom-sheet";

const { state, animate } = vi.hoisted(() => ({
  state: { props: null as ComponentProps<typeof motion.section> | null, y: 500 }, animate: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(initial === 0 ? 844 : initial) };
});
vi.mock("motion/react", () => ({
  motion: { section: (props: ComponentProps<typeof motion.section>) => { state.props = props; return <section>{props.children as ReactNode}</section>; } },
  useDragControls: () => ({ start: vi.fn() }),
  useMotionValue: () => ({ get: () => state.y, set: (value: number) => { state.y = value; } }),
  animate,
}));

it("lets reduced-motion users drag between detents and snaps without a spring", () => {
  const onChange = vi.fn();
  renderToStaticMarkup(<LocaleProvider locale="th"><BottomSheet detent="half" onChange={onChange} reducedMotion><p>ข้อมูล</p></BottomSheet></LocaleProvider>);
  const props = state.props!;
  expect(props.drag).toBe("y");
  expect(props.dragListener).toBe(false);
  expect(props.dragMomentum).toBe(false);
  expect(props.dragConstraints).toEqual({ top: 844 * 0.04, bottom: 484 });
  props.onDragEnd!({} as MouseEvent, { velocity: { x: 0, y: -1200 }, point: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });
  expect(onChange).toHaveBeenCalledWith("half");
  expect(animate).toHaveBeenCalledWith(expect.anything(), 844 * 0.45, { duration: 0 });
});
