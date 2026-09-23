import { Leaf, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { followJob, postJson } from "../api";
import { useZodForm } from "../form";
import { useAiVideoModels, type BudgetScope } from "../query";

type AiState =
  | { status: "idle" }
  | { status: "running"; line: string }
  | { status: "done"; path: string }
  | { status: "error"; message: string };

const usd = (value: number) => `$${value.toFixed(2)}`;

const aiVideoSchema = z.object({
  prompt: z.string().trim().min(1),
  /** Rỗng = model mặc định của server. */
  model: z.string(),
  seconds: z.number(),
  assign: z.boolean(),
});

/**
 * Tạo clip từ mô tả. Chạy nền trên server (vài phút) — form vẫn dùng được phần
 * khác của trình chỉnh sửa trong lúc chờ, nên không dùng lớp phủ chặn màn hình.
 */
export const AiVideoForm: React.FC<{
  aspect: string;
  target: string;
  onDone: (path: string, assign: boolean) => void;
}> = ({ aspect, target, onDone }) => {
  const catalog = useAiVideoModels();
  const models = catalog.data?.models ?? null;
  const freeMode = Boolean(catalog.data?.freeMode);
  const loadError = catalog.error?.message ?? null;
  const form = useZodForm(aiVideoSchema, { defaultValues: { prompt: "", model: "", seconds: 5, assign: true } });
  const model = form.watch("model") || catalog.data?.defaultModel || "";
  const seconds = form.watch("seconds");
  const hasPrompt = form.watch("prompt").trim() !== "";
  const [state, setState] = useState<AiState>({ status: "idle" });
  /** Đã bấm "Tạo video", đang chờ xác nhận — mỗi lần tạo là một lượt tính tiền nên không gửi ngay. */
  const [confirming, setConfirming] = useState<z.output<typeof aiVideoSchema> | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  if (loadError) return <p className="ai-note err" style={{ padding: "0 10px" }}>{loadError}</p>;
  if (!models) return <p className="md-hint">Đang tải danh sách model…</p>;

  const available = models.filter((m) => m.available);
  if (freeMode) {
    return (
      <div className="ai">
        <p className="ai-note">
          <Leaf size={14} aria-hidden /> <b>Chế độ Miễn phí</b> đang bật — video AI tính tiền theo clip nên đã tắt. Dùng ảnh/clip miễn phí trong thư viện,
          hoặc tắt chế độ này ở trang chính › Cài đặt.
        </p>
      </div>
    );
  }
  if (available.length === 0) {
    return (
      <div className="ai">
        <p className="ai-note">
          Chưa có key tạo video. Về trang chính › Cài đặt, dán một trong các key:
        </p>
        <ul className="ai-note" style={{ paddingLeft: 18 }}>
          {[...new Map(models.map((m) => [m.env, m.providerLabel])).entries()].map(([env, label]) => (
            <li key={env}>{label} — <code>{env}</code></li>
          ))}
        </ul>
      </div>
    );
  }

  const current = available.find((m) => m.key === model) ?? available[0];
  const duration = current.durations.includes(seconds)
    ? seconds
    : [...current.durations].sort((a, b) => Math.abs(a - seconds) - Math.abs(b - seconds))[0];
  const running = state.status === "running";
  /** Khoá các ô trong lúc chờ xác nhận — hộp xác nhận ghi đúng model và độ dài sẽ gửi. */
  const locked = running || confirming !== null;
  const estimate = current.usdPerSecond ? current.usdPerSecond * duration : null;

  // Hạn mức chi tiêu (Cài đặt › Chi phí): server mới là nơi chặn thật, ở đây báo trước cho khỏi bấm vô ích.
  const budget = catalog.data?.budget;
  const scopes = budget
    ? ([["hôm nay", budget.day], ["tháng này", budget.month]] as [string, BudgetScope][]).filter(([, s]) => s.limit !== null)
    : [];
  const overBudget = estimate === null
    ? scopes.length > 0
    : scopes.some(([, s]) => s.spent + estimate > (s.limit as number) + 1e-9);

  const generate = async ({ prompt }: z.output<typeof aiVideoSchema>) => {
    setState({ status: "running", line: "Đang gửi yêu cầu…" });
    try {
      const { jobId } = await postJson<{ jobId: string }>("/api/ai-video", {
        prompt, model: current.key, seconds: duration, aspect,
      });
      stopRef.current = followJob(
        jobId,
        (line) => setState({ status: "running", line }),
        (status, result, error) => {
          stopRef.current = null;
          // Chi tiêu vừa đổi — cập nhật số "đã dùng" trong hộp xác nhận lần sau.
          void catalog.refetch();
          if (status === "done") {
            const path = (result as { path: string }).path;
            setState({ status: "done", path });
            // Đọc lúc xong: đổi ô "gán cho…" trong lúc chờ vẫn có tác dụng.
            onDone(path, form.getValues("assign"));
          } else {
            setState({ status: "error", message: error ?? "Lỗi không rõ." });
          }
        },
      );
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  };

  return (
    <form className="ai" onSubmit={form.handleSubmit(setConfirming)}>
      <label>
        Mô tả cảnh (tiếng Anh cho kết quả tốt nhất)
        <textarea
          {...form.register("prompt")}
          placeholder="Slow dolly shot of a steaming bowl of pho on a wooden table, morning light, shallow depth of field"
          disabled={locked}
        />
      </label>
      <div className="ai-row">
        <label>
          Model
          {/* Hiện model / độ dài thực sự dùng (model thiếu key thì lấy model đầu tiên, độ dài lấy mức gần nhất). */}
          <Controller control={form.control} name="model" render={({ field }) => (
            <select {...field} value={current.key} disabled={locked}>
              {models.map((m) => (
                <option key={m.key} value={m.key} disabled={!m.available}>
                  {m.label} — {m.providerLabel}{m.available ? "" : " (thiếu key)"}
                </option>
              ))}
            </select>
          )} />
        </label>
        <label>
          Độ dài
          <Controller control={form.control} name="seconds" render={({ field }) => (
            <select {...field} value={duration} onChange={(e) => field.onChange(Number(e.target.value))} disabled={locked}>
              {current.durations.map((d) => <option key={d} value={d}>{d}s</option>)}
            </select>
          )} />
        </label>
      </div>
      <label className="ai-check">
        <input type="checkbox" {...form.register("assign")} />
        Xong thì gán cho {target}
      </label>
      <p className="ai-note">
        Khung {aspect} · tiếng AI tắt khi model cho phép
        {estimate !== null ? ` · ước tính ${usd(estimate)}` : " · giá theo bảng giá nhà cung cấp"}.
        Mỗi lần tạo là một lượt tính tiền.
      </p>
      {confirming ? (
        <div className="ai-confirm" role="group" aria-label="Xác nhận tạo video">
          <b>Tạo video AI — tính tiền</b>
          <p>{current.label} — {current.providerLabel} · {duration}s · khung {aspect}</p>
          <p className="ai-confirm-cost">
            {estimate !== null ? `Ước tính ${usd(estimate)}` : "Chưa có giá trong app — xem bảng giá của nhà cung cấp"}
          </p>
          {scopes.map(([name, s]) => (
            <small key={name}>Hạn mức {name}: đã dùng ~{usd(s.spent)} / {usd(s.limit as number)}</small>
          ))}
          {overBudget ? (
            <p className="ai-note err">
              {estimate === null
                ? "Đã đặt hạn mức chi tiêu mà model này chưa có giá — chọn model có giá, hoặc bỏ hạn mức trong Cài đặt › Chi phí."
                : "Clip này vượt hạn mức chi tiêu — nâng hạn mức trong Cài đặt › Chi phí, hoặc đợi sang ngày/tháng mới."}
            </p>
          ) : null}
          <div className="ai-confirm-foot">
            <button type="button" className="ghost" onClick={() => setConfirming(null)}>Huỷ</button>
            <button
              type="button"
              className="ai-go"
              autoFocus
              disabled={overBudget}
              onClick={() => {
                const values = confirming;
                setConfirming(null);
                void generate(values);
              }}
            >
              Xác nhận · tạo video
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" className="ai-go" disabled={running || !hasPrompt}>
          {running ? "Đang tạo…" : <><Sparkles size={18} aria-hidden /> Tạo video</>}
        </button>
      )}
      {state.status === "running" ? <p className="ai-note">{state.line} — thường mất 1–5 phút.</p> : null}
      {state.status === "error" ? <p className="ai-note err">{state.message}</p> : null}
      {state.status === "done" ? (
        <>
          <p className="ai-note">Đã lưu vào thư viện Ảnh › Video.</p>
          <div className="ai-result">
            <video src={`/public/${state.path}`} controls muted playsInline />
          </div>
        </>
      ) : null}
    </form>
  );
};
