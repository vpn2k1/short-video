import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { CaptionPanel } from "./inspector/CaptionPanel";
import { ClipPanel } from "./inspector/ClipPanel";
import type { VoiceFields } from "./inspector/controls";
import { MusicPanel } from "./inspector/MusicPanel";
import { OverlayPanel } from "./inspector/OverlayPanel";
import { ProjectPanel } from "./inspector/ProjectPanel";
import { ScenePanel } from "./inspector/ScenePanel";
import { useSubtitleAi } from "./inspector/SubtitleAiSection";
import { TextPanel } from "./inspector/TextPanel";
import type { InspectorProps as Props } from "./inspector/types";

/** Bảng thuộc tính bên phải — nội dung đổi theo mục đang chọn trên timeline. */
export const Inspector: React.FC<Props> = ({
  props, selection, media, voices, videoVoice, onChange, onSelect, onDelete, onSplit, onDuplicateText, onVoice, onRemoveAllVoice, onDetachAudio,
  timeMs, onSeek, onRun,
  onStartCrop, onLiftScene, onAutoSubtitles,
  uploading, onReplaceMedia, onReplaceFile, onSceneMedia, onSceneFile, onOpenLibrary,
}) => {
  // Mở ra đúng giọng video đang dùng — trước đây luôn là "linh", bấm "Đổi giọng toàn bộ" là đọc lại bằng giọng khác.
  // `values`: biết giọng của video (tải xong, hoặc vừa đổi giọng toàn bộ) thì ô chọn giọng về đúng giọng đó.
  // Chưa biết giọng của video: lấy giọng "Tự động" của máy này (không mặc định Linh — nhiều máy không có giọng đó).
  const autoVoice = voices.find((v) => v.auto && v.lang === (props.language ?? "vi"))?.key
    ?? voices.find((v) => v.usable !== false && !v.paidPlan)?.key ?? "";
  const voiceForm = useForm<VoiceFields>({ values: { voice: videoVoice ?? autoVoice } });
  /** Lỗi khi đổi Lấp đầy/Vừa khung của cảnh (không đọc được kích thước file). */
  const [fitError, setFitError] = useState<string | null>(null);
  useEffect(() => setFitError(null), [selection]);
  // Tuỳ chọn phụ đề tự động + dịch — giữ ở đây để đổi mục đang chọn vẫn nhớ.
  const sub = useSubtitleAi();

  const base = { props, onChange, onSelect };

  if (selection?.type === "text") {
    return <TextPanel {...base} index={selection.index} onDelete={onDelete} onSplit={onSplit} onDuplicateText={onDuplicateText} />;
  }

  if (selection?.type === "caption") {
    return (
      <CaptionPanel {...base} index={selection.index} voices={voices} onDelete={onDelete} onSplit={onSplit} onVoice={onVoice}
        voiceForm={voiceForm} />
    );
  }

  if (selection?.type === "scene") {
    return (
      <ScenePanel
        {...base}
        index={selection.index}
        media={media}
        onDelete={onDelete}
        onSplit={onSplit}
        onDetachAudio={onDetachAudio}
        onStartCrop={onStartCrop}
        onLiftScene={onLiftScene}
        onAutoSubtitles={onAutoSubtitles}
        timeMs={timeMs}
        onSeek={onSeek}
        onRun={onRun}
        uploading={uploading}
        onSceneMedia={onSceneMedia}
        onSceneFile={onSceneFile}
        onOpenLibrary={onOpenLibrary}
        sub={sub}
        fitError={fitError}
        setFitError={setFitError}
      />
    );
  }

  if (selection?.type === "overlay") {
    return (
      <OverlayPanel
        {...base}
        index={selection.index}
        media={media}
        onDelete={onDelete}
        onSplit={onSplit}
        onStartCrop={onStartCrop}
        timeMs={timeMs}
        onSeek={onSeek}
        onRun={onRun}
        uploading={uploading}
        onReplaceMedia={onReplaceMedia}
        onReplaceFile={onReplaceFile}
        onOpenLibrary={onOpenLibrary}
        fitError={fitError}
        setFitError={setFitError}
      />
    );
  }

  if (selection?.type === "clip") {
    return <ClipPanel {...base} index={selection.index} onDelete={onDelete} onSplit={onSplit} onAutoSubtitles={onAutoSubtitles} onRun={onRun} sub={sub} />;
  }

  if (selection?.type === "music") {
    return <MusicPanel {...base} onDelete={onDelete} media={media} />;
  }

  return (
    <ProjectPanel
      props={props}
      onChange={onChange}
      media={media}
      voices={voices}
      onVoice={onVoice}
      onRemoveAllVoice={onRemoveAllVoice}
      onAutoSubtitles={onAutoSubtitles}
      sub={sub}
      voiceForm={voiceForm}
    />
  );
};
