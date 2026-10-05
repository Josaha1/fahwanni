"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { AirSnapshot } from "@/lib/air";
import type { Place } from "@/lib/place";
import { buildShareText } from "@/lib/share";
import { toSpeech } from "@/lib/speech";
import type { WeatherSnapshot } from "@/lib/weather/types";

type Props = { text: string; snapshot?: never; air?: never; place?: never }
  | { text?: never; snapshot: WeatherSnapshot; air?: AirSnapshot; place: Place };

export function summaryVoice(voices: readonly SpeechSynthesisVoice[], lang: string) {
  return voices.find((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === lang) ?? null;
}

/** Reads the current summary aloud; hidden when there is no voice for the language. */
export function SpeakButton({ text, snapshot, air, place }: Props) {
  const t = useT();
  const lang = t.locale === "th" ? "th" : "en";
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pick = () => setVoice(summaryVoice(speechSynthesis.getVoices(), lang));
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { speechSynthesis.removeEventListener("voiceschanged", pick); speechSynthesis.cancel(); };
  }, [lang]);

  if (!voice) return null;

  function toggle() {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text ?? toSpeech(buildShareText(snapshot, air, place, t.locale, t), t.locale));
    utterance.voice = voice;
    utterance.lang = text !== undefined ? (t.locale === "th" ? "th-TH" : "en") : voice!.lang;
    utterance.rate = 0.95;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking}
      className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given aria-pressed:bg-given aria-pressed:text-white">
      {speaking ? t("หยุดอ่าน") : (text !== undefined ? t("ฟังสรุป") : t("อ่านให้ฟัง"))}
    </button>
  );
}
