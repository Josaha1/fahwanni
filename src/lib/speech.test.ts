import { describe, expect, it } from "vitest";
import { toSpeech } from "./speech";

const th = [
  "ฟ้าวันนี้ · กรุงเทพมหานคร",
  "29° ฝนฟ้าคะนองเล็กน้อย (รู้สึกเหมือน 34°)",
  "วันนี้ 25–29° โอกาสฝน 75%",
  "PM2.5 14.8 (ดีมาก)",
  "• ระวังพายุฝนฟ้าคะนอง หลีกเลี่ยงที่โล่งแจ้ง",
].join("\n");

describe("toSpeech", () => {
  it("reads Thai symbols as words and drops the title line", () => {
    const text = toSpeech(th, "th");
    expect(text).not.toContain("ฟ้าวันนี้ ·");
    expect(text).toContain("29 องศา ฝนฟ้าคะนองเล็กน้อย รู้สึกเหมือน 34 องศา");
    expect(text).toContain("วันนี้ 25 ถึง 29 องศา โอกาสฝน 75 เปอร์เซ็นต์");
    expect(text).toContain("ฝุ่นพีเอ็มสองจุดห้า 14.8 ดีมาก");
    expect(text).toContain("ระวังพายุฝนฟ้าคะนอง");
    expect(text).not.toMatch(/[°%•()]/);
  });

  it("reads English with sentence breaks", () => {
    const text = toSpeech("Today's Sky · Bangkok\n29° Thunderstorm\nToday 25-29° rain 75%", "en");
    expect(text).toBe("29 degrees Thunderstorm. Today 25 to 29 degrees rain 75 percent");
  });

  it("is empty for a title-only text", () => {
    expect(toSpeech("ฟ้าวันนี้ · ภูเก็ต", "th")).toBe("");
  });
});
