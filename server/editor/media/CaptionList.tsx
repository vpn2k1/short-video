import { BookOpen, Clipboard, Download, File as FileIcon, FolderOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Caption } from "../../../src/compositions/Short/schema";
import { fmt } from "../api";
import {
  cuesDurationMs, EXAMPLE_SRT, EXAMPLE_TXT, EXAMPLE_TXT_TIME, FORMAT_LABELS,
  parseSubtitleFile, SUBTITLE_ACCEPT, type Cue, type ParsedSubtitles,
} from "../subtitle-import";
import { downloadSample } from "./helpers";

/**
 * Danh sách phụ đề kiểu CapCut: mỗi câu một dòng — bấm giờ để tua tới, gõ thẳng vào ô để sửa, Enter thêm câu
 * mới ngay bên dưới, ô trống bấm Backspace/Delete để xoá. "Dán nhiều dòng" biến mỗi dòng thành một câu.
 */
export const CaptionList: React.FC<{
  captions: Caption[];
  timeMs: number;
  selected: number | null;
  onSelect: (index: number) => void;
  onText: (index: number, text: string) => void;
  onInsert: (index: number | null) => void;
  onDelete: (index: number) => void;
  onAddLines: (lines: string[]) => void;
  onImport: (cues: Cue[], opts: { replace: boolean; shiftToPlayhead: boolean }) => void;
  /** File phụ đề người dùng thả vào panel. */
  dropped: File | null;
  onDroppedHandled: () => void;
}> = ({ captions, timeMs, selected, onSelect, onText, onInsert, onDelete, onAddLines, onImport, dropped, onDroppedHandled }) => {
  const listRef = useRef<HTMLDivElement>(null);
  /** Vừa thêm câu bằng Enter / nút ＋ — chờ danh sách vẽ lại rồi đưa con trỏ vào câu mới. */
  const focusNew = useRef(false);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const pasteLines = pasteText.split("\n").map((line) => line.trim()).filter(Boolean);
  const fileRef = useRef<HTMLInputElement>(null);
  /** File đã đọc xong, đang chờ người dùng xác nhận. */
  const [pending, setPending] = useState<{ name: string; parsed: ParsedSubtitles } | null>(null);
  const [replace, setReplace] = useState(false);
  const [shift, setShift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readSubtitleFile = async (file: File) => {
    setError(null);
    try {
      const parsed = parseSubtitleFile(await file.text());
      if (parsed.cues.length === 0) {
        setPending(null);
        setError(`Không đọc được câu nào trong ${file.name}. Xem ví dụ bên dưới để biết cách viết file.`);
        return;
      }
      setPasting(false);
      setReplace(false);
      setShift(false);
      setPending({ name: file.name, parsed });
    } catch {
      setPending(null);
      setError(`Không đọc được ${file.name} — file phải là văn bản (.srt, .vtt, .txt, .json).`);
    }
  };

  // Thả file vào panel khi đang ở tab Phụ đề.
  useEffect(() => {
    if (!dropped) return;
    void readSubtitleFile(dropped);
    onDroppedHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped]);

  const range = pending ? cuesDurationMs(pending.parsed.cues) : null;

  useEffect(() => {
    if (selected === null) return;
    const input = listRef.current?.querySelector<HTMLInputElement>(`input[data-caption="${selected}"]`);
    if (!input) return;
    input.scrollIntoView({ block: "nearest" });
    if (focusNew.current) {
      focusNew.current = false;
      input.focus();
    }
  }, [selected, captions.length]);

  const insert = (index: number | null) => {
    focusNew.current = true;
    onInsert(index);
  };

  return (
    <div className="cl">
      <div className="cl-bar">
        <button className="cl-add" onClick={() => insert(null)} title="Thêm câu tại đầu phát, ở một hàng phụ đề mới">＋ Thêm phụ đề</button>
        <button className={pasting ? "on" : ""} onClick={() => setPasting(!pasting)}><Clipboard size={16} aria-hidden /> Dán nhiều dòng</button>
        <button
          className={pending ? "on" : ""}
          onClick={() => fileRef.current?.click()}
          title="Nhập file .srt, .vtt, .txt hoặc .json — kéo thả file vào đây cũng được"
        >
          <FolderOpen size={16} aria-hidden /> Nhập file
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={SUBTITLE_ACCEPT}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readSubtitleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="cl-err">{error}</p> : null}

      {pending ? (
        <div className="cl-import">
          <p className="cl-import-head">
            <b><FileIcon size={14} aria-hidden /> {pending.name}</b>
            <small>
              {FORMAT_LABELS[pending.parsed.format]} · {pending.parsed.cues.length} câu
              {range ? ` · ${fmt(range.fromMs)} → ${fmt(range.toMs)}` : ""}
            </small>
          </p>
          {pending.parsed.notes.map((note) => <small key={note} className="cl-note">{note}</small>)}
          <label>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Thay toàn bộ {captions.length} câu đang có
          </label>
          {range ? (
            <label>
              <input type="checkbox" checked={shift} onChange={(e) => setShift(e.target.checked)} />
              Dời cả cụm về đầu phát ({fmt(timeMs)})
            </label>
          ) : null}
          <div className="cl-import-foot">
            <button className="ghost" onClick={() => setPending(null)}>Huỷ</button>
            <button
              onClick={() => {
                onImport(pending.parsed.cues, { replace, shiftToPlayhead: shift });
                setPending(null);
              }}
            >
              Thêm {pending.parsed.cues.length} câu
            </button>
          </div>
        </div>
      ) : null}

      {pasting ? (
        <div className="cl-paste">
          <textarea
            rows={5}
            value={pasteText}
            placeholder={"Mỗi dòng là một câu phụ đề\nDòng thứ hai\nDòng thứ ba"}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button
            disabled={pasteLines.length === 0}
            onClick={() => {
              onAddLines(pasteLines);
              setPasteText("");
              setPasting(false);
            }}
          >
            Thêm {pasteLines.length} câu
          </button>
        </div>
      ) : null}

      <p className="md-hint">＋ Thêm phụ đề: tạo hàng phụ đề mới · Enter: câu tiếp theo cùng hàng · ô trống + Backspace: xoá câu · bấm giờ để tua tới.</p>

      <details className="cl-help">
        <summary><BookOpen size={16} aria-hidden /> File phụ đề viết thế nào? (có file mẫu)</summary>
        <div className="cl-help-body">
          <p><b>Cách dễ nhất — file .txt, mỗi dòng một câu.</b> Không cần mốc giờ: các câu được rải nối tiếp nhau theo độ dài chữ, kéo trên timeline để chỉnh lại.</p>
          <pre>{EXAMPLE_TXT}</pre>
          <button onClick={() => downloadSample("phu-de-mau.txt", EXAMPLE_TXT)}><Download size={16} aria-hidden /> Tải mẫu .txt</button>

          <p><b>Có sẵn thời gian — file .srt hoặc .vtt</b> (xuất từ CapCut, YouTube, Premiere…). Giờ trong file được giữ nguyên.</p>
          <pre>{EXAMPLE_SRT}</pre>
          <button onClick={() => downloadSample("phu-de-mau.srt", EXAMPLE_SRT)}><Download size={16} aria-hidden /> Tải mẫu .srt</button>

          <p><b>Gõ tay kèm mốc giờ</b> cũng được — mỗi dòng bắt đầu bằng phút:giây.</p>
          <pre>{EXAMPLE_TXT_TIME}</pre>
          <p className="cl-note">Ngoài ra nhận .json dạng [{"{ \"text\": \"…\", \"startMs\": 0, \"endMs\": 2400 }"}]. Kéo thả file vào panel này cũng nhập được.</p>
        </div>
      </details>

      <div className="cl-list" ref={listRef}>
        {captions.map((c, k) => {
          const playing = timeMs >= c.startMs && timeMs < c.endMs;
          return (
            <div key={k} className={`cl-row ${selected === k ? "on" : ""} ${playing ? "playing" : ""}`}>
              <button className="cl-time" onClick={() => onSelect(k)} title={`${fmt(c.startMs)} → ${fmt(c.endMs)} · bấm để tua tới`}>
                {fmt(c.startMs)}
              </button>
              <span className="cl-track" title={`Hàng Phụ đề ${(c.track ?? 0) + 1}`}>P{(c.track ?? 0) + 1}</span>
              <input
                data-caption={k}
                className="cl-text"
                value={c.text}
                placeholder="Nhập phụ đề…"
                onFocus={() => { if (selected !== k) onSelect(k); }}
                onChange={(e) => onText(k, e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return; // đang gõ bộ gõ tiếng Việt (IME) — để yên
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insert(k);
                  } else if ((e.key === "Backspace" || e.key === "Delete") && c.text === "") {
                    e.preventDefault();
                    onDelete(k);
                  }
                }}
              />
              <button className="cl-del" onClick={() => onDelete(k)} title="Xoá câu này" aria-label={`Xoá phụ đề ${k + 1}`}><X size={14} aria-hidden /></button>
            </div>
          );
        })}
        {captions.length === 0 ? <p className="md-empty">Chưa có phụ đề. Bấm “＋ Thêm phụ đề” hoặc dán nhiều dòng.</p> : null}
      </div>
    </div>
  );
};
