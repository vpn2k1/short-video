import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneCrop, ShortProps } from "../../src/compositions/Short/schema";
import { isMediaCrop } from "../../src/scenes/CropBox";
import { api, postJson, type VoiceOption } from "./api";
import { ExportDialog } from "./editor/ExportDialog";
import { JobDialog } from "./editor/JobDialog";
import { KeysDialog } from "./editor/KeysDialog";
import { StagePanel } from "./editor/StagePanel";
import { TopBar } from "./editor/TopBar";
import { useAutosave } from "./editor/useAutosave";
import { useExport } from "./editor/useExport";
import { useHistory } from "./editor/useHistory";
import { useJobs } from "./editor/useJobs";
import { useLibSide } from "./editor/useLibSide";
import { useMediaActions } from "./editor/useMediaActions";
import { usePlayerSync } from "./editor/usePlayerSync";
import { useShortcuts } from "./editor/useShortcuts";
import { useToast } from "./editor/useToast";
import { FPS, type VersionInfo } from "./editor/constants";
import { Inspector } from "./Inspector";
import { usePanelWidths, useStageZoom } from "./layout";
import { MediaPanel, type LibrarySection } from "./MediaPanel";
import * as ops from "./ops";
import { refreshMedia, useMedia } from "./query";
import { Timeline, type EditPhase } from "./Timeline";

/**
 * Trình chỉnh sửa kiểu CapCut cho một video: xem trước bằng Remotion Player (chính
 * composition dùng để render, nên thấy gì xuất ra nấy), timeline nhiều track,
 * bảng thuộc tính, thư viện media. Mở đúng MỘT bản của video (server/versions.ts): thay đổi lưu vào
 * bản nháp của bản đó, xuất ra thành bản mới — bản gốc giữ nguyên.
 *
 * Logic tách ra các hook trong ./editor/: lưu (useAutosave), hoàn tác (useHistory), Player (usePlayerSync),
 * việc trên server (useJobs, useExport), thêm media (useMediaActions), phím tắt (useShortcuts).
 */
