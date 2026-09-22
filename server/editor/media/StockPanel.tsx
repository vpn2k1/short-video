import { Clapperboard, Download, Music, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api, postJson } from "../api";
import { useStockProviders, type StockKind } from "../query";
import { STOCK_KINDS, stockOrientation } from "./helpers";

type StockItem = import("../../../scripts/stock").StockItem;

/**
 * Kho miễn phí: ảnh, video (Pexels, Pixabay), nhạc và hiệu ứng (Freesound CC0/CC-BY).
 * Tải về thư viện kèm ghi nguồn — server chỉ nhận (nhà cung cấp, loại, id) rồi tự hỏi lại link tải.
 */
export const StockPanel: React.FC<{
  aspect: string;
  target: string;
  onStock: (path: string, kind: StockKind, action: "use" | "music" | "save", credit: string) => void;
}> = ({ aspect, target, onStock }) => {
  const form = useForm<{ kind: StockKind; query: string }>({ defaultValues: { kind: "video", query: "" } });
  const kind = form.watch("kind");
  const hasQuery = form.watch("query").trim() !== "";
  /** Từ khoá của lần bấm Tìm gần nhất — "Xem thêm" tải tiếp đúng kết quả đang hiện, dù ô tìm đã gõ khác. */
  const searched = useRef("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const { data: providers = null } = useStockProviders();
  const [working, setWorking] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);


  const usable = providers?.filter((p) => p.kinds.includes(kind)) ?? [];
  const ready = usable.filter((p) => p.available);

  const search = async (query: string, nextPage: number) => {
    if (!query.trim()) return;
    searched.current = query;
    setBusy(true);
    setNote(null);
    try {
      const d = await api<{ items: StockItem[]; errors: string[] }>(`/api/stock/search?${new URLSearchParams({
        kind, q: query, page: String(nextPage), orientation: kind === "image" || kind === "video" ? stockOrientation(aspect) : "any",
      })}`);
      setItems((prev) => (nextPage === 1 ? d.items : [...prev, ...d.items]));
      setPage(nextPage);
      if (d.errors.length) setNote({ text: d.errors.join("\n"), error: true });
      else if (d.items.length === 0 && nextPage === 1) setNote({ text: "Không có kết quả — thử từ khoá tiếng Anh, ngắn hơn." });
    } catch (e) {
      setNote({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const take = async (item: StockItem, action: "use" | "music" | "save") => {
    const key = `${item.provider}-${item.id}`;
    setWorking(key);
    setNote({ text: "Đang tải về thư viện…" });
    try {
      const d = await postJson<{ path: string; credit: string; reused: boolean }>("/api/stock/download", {
        provider: item.provider, kind: item.kind, id: item.id,
      });
      onStock(d.path, item.kind, action, d.credit);
      setNote({ text: `${d.reused ? "Đã có sẵn trong thư viện" : "Đã tải"} · ${d.credit}` });
    } catch (e) {
      setNote({ text: (e as Error).message, error: true });
    } finally {
      setWorking(null);
    }
  };

  const preview = (item: StockItem) => {
    const el = audioRef.current;
    if (!el) return;
    const key = `${item.provider}-${item.id}`;
    if (playing === key) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = item.preview;
    el.play().catch(() => setPlaying(null));
    setPlaying(key);
  };

  const visual = kind === "image" || kind === "video";
  return (
    <div className="ai stock">
      <div className="md-filter">
        {STOCK_KINDS.map((k) => (
          <button key={k.id} className={kind === k.id ? "on" : ""} onClick={() => { form.setValue("kind", k.id); setItems([]); setNote(null); }}>{k.label}</button>
        ))}
      </div>
      {providers && ready.length === 0 ? (
        <p className="ai-note">
          Chưa có key {usable.map((p) => p.label).join(" hoặc ")} — lấy key <b>miễn phí</b> rồi điền ở trang chính › Cài đặt ›
          Miễn phí · Ảnh, clip & nhạc.
        </p>
      ) : (
        <>
          <form className="stock-search" onSubmit={form.handleSubmit(({ query }) => { (document.activeElement as HTMLElement | null)?.blur(); void search(query, 1); })}>
            <input type="search" {...form.register("query")} disabled={busy}
              placeholder={visual ? "vd: city night, coffee pour" : kind === "music" ? "vd: lofi, upbeat, cinematic" : "vd: whoosh, click, pop"} />
            <button type="submit" className="ai-go" disabled={busy || !hasQuery}>{busy ? "…" : "Tìm"}</button>
          </form>
          <p className="ai-note">
            {ready.map((p) => p.label).join(" + ")} · miễn phí, dùng thương mại được{kind === "music" || kind === "sfx" ? " (CC0/CC-BY)" : ""} ·
            tự ghi nguồn. Tìm bằng tiếng Anh cho nhiều kết quả hơn.
          </p>
        </>
      )}
      {note ? <p className={`ai-note ${note.error ? "err" : ""}`}>{note.text}</p> : null}

      {visual ? (
        <div className="md-grid">
          {items.map((item) => {
            const key = `${item.provider}-${item.id}`;
            return (
              <div key={key} className="md-tile" title={`${item.title} — ${item.author} (${item.provider})`}>
                <button className="md-tile-main" onClick={() => take(item, "use")} disabled={working !== null} aria-label={`Dùng cho ${target}`}>
                  <img src={item.preview} alt="" loading="lazy" draggable={false} />
                  {item.kind === "video" ? <i><Clapperboard size={14} aria-hidden /> {item.duration}s</i> : null}
                  <span>{working === key ? "Đang tải…" : `${item.provider} · ${item.author}`}</span>
                </button>
                <button className="md-tile-add" onClick={() => take(item, "save")} disabled={working !== null} title="Chỉ lưu vào thư viện" aria-label="Chỉ lưu vào thư viện"><Download size={14} aria-hidden /></button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="md-list">
          {items.map((item) => {
            const key = `${item.provider}-${item.id}`;
            return (
              <div key={key} className="md-row" title={`${item.title} — ${item.author} (${item.license})`}>
                <button className="md-play" onClick={() => preview(item)} aria-label="Nghe thử">{playing === key ? <Pause fill="currentColor" size={14} aria-hidden /> : <Play fill="currentColor" size={14} aria-hidden />}</button>
                <span><b>{item.title}</b><small>{item.duration}s · {item.author} · {item.license}</small></span>
                {item.kind === "music" ? (
                  <button className="md-bg" onClick={() => take(item, "music")} disabled={working !== null} title="Tải và đặt làm nhạc nền" aria-label="Tải và đặt làm nhạc nền"><Music size={14} aria-hidden /></button>
                ) : null}
                <button className="md-add" onClick={() => take(item, "use")} disabled={working !== null} title="Tải và thêm tại đầu phát">
                  {working === key ? "…" : "＋"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {items.length > 0 && !busy ? (
        <button className="btn-more" onClick={() => void search(searched.current, page + 1)}>Xem thêm</button>
      ) : null}
      <p className="ai-note">
        {visual
          ? <>Bấm ô: dùng cho {target} · <Download size={12} aria-hidden /> chỉ lưu vào thư viện.</>
          : <><Play size={12} aria-hidden /> nghe thử · <Music size={12} aria-hidden /> đặt làm nhạc nền · ＋ thêm tại đầu phát.</>}
      </p>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} hidden />
    </div>
  );
};
