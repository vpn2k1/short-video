import { Player, type PlayerRef } from "@remotion/player";
import { Maximize, Minus, Pause, Play, Plus } from "lucide-react";
import { Short } from "../../../src/compositions/Short";
import type { SceneCrop, ShortProps } from "../../../src/compositions/Short/schema";
import { fmt } from "../api";
import { CropOverlay } from "../CropOverlay";
import type { useStageZoom } from "../layout";
import * as ops from "../ops";
import { StageOverlay } from "../StageOverlay";
import type { EditPhase } from "../Timeline";
import { FPS, MOD } from "./constants";

type Props = {
  stage: ReturnType<typeof useStageZoom>;
  meta: ReturnType<typeof ops.videoMeta>;
  props: ShortProps;
  /** props + watermark theo Cài đặt — chỉ gắn vào khung xem trước. */
  previewProps: ShortProps | null;
  playerRef: React.RefObject<PlayerRef | null>;
  playing: boolean;
  timeMs: number;
  selection: ops.Selection;
  onSelect: (next: ops.Selection) => void;
  onEdit: (next: ShortProps, phase: EditPhase) => void;
  cropTarget: ops.MotionSel | null;
  onApplyCrop: (crop: SceneCrop | null) => void;
  onCancelCrop: () => void;
};

/** Khu xem trước: Remotion Player + lớp kéo chữ/khối (StageOverlay), thanh phát, khung crop. */
export const StagePanel: React.FC<Props> = ({
  stage, meta, props, previewProps, playerRef, playing, timeMs, selection, onSelect, onEdit, cropTarget, onApplyCrop, onCancelCrop,
}) => {
  // Mục đang crop (cảnh hay lớp) — chỉ mở khung crop khi mục đó thật sự có ảnh/video.
  const cropItem = cropTarget ? ops.motionItem(props, cropTarget) : null;

  return (
    <section className="ed-stage">
      <div ref={stage.viewRef} className={`ed-view ${stage.zoom > 1 ? "zoomed" : ""}`} onPointerDown={(e) => stage.beginPan(e, () => onSelect(null))}>
      <div
        ref={stage.playerBoxRef}
        className="ed-player"
        style={stage.playerSize
          ? { width: stage.playerSize.width, height: stage.playerSize.height }
          : { aspectRatio: `${meta.width} / ${meta.height}` }}
      >
        <Player
          ref={playerRef}
          component={Short}
          inputProps={previewProps ?? props}
          durationInFrames={meta.durationInFrames}
          compositionWidth={meta.width}
          compositionHeight={meta.height}
          fps={FPS}
          controls={false}
          clickToPlay
          doubleClickToFullscreen
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
        {cropTarget === null ? (
          <StageOverlay
            props={props}
            compositionWidth={meta.width}
            compositionHeight={meta.height}
            timeMs={timeMs}
            selection={selection}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ) : null}
      </div>
      </div>
      <div className="ed-pbar">
        <span className="ed-tc"><b>{fmt(timeMs)}</b> / {fmt(meta.durationMs)}</span>
        <button className="ed-play" onClick={() => playerRef.current?.toggle()} title="Phát / dừng (Space)" aria-label={playing ? "Dừng" : "Phát"}>
          {playing ? (
            <Pause size={18} fill="currentColor" aria-hidden />
          ) : (
            <Play size={18} fill="currentColor" aria-hidden />
          )}
        </button>
        <span className="ed-pbar-r">
          <span className="ed-zoom" role="group" aria-label="Thu phóng khung xem trước">
            <button onClick={() => stage.zoomBy(0.8)} title={`Thu nhỏ khung xem trước (${MOD} −)`} aria-label="Thu nhỏ"><Minus size={16} aria-hidden /></button>
            <button className="ed-zoom-v" onClick={() => stage.zoomTo(1)} title={`Vừa khung (${MOD} 0) — ${MOD} + lăn chuột để phóng tại con trỏ`}>
              {stage.zoom === 1 ? "Vừa" : `${Math.round(stage.zoom * 100)}%`}
            </button>
            <button onClick={() => stage.zoomBy(1.25)} title={`Phóng to khung xem trước (${MOD} =)`} aria-label="Phóng to"><Plus size={16} aria-hidden /></button>
          </span>
          <span className="ed-ratio">{props.aspect}</span>
          <button className="ed-icon" onClick={() => playerRef.current?.requestFullscreen()} title="Xem toàn màn hình" aria-label="Xem toàn màn hình"><Maximize size={16} aria-hidden /></button>
        </span>
      </div>
      {cropItem ? (
        <CropOverlay
          key={`${cropTarget?.type}-${cropTarget?.index}`}
          src={ops.mediaSrcOf(cropItem) ?? ""}
          trimStartMs={cropItem.trimStartMs}
          frameAspect={meta.width / meta.height}
          defaultFit={props.style === "plain" ? "contain" : "cover"}
          initial={cropItem.crop}
          onApply={onApplyCrop}
          onCancel={onCancelCrop}
        />
      ) : null}
    </section>
  );
};