export const Editor: React.FC<{ slug: string; version: number | null }> = ({ slug, version: requestedVersion }) => {
  const [props, setProps] = useState<ShortProps | null>(null);
  /** Bản đang sửa (server đã quy "mới nhất" ra số); null = dự án chưa từng xuất. */
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  /** Giọng video đang dùng — ô chọn giọng mở ra đúng giọng này thay vì mặc định. */
  const [videoVoice, setVideoVoice] = useState<string | null>(null);
  const versionQuery = useRef("");
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ops.Selection>(null);
  const [pxPerSec, setPxPerSec] = useState(80);
  const { toast, flash } = useToast();
  const { data: media = [] } = useMedia();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  /** Watermark theo Cài đặt — không nằm trong props.json, chỉ gắn vào khung xem trước. */
  const [watermark, setWatermark] = useState<ShortProps["watermark"]>(null);
  /** Tăng lên để timeline tự thu phóng vừa khung (Shift+Z). */
  const [fitRequest, setFitRequest] = useState(0);
  /** Phím Alt+1…6: chuyển tab thư viện. */
  const [libRequest, setLibRequest] = useState<{ section: LibrarySection; at: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { libSide, toggleLibSide } = useLibSide();
  /** Mục đang mở khung crop (cảnh hay video trên timeline), null = không ở chế độ crop. */
  const [cropTarget, setCropTarget] = useState<ops.MotionSel | null>(null);
  const cropRef = useRef<ops.MotionSel | null>(null);
  cropRef.current = cropTarget;

  const propsRef = useRef<ShortProps | null>(null);
  propsRef.current = props;
  const selectionRef = useRef<ops.Selection>(null);
  selectionRef.current = selection;
  // Cập nhật ref ngay lập tức: nhấn rồi thả chuột nhanh thì bước "thả" (commit)
  // chạy trước khi React vẽ lại — đọc ref cũ sẽ xoá mất lựa chọn vừa bấm.
  const select = useCallback((next: ops.Selection) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);
  const dragBase = useRef<ShortProps | null>(null);

  const meta = useMemo(() => (props ? ops.videoMeta(props) : null), [props]);
  // Kéo thanh chia để đổi độ rộng thư viện / bảng thuộc tính; thu phóng khung xem trước.
  const mainRef = useRef<HTMLDivElement>(null);
  const panels = usePanelWidths(mainRef, Boolean(meta));
  const stage = useStageZoom(meta ? meta.width / meta.height : 9 / 16, Boolean(meta));
  const stageRef = useRef(stage);
  stageRef.current = stage;
  // Đang chọn vùng crop: xem trước cảnh đó ở dạng chưa crop để thấy toàn bộ khung.
  // Khung crop phủ cả khu xem trước và tự hiện toàn bộ file gốc — Player không cần bỏ crop.
  const previewProps = useMemo(() => (props ? { ...props, watermark } : props), [props, watermark]);

  // ---------- Player ----------
  const { frame, playing, playerRef, seek, nowMs } = usePlayerSync(meta);
  const timeMs = (frame / FPS) * 1000;

  // ---------- lưu ----------
  const { saveState, setSaveState, saveNow, scheduleSave, cancelSave } = useAutosave(slug, versionQuery, flash);

  // ---------- tải dữ liệu ----------
  useEffect(() => {
    if (!slug) {
      setLoadError("Thiếu tên video trong đường dẫn.");
      return;
    }
    api<{ props: ShortProps; title: string; version: number | null; latest: number | null; hasDraft: boolean; voice: string | null }>(
      `/api/editor/${slug}${requestedVersion !== null ? `?version=${requestedVersion}` : ""}`,
    )
      .then((d) => {
        // Mọi lần lưu/xuất sau đó gắn đúng bản này — kể cả khi trong lúc sửa có bản mới hơn ra đời.
        versionQuery.current = d.version !== null ? `?version=${d.version}` : "";
        setVersionInfo({ version: d.version, latest: d.latest, hasDraft: d.hasDraft });
        setVideoVoice(d.voice);
        // "Video gốc" vẽ cảnh y như một khối video nên gộp hàng Cảnh vào các hàng Video — mọi clip chỉnh như
        // nhau. Phong cách khác GIỮ hàng Cảnh: ảnh nằm trong khung trang trí của phong cách (ô truyện tranh,
        // polaroid, ảnh dán, Ken Burns…); gộp thì khung đó mất hẳn. Cần chỉnh tự do thì tách từng cảnh
        // thành video bằng nút "Tách thành video riêng" (liftSceneToOverlay).
        const unified = d.props.style === "plain" && ops.hasSceneMedia(d.props) ? ops.unifyScenes(d.props) : null;
        setProps(unified ? unified.props : d.props);
        setTitle(d.title);
        document.title = `Chỉnh sửa · ${d.title}`;
        if (unified) {
          scheduleSave(unified.props);
          flash("Đã gộp các cảnh thành video trên timeline — giờ mọi clip chỉnh như nhau.");
        }
      })
      .catch((e: Error) => setLoadError(e.message));
    api<{ voices: { catalog: VoiceOption[] }; watermark?: ShortProps["watermark"] }>("/api/state")
      .then((d) => {
        setVoices(d.voices.catalog);
        setWatermark(d.watermark ?? null);
      })
      .catch(() => undefined);
  }, [slug, requestedVersion, scheduleSave, flash]);

  // ---------- lịch sử ----------
  const { historySize, commit, undo, redo } = useHistory({ propsRef, setProps, select, scheduleSave });

  const run = (result: ops.Result) => {
    const current = propsRef.current;
    if (!current) return;
    if (result.message) flash(result.message);
    if (result.props === current) return;
    commit(result.props, current, result.selection !== undefined ? result.selection : selectionRef.current);
  };

  // ---------- thao tác ----------
  const withProps = (fn: (current: ShortProps) => ops.Result) => {
    const current = propsRef.current;
    if (current) run(fn(current));
  };
  const split = () => withProps((p) => ops.splitAt(p, nowMs(), selectionRef.current));
  const del = () => withProps((p) => ops.deleteSelection(p, selectionRef.current));
  const trimHead = () => withProps((p) => ops.rippleDelete(p, 0, nowMs()));
  const trimTail = () => withProps((p) => ops.rippleDelete(p, nowMs(), ops.videoMeta(p).durationMs));
  const addText = () => withProps((p) => ({ ...ops.addText(p, nowMs()), message: "Đã thêm văn bản — kéo trên khung xem trước để đặt vị trí." }));
  const duplicateText = () => withProps((p) => {
    const sel = selectionRef.current;
    return sel?.type === "text" ? ops.duplicateText(p, sel.index) : { props: p, message: "Chọn một văn bản trước." };
  });
  const removeAllVoice = () => withProps((p) => ops.removeAllVoice(p));

  const {
    uploading, replaceOverlay, replaceOverlayFromFile, appendOverlay,
    onUseMedia, sceneMedia, sceneMediaFromFile, onDropMedia, onUpload,
  } = useMediaActions({ media, selectionRef, withProps, flash, nowMs });

  /** Nút ◆ trên thanh timeline: ghim / xoá mốc chuyển động cho cảnh hoặc lớp đang chọn. */
  const setKeyframe = (sel: ops.MotionSel) => withProps((p) => ops.setKeyframe(p, sel, nowMs()));
  const deleteKeyframe = (sel: ops.MotionSel) => withProps((p) => ops.deleteKeyframe(p, sel, nowMs()));

  /** Kéo khối cảnh lên hàng lớp chồng, hoặc nút trong bảng thuộc tính. */
  const liftScene = (index: number, track?: number) => {
    dragBase.current = null;
    withProps((p) => ops.liftSceneToOverlay(p, index, track));
  };

  /** Khung crop dùng chung cho cảnh và mọi video trên timeline. */
  const startCrop = (sel: ops.MotionSel) => {
    const current = propsRef.current;
    const item = current ? ops.motionItem(current, sel) : null;
    const src = item ? ops.mediaSrcOf(item) : null;
    if (!item || !src) {
      flash("Mục này chưa có ảnh/video để crop.");
      return;
    }
    playerRef.current?.pause();
    const t = nowMs();
    // Crop đọc khung hình của clip tại điểm cắt đầu — đưa đầu phát vào trong mục cho khớp.
    if (t < item.startMs || t >= item.endMs) seek(item.startMs + Math.min(500, (item.endMs - item.startMs) / 2));
    select(sel);
    setCropTarget(sel);
  };

  const applyCrop = (crop: SceneCrop | null) => {
    const sel = cropRef.current;
    setCropTarget(null);
    if (!sel) return;
    withProps((p) => {
      const name = ops.motionLabel(p, sel);
      return {
        props: sel.type === "scene" ? ops.updateScene(p, sel.index, { crop }) : ops.updateOverlay(p, sel.index, { crop }),
        selection: sel,
        message: !crop
          ? `Đã bỏ crop ${name}.`
          : isMediaCrop(crop)
            ? `Đã crop ${name} — lấy ${Math.round(crop.w * 100)}% × ${Math.round(crop.h * 100)}% ảnh gốc${crop.rotate ? `, xoay ${crop.rotate}°` : ""}.`
            : `Đã crop ${name}.`,
      };
    });
  };

  // ---------- việc trên server ----------
  const { job, setJob, jobRef, autoSubtitles, extractAudio, freezeFrame, detachSceneAudio, changeVoice } = useJobs({
    slug, versionQuery, propsRef, selectionRef, saveNow, cancelSave, commit, withProps, flash, nowMs, setVideoVoice,
  });

  const onTimelineEdit = (next: ShortProps, phase: EditPhase) => {
    if (phase === "start") {
      dragBase.current = propsRef.current;
      return;
    }
    if (phase === "live") {
      setProps(next);
      return;
    }
    const base = dragBase.current ?? next;
    dragBase.current = null;
    commit(next, base, selectionRef.current);
  };

  /** Bỏ bản nháp: nạp lại đúng bản đã xuất. */
  const discardDraft = async () => {
    if (!versionInfo?.hasDraft || !window.confirm(`Bỏ mọi thay đổi chưa xuất và quay về đúng bản ${versionInfo.version}?`)) return;
    cancelSave();
    try {
      await postJson(`/api/editor/${slug}/discard${versionQuery.current}`, {});
      setSaveState("saved");
      // Tải lại trang: lịch sử hoàn tác đang chứa thay đổi vừa bỏ.
      window.location.reload();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const { exp, setExp, expOpen, setExpOpen, expRef, expOpenRef, exportVideo, closeExport } = useExport({
    slug, versionQuery, propsRef, saveNow, cancelSave, flash,
  });

  // ---------- phím tắt ----------
  const { showKeys, setShowKeys } = useShortcuts({
    playerRef, propsRef, selectionRef, select, withProps, nowMs, seek, flash,
    split, del, undo, redo, addText, freezeFrame, trimHead, trimTail, duplicateText,
    saveNow, cancelSave, exportVideo, importRef, setFitRequest, setLibRequest, stageRef, setPxPerSec,
    jobRef, expRef, expOpenRef, setExpOpen, setExp, cropRef, setCropTarget,
  });

  // ---------- giao diện ----------
  if (loadError) {
    return (
      <div className="ed-center">
        <p>{loadError}</p>
        <a className="ed-btn" href={slug ? `/#/v/${slug}` : "/"}><ArrowLeft size={16} aria-hidden /> Quay lại</a>
      </div>
    );
  }
  if (!props || !meta) {
    return <div className="ed-center"><p>Đang mở trình chỉnh sửa…</p></div>;
  }

  return (
    <div className="ed">
      <TopBar
        slug={slug}
        title={title}
        versionInfo={versionInfo}
        saveState={saveState}
        onDiscardDraft={discardDraft}
        jobRunning={job.status === "running"}
        showKeys={showKeys}
        onToggleKeys={() => setShowKeys((v) => !v)}
        importRef={importRef}
        onUpload={onUpload}
        libSide={libSide}
        onToggleLibSide={toggleLibSide}
        exp={exp}
        expOpen={expOpen}
        onExport={exportVideo}
      />

      <div
        ref={mainRef}
        className={`ed-main ${libSide === "right" ? "lib-right" : ""}`}
        style={{
          "--left-w": `${libSide === "left" ? panels.widths.lib : panels.widths.insp}px`,
          "--right-w": `${libSide === "left" ? panels.widths.insp : panels.widths.lib}px`,
        } as React.CSSProperties}
      >
        {(["left", "right"] as const).map((side) => {
          const panel = (side === "left") === (libSide === "left") ? "lib" : "insp";
          return (
            <div
              key={side}
              className={`ed-split ${side}`}
              role="separator"
              aria-orientation="vertical"
              title={`Kéo để đổi độ rộng ${panel === "lib" ? "thư viện" : "bảng thuộc tính"} — nhấp đúp về mặc định`}
              onPointerDown={panels.startDrag(panel, side)}
              onDoubleClick={() => panels.reset(panel)}
            />
          );
        })}
        <MediaPanel
          sectionRequest={libRequest}
          media={media}
          aspect={props.aspect}
          onAiVideo={(path, assign) => {
            refreshMedia();
            if (assign) {
              onUseMedia({ path, name: path.split("/").pop() ?? path, kind: "video", bytes: 0, at: Date.now() });
            } else {
              flash("Đã tạo video — xem ở Ảnh › Video.");
            }
          }}
          onStock={(path, kind, action, credit) => {
            refreshMedia();
            const name = path.split("/").pop() ?? path;
            if (action === "music") {
              withProps((p) => ({ props: { ...p, music: path }, selection: { type: "music" }, message: `Nhạc nền: ${name} — ${credit}` }));
            } else if (action === "use") {
              void onUseMedia({ path, name, kind: kind === "image" ? "image" : kind === "video" ? "video" : "audio", bytes: 0, at: Date.now() });
            } else {
              flash(`Đã lưu vào thư viện — ${credit}`);
            }
          }}
          selection={selection}
          uploading={uploading}
          currentMusic={props.music}
          onUse={onUseMedia}
          onUpload={onUpload}
          onAddText={(preset, label) =>
            withProps((p) => ({ ...ops.addText(p, nowMs(), preset), message: `Đã thêm “${label}” — kéo trên khung xem trước để đặt vị trí.` }))}
          onSetMusic={(path) =>
            withProps((p) => ({ props: { ...p, music: path }, selection: { type: "music" }, message: `Nhạc nền: ${path.split("/").pop()}` }))}
          onAppendOverlay={appendOverlay}
          onExtractAudio={(item) => extractAudio(item.path)}
          selectedVideoScene={
            selection?.type === "scene" && ops.isVideo(props.scenes[selection.index]?.image) ? selection.index : null
          }
          onDetachSceneAudio={detachSceneAudio}
          captions={props.captions}
          timeMs={timeMs}
          selectedCaption={selection?.type === "caption" ? selection.index : null}
          onSelectCaption={(index) => {
            select({ type: "caption", index });
            const caption = propsRef.current?.captions[index];
            if (caption) seek(caption.startMs);
          }}
          onCaptionText={(index, text) => {
            const current = propsRef.current;
            // Cùng khoá gộp với ô Nội dung trong bảng thuộc tính — gõ liên tục là một bước hoàn tác.
            if (current) commit(ops.updateCaption(current, index, { text }), current, selectionRef.current, `caption-text-${index}`);
          }}
          onInsertCaption={(index) => {
            const current = propsRef.current;
            if (!current) return;
            const result = ops.insertCaptionAfter(current, index, nowMs());
            run(result);
            const at = result.selection && "index" in result.selection ? result.props.captions[result.selection.index] : null;
            if (at) seek(at.startMs);
          }}
          onDeleteCaption={(index) => withProps((p) => ops.deleteCaption(p, index))}
          onAddCaptionLines={(lines) => withProps((p) => ops.addCaptionLines(p, lines, nowMs()))}
          onImportCaptions={(cues, opts) => withProps((p) => ops.importCaptions(p, cues, nowMs(), opts))}
        />

        <StagePanel
          stage={stage}
          meta={meta}
          props={props}
          previewProps={previewProps}
          playerRef={playerRef}
          playing={playing}
          timeMs={timeMs}
          selection={selection}
          onSelect={select}
          onEdit={onTimelineEdit}
          cropTarget={cropTarget}
          onApplyCrop={applyCrop}
          onCancelCrop={() => setCropTarget(null)}
        />

        <aside className="ed-insp">
          <Inspector
            props={props}
            selection={selection}
            media={media}
            voices={voices}
            videoVoice={videoVoice}
            onChange={(next, key) => {
              const current = propsRef.current;
              if (current) commit(next, current, selectionRef.current, key);
            }}
            onSelect={select}
            onDelete={del}
            onSplit={split}
            onDuplicateText={duplicateText}
            onVoice={changeVoice}
            onRemoveAllVoice={removeAllVoice}
            onDetachAudio={detachSceneAudio}
            onStartCrop={startCrop}
            onLiftScene={liftScene}
            onAutoSubtitles={autoSubtitles}
            timeMs={timeMs}
            onSeek={seek}
            onRun={run}
            uploading={uploading}
            onReplaceMedia={replaceOverlay}
            onReplaceFile={replaceOverlayFromFile}
            onSceneMedia={sceneMedia}
            onSceneFile={sceneMediaFromFile}
            onOpenLibrary={(section) => setLibRequest({ section, at: Date.now() })}
          />
        </aside>
      </div>

      <Timeline
        props={props}
        durationMs={meta.durationMs}
        timeMs={timeMs}
        pxPerSec={pxPerSec}
        selection={selection}
        canUndo={historySize.past > 0}
        canRedo={historySize.future > 0}
        onSelect={select}
        onSeek={seek}
        onEdit={onTimelineEdit}
        onSplit={split}
        onDelete={del}
        onUndo={undo}
        onRedo={redo}
        onAddText={addText}
        onTrimHead={trimHead}
        onTrimTail={trimTail}
        onZoom={setPxPerSec}
        onDetachAudio={detachSceneAudio}
        onFreezeFrame={freezeFrame}
        onDropMedia={onDropMedia}
        onLiftScene={liftScene}
        onSetKeyframe={setKeyframe}
        onDeleteKeyframe={deleteKeyframe}
        fitRequest={fitRequest}
      />

      {showKeys ? <KeysDialog onClose={() => setShowKeys(false)} /> : null}

      {toast ? <div className="ed-toast" role="status">{toast}</div> : null}

      {job.status !== "idle" ? <JobDialog job={job} onClose={() => setJob({ status: "idle" })} /> : null}

      {expOpen && exp.status !== "idle" && job.status === "idle" ? (
        <ExportDialog slug={slug} exp={exp} onBackground={() => setExpOpen(false)} onClose={closeExport} />
      ) : null}
    </div>
  );
};
