import { useEffect, useRef, useState } from "react";
import { ASPECT_IDS, ASPECTS } from "../../src/aspects";
import { api, mediaDurationMs, postJson, uploadFile, type MediaItem } from "./api";

type Picked = { path: string; name: string; kind: "image" | "video" };

const IMAGE_SECONDS = 3;

/**
 * Màn hình ✂️ Edit video mới: chọn tỉ lệ, tải lên / chọn video & ảnh, sắp thứ tự rồi mở
 * trình chỉnh sửa. Không cần kịch bản hay API key.
 */
export const NewProject: React.FC = () => {
  const [title, setTitle] = useState("");
  const [aspect, setAspect] = useState<string>("9:16");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => api<{ items: MediaItem[] }>("/api/media").then((d) => setMedia(d.items)).catch(() => undefined);
  useEffect(() => {
    document.title = "Edit video mới · AI Video Studio";
    refresh();
  }, []);

  const visual = media.filter((m) => m.kind !== "audio");
  const isPicked = (path: string) => picked.some((p) => p.path === path);

  const toggle = (m: MediaItem) => {
    if (m.kind === "audio") return;
    setPicked((list) => (isPicked(m.path) ? list.filter((p) => p.path !== m.path) : [...list, { path: m.path, name: m.name, kind: m.kind as Picked["kind"] }]));
  };

  const move = (index: number, delta: number) => {
    setPicked((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
      setPicked((list) => [...list, ...added]);
      if (!title && accepted[0]) setTitle(accepted[0].name.replace(/\.\w+$/, "").slice(0, 60));
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const withDurations = await Promise.all(
        picked.map(async (p) => ({
          path: p.path,
          durationMs: p.kind === "video" ? await mediaDurationMs(`/public/${p.path}`, "video") : IMAGE_SECONDS * 1000,
        })),
      );
      const { slug } = await postJson<{ slug: string }>("/api/editor/new", { title, aspect, media: withDurations });
      location.hash = slug;
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="np">
      <div className="np-card">
        <header className="np-head">
          <a className="ed-btn ghost" href="/">‹ Trang chủ</a>
          <h1>✂️ Dự án chỉnh sửa mới</h1>
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
                <li key={p.path}>
                  <em>{i + 1}</em>
                  <span className="np-thumb">
                    {p.kind === "video" ? <video src={`/public/${p.path}#t=0.5`} muted preload="metadata" /> : <img src={`/public/${p.path}`} alt="" />}
                  </span>
                  <span className="np-name">{p.kind === "video" ? "🎬 " : "🖼 "}{p.name}</span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label="Xuống">↓</button>
                  <button onClick={() => setPicked((list) => list.filter((x) => x.path !== p.path))} aria-label="Bỏ">✕</button>
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
                <button key={m.path} className={isPicked(m.path) ? "on" : ""} onClick={() => toggle(m)} title={m.path}>
                  {m.kind === "video" ? <video src={`/public/${m.path}#t=0.5`} muted preload="metadata" /> : <img src={`/public/${m.path}`} alt="" loading="lazy" />}
                  {m.kind === "video" ? <i>🎬</i> : null}
                  {isPicked(m.path) ? <em>{picked.findIndex((p) => p.path === m.path) + 1}</em> : null}
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
                <button key={id} className={aspect === id ? "on" : ""} onClick={() => setAspect(id)}>
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
          <input value={title} maxLength={60} placeholder="Video mới" onChange={(e) => setTitle(e.target.value)} />
        </label>

        {error ? <p className="err">{error}</p> : null}

        <div className="np-actions">
          <button className="ed-btn primary" onClick={create} disabled={creating || uploading}>
            {creating ? "Đang tạo…" : picked.length ? `Bắt đầu chỉnh sửa (${picked.length} cảnh) →` : "Bắt đầu với dự án trống →"}
          </button>
        </div>
      </div>
    </div>
  );
};
