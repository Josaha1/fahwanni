"use client";

import { useId, useState } from "react";
import { useT } from "@/i18n/client";

export function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: string[][] }) {
  const t = useT();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return <div className="mt-1">
    <button type="button" className="min-h-11 underline underline-offset-2" aria-expanded={expanded} aria-controls={id}
      onClick={() => setExpanded((open) => !open)}>{t(expanded ? "ซ่อนตาราง" : "ดูเป็นตาราง")}</button>
    <div id={id} hidden={!expanded} className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((column) => <th key={column} scope="col" className="border-b px-2 py-1 font-semibold">{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0
          ? <th key={column} scope="row" className="border-b px-2 py-1 font-medium">{cell}</th>
          : <td key={column} className="border-b px-2 py-1">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
