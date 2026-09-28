"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { AirSnapshot } from "@/lib/air";
import type { Place } from "@/lib/place";
import { buildShareText } from "@/lib/share";
import { toSpeech } from "@/lib/speech";
import type { WeatherSnapshot } from "@/lib/weather/types";

/** Reads the current summary aloud with the device's voice; hidden when there is no voice for the language. */
export function SpeakButton({ snapshot, air, place }: { snapshot: WeatherSnapshot; air?: AirSnapshot; place: Place }) {
  const t = useT();
  const lang = t.locale === "th" ? "th" : "en";
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pick = () => setVoice(speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null);
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { speechSynthesis.removeEventListener("voiceschanged", pick); speechSynthesis.cancel(); };
  }, [lang]);

  if (!voice) return null;

  function toggle() {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(toSpeech(buildShareText(snapshot, air, place, t.locale, t), t.locale));
    utterance.voice = voice;
    utterance.lang = voice!.lang;
    utterance.rate = 0.95;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking}
      className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given aria-pressed:bg-given aria-pressed:text-white">
      {speaking ? t("หยุดอ่าน") : t("อ่านให้ฟัง")}
    </button>
  );
}
