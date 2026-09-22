import {
  ArrowDown, ArrowRight, ArrowUp, ChevronLeft, Clapperboard, Image as ImageIcon, Scissors, X,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { ASPECT_IDS, ASPECTS } from "../../src/aspects";
import { mediaDurationMs, postJson, uploadFile, type MediaItem } from "./api";
import { useZodForm } from "./form";
import { refreshMedia, useMedia } from "./query";

const IMAGE_SECONDS = 3;

/** Tên, khung và danh sách cảnh (theo thứ tự) của dự án mới. */
const projectSchema = z.object({
  title: z.string().trim().max(60, "Tên dự án tối đa 60 ký tự"),
  aspect: z.enum(ASPECT_IDS),
  media: z.array(z.object({ path: z.string(), name: z.string(), kind: z.enum(["image", "video"]) })),
});

type Picked = z.output<typeof projectSchema>["media"][number];

/**
 * Màn hình Edit video mới: chọn tỉ lệ, tải lên / chọn video & ảnh, sắp thứ tự rồi mở
 * trình chỉnh sửa. Không cần kịch bản hay API key.
 */
export const NewProject: React.FC = () => {
  const form = useZodForm(projectSchema, { defaultValues: { title: "", aspect: "9:16", media: [] } });
  const aspect = form.watch("aspect");
  const { fields: picked, append, remove, swap } = useFieldArray({ control: form.control, name: "media" });
  const { data: media = [] } = useMedia();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Edit video mới · AI Video Studio";
  }, []);

  const visual = media.filter((m) => m.kind !== "audio");
  const pickedIndex = (path: string) => picked.findIndex((p) => p.path === path);

  const toggle = (m: MediaItem) => {
    if (m.kind === "audio") return;
    const index = pickedIndex(m.path);
    if (index >= 0) remove(index);
    else append({ path: m.path, name: m.name, kind: m.kind });
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target >= 0 && target < picked.length) swap(index, target);
  };

  const upload = async (files: File[]) => {
    const accepted = files.filter((f) => /^(image|video)\//.test(f.type));
    if (accepted.length === 0) {
      setError("Chỉ nhận video hoặc ảnh.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const added: Picked[] = [];
      for (const file of accepted) {
        const res = await uploadFile(file);
        added.push({ path: res.path, name: file.name, kind: file.type.startsWith("video/") ? "video" : "image" });
      }
      append(added);
      if (!form.getValues("title") && accepted[0]) form.setValue("title", accepted[0].name.replace(/\.\w+$/, "").slice(0, 60));
      refreshMedia();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const create = useMutation({
    mutationFn: async ({ title, aspect, media: scenes }: z.output<typeof projectSchema>) => {
      const withDurations = await Promise.all(
        scenes.map(async (p) => ({
          path: p.path,
          durationMs: p.kind === "video" ? await mediaDurationMs(`/public/${p.path}`, "video") : IMAGE_SECONDS * 1000,
        })),
      );
      return postJson<{ slug: string }>("/api/editor/new", { title, aspect, media: withDurations });
    },
    // Đổi hash → main.tsx nạp lại trang vào trình chỉnh sửa; nút giữ trạng thái "Đang tạo…" tới lúc đó.
    onSuccess: ({ slug }) => { location.hash = slug; },
    onMutate: () => setError(null),
  });
  const creating = create.isPending || create.isSuccess;
  const submitError = create.error?.message ?? form.formState.errors.title?.message ?? null;

  return (
    <div className="np">
      <div className="np-card">
        <header className="np-head">
          <a className="ed-btn ghost" href="/"><ChevronLeft size={16} aria-hidden /> Trang chủ</a>
          <h1><Scissors size={20} aria-hidden /> Dự án chỉnh sửa mới</h1>
        </header>
        <p className="muted">Thêm video hoặc ảnh rồi cắt ghép, thêm chữ, nhạc trên timeline. Không cần API key.</p>

        <div
          className={`np-drop ${dragOver ? "drag" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); upload([...e.dataTransfer.files]); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        >
          <i>{uploading ? "…" : "＋"}</i>
          <b>{uploading ? "Đang tải lên…" : "Nhập video / ảnh"}</b>
          <span>Bấm để chọn file hoặc kéo thả vào đây · mp4, mov, webm, jpg, png, webp</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept="video/*,image/*"
            onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }}
          />
        </div>

        {picked.length > 0 ? (
          <div className="np-field">
            <span>Thứ tự cảnh ({picked.length})</span>
            <ol className="np-picked">
              {picked.map((p, i) => (
                <li key={p.id}>
                  <em>{i + 1}</em>
                  <span className="np-thumb">
                    {p.kind === "video" ? <video src={`/public/${p.path}#t=0.5`} muted preload="metadata" /> : <img src={`/public/${p.path}`} alt="" />}
                  </span>
                  <span className="np-name">{p.kind === "video" ? <Clapperboard size={14} aria-hidden /> : <ImageIcon size={14} aria-hidden />} {p.name}</span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên"><ArrowUp size={16} aria-hidden /></button>
                  <button onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label="Xuống"><ArrowDown size={16} aria-hidden /></button>
                  <button onClick={() => remove(i)} aria-label="Bỏ"><X size={16} aria-hidden /></button>
                </li>
              ))}
            </ol>
            <small className="muted">Ảnh mặc định {IMAGE_SECONDS} giây, video dài đúng thời lượng clip — đổi được trên timeline.</small>
          </div>
        ) : null}

        {visual.length > 0 ? (
          <div className="np-field">
            <span>Hoặc chọn từ thư viện</span>
            <div className="np-library">
              {visual.map((m) => (
                <button key={m.path} className={pickedIndex(m.path) >= 0 ? "on" : ""} onClick={() => toggle(m)} title={m.path}>
                  {m.kind === "video" ? <video src={`/public/${m.path}#t=0.5`} muted preload="metadata" /> : <img src={`/public/${m.path}`} alt="" loading="lazy" />}
                  {m.kind === "video" ? <i><Clapperboard size={14} aria-hidden /></i> : null}
                  {pickedIndex(m.path) >= 0 ? <em>{pickedIndex(m.path) + 1}</em> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="np-field">
          <span>Khung hình</span>
          <div className="np-aspects">
            {ASPECT_IDS.map((id) => {
              const a = ASPECTS[id];
              const scale = 34 / Math.max(a.width, a.height);
              return (
                <button key={id} type="button" className={aspect === id ? "on" : ""} onClick={() => form.setValue("aspect", id)}>
                  <i style={{ width: a.width * scale, height: a.height * scale }} />
                  <b>{id}</b>
                  <small>{a.label.split("—")[1]?.trim()}</small>
                </button>
              );
            })}
          </div>
        </div>

        <label className="np-field">
          <span>Tên dự án</span>
          <input {...form.register("title")} maxLength={60} placeholder="Video mới" />
        </label>

        {error ?? submitError ? <p className="err">{error ?? submitError}</p> : null}

        <div className="np-actions">
          <button className="ed-btn primary" onClick={form.handleSubmit((values) => create.mutate(values))} disabled={creating || uploading}>
            {creating ? "Đang tạo…" : <>{picked.length ? `Bắt đầu chỉnh sửa (${picked.length} cảnh)` : "Bắt đầu với dự án trống"} <ArrowRight size={18} aria-hidden /></>}
          </button>
        </div>
      </div>
    </div>
  );
};
