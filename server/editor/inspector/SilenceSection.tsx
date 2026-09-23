import { useMutation } from "@tanstack/react-query";
import { AudioLines, Scissors } from "lucide-react";
import { useForm } from "react-hook-form";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { postJson } from "../api";
import * as ops from "../ops";
import { Field } from "./controls";

/** Mức cắt: lặng ít nhất bao lâu mới cắt, dưới bao nhiêu dB coi là lặng, chừa lề bao nhiêu quanh lời nói. */
const LEVELS = {
  light: { label: "Nhẹ — chỉ bỏ khoảng lặng dài (từ 1 giây)", minMs: 1000, noiseDb: -40, padMs: 200 },
  normal: { label: "Vừa — bỏ chỗ ngừng từ 0,6 giây", minMs: 600, noiseDb: -35, padMs: 150 },
  tight: { label: "Mạnh — nhịp nhanh kiểu TikTok (từ 0,35 giây)", minMs: 350, noiseDb: -32, padMs: 100 },
} as const;

type Level = keyof typeof LEVELS;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Cắt khoảng lặng của một khối có tiếng (cảnh video, video trên timeline, đoạn âm thanh): server dò bằng ffmpeg,
 * ở đây hiện trước sẽ cắt bao nhiêu, bấm Cắt mới đổi timeline — một bước hoàn tác được.
 * Panel đặt `key` theo file + vị trí của khối, nên khối đổi (kéo, cắt, đổi tốc độ) thì kết quả dò cũ tự bỏ.
 */
export const SilenceSection: React.FC<{
  props: ShortProps;
  target: ops.SoundTarget;
  onRun: (result: ops.Result) => void;
  /** Tên tab trong bảng thuộc tính (Panel đọc). */
  "data-tab"?: string;
}> = ({ props, target, onRun }) => {
  const span = ops.soundSpanOf(props, target);
  const form = useForm<{ level: Level }>({ defaultValues: { level: "normal" } });
  const scan = useMutation({
    mutationFn: async ({ level }: { level: Level }) => {
      if (!span) throw new Error("Khối này không có tiếng.");
      const { minMs, noiseDb, padMs } = LEVELS[level];
      const range = ops.soundSourceRange(span);
      const { silences } = await postJson<{ silences: ops.Span[] }>("/api/media/silences", {
        src: span.src, fromMs: range.startMs, toMs: range.endMs, minMs, noiseDb,
      });
      return ops.silenceCuts(span, silences, padMs);
    },
  });
  if (!span) return null;

  const cuts = scan.data ?? null;
  const removed = cuts?.reduce((sum, c) => sum + c.endMs - c.startMs, 0) ?? 0;
  const length = span.endMs - span.startMs;

  return (
    <section className="in-sec">
      <h3><AudioLines size={16} aria-hidden /> Cắt khoảng lặng</h3>
      <p className="in-note">
        Bỏ chỗ im lặng, ngập ngừng trong lời nói — phần phía sau, phụ đề và chữ tự dồn lên theo. Cắt xong vẫn hoàn tác được.
      </p>
      <Field label="Mức cắt">
        {/* Đổi mức thì kết quả dò cũ không còn đúng. */}
        <select {...form.register("level", { onChange: () => scan.reset() })} disabled={scan.isPending}>
          {(Object.keys(LEVELS) as Level[]).map((level) => <option key={level} value={level}>{LEVELS[level].label}</option>)}
        </select>
      </Field>
      <div className="in-actions">
        <button onClick={form.handleSubmit((values) => scan.mutate(values))} disabled={scan.isPending}>
          <AudioLines size={16} aria-hidden /> {scan.isPending ? "Đang dò…" : cuts ? "Dò lại" : "Tìm khoảng lặng"}
        </button>
      </div>
      {scan.error ? <p className="voice-err">{scan.error.message}</p> : null}
      {cuts ? (
        cuts.length > 0 ? (
          <>
            <p className="in-note">
              Tìm thấy <b>{cuts.length}</b> khoảng lặng · tổng <b>{seconds(removed)}</b> — khối còn {seconds(length - removed)} (từ {seconds(length)}).
            </p>
            <div className="in-actions">
              <button
                className="primary"
                onClick={() => {
                  onRun(ops.cutSilences(props, target, cuts));
                  scan.reset();
                }}
              >
                <Scissors size={16} aria-hidden /> Cắt {cuts.length} khoảng lặng
              </button>
            </div>
          </>
        ) : (
          <p className="in-note">Không thấy khoảng lặng nào đủ dài ở mức này — thử mức Mạnh hơn.</p>
        )
      ) : null}
    </section>
  );
};
