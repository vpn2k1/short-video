import { interpolate, useCurrentFrame } from "remotion";
import { FONTS, useLayout } from "../shared";
import type { Rect } from "./ImageFrame";
import { answerFontSize, EASE_BACK, EASE_IN_OUT, GREEN, GREEN_DARK, INK, paletteFrom, ramp, upper, type SceneInfo } from "./theme";
import { useVt } from "../../i18n/video";
import { OptionRows, ScoreRows } from "./ChoiceList";

/** Số frame lật thẻ. */
export const FLIP_FRAMES = 14;

type Props = {
  rect: Rect;
  info: SceneInfo;
  accent: string;
  questionSize: number;
  answerBase: number;
  /** Khoảng trống phía dưới dành cho đĩa đồng hồ đè lên mép thẻ. */
  padBottom: number;
  /** Cỡ chữ hàng lựa chọn / bảng xếp loại (chung cả video). */
  optionSize: number;
  /** Cỡ chữ câu dẫn tình huống phía trên câu hỏi trắc nghiệm. */
  contextSize: number;
};

/**
 * Thẻ câu hỏi trắng bo lớn. Nhãn câu (tag) là viên thuốc accent vắt qua mép trên, KHÔNG lật.
 * Tới revealFrame thẻ lật quanh trục Y: nửa đầu mặt trước quay 0→90°, nửa sau mặt xanh
 * đáp án quay -90→0°. Chỉ vẽ một mặt mỗi frame nên không cần backface-visibility.
 */
export const QuestionCard: React.FC<Props> = ({ rect, info, accent, questionSize, answerBase, padBottom, optionSize, contextSize }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const vt = useVt();
  const pal = paletteFrom(accent);
  const radius = 44 * unit;
  const reveal = info.revealFrame;
  // Trắc nghiệm / bảng xếp loại: không lật thẻ — đáp án tô xanh ngay trong danh sách.
  const list = info.options.length > 0 || info.scores.length > 0;
  const listRevealed = list && reveal !== null && frame >= reveal;

  const flip = reveal === null || list ? 0 : ramp(frame, reveal, FLIP_FRAMES, EASE_IN_OUT);
  const angle = flip * 180;
  const showBack = angle > 90;
  const faceAngle = showBack ? angle - 180 : angle;
  // Thẻ nhún lên khi lật cho có lực.
  const lift = Math.sin(flip * Math.PI);

  const textIn = ramp(frame, info.questionFrame, 12, EASE_BACK);
  const pillIn = ramp(frame, info.enter + 4, 12, EASE_BACK);
  const pillH = 64 * unit;
  const pillFont = 34 * unit;

  const answerText = info.answer ? upper(info.answer) : "";
  const answerSize = answerFontSize(answerText, answerBase, rect.w - 88 * unit);
  const answerIn = reveal === null ? 0 : ramp(frame, reveal + FLIP_FRAMES / 2, 12, EASE_BACK);

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        perspective: 2200 * unit,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          transform: `translateY(${-lift * 26 * unit}px) rotateY(${faceAngle}deg) scale(${1 + lift * 0.04})`,
          backgroundColor: showBack ? GREEN : "#ffffff",
          backgroundImage: showBack
            ? `linear-gradient(160deg, #4ade80 0%, ${GREEN} 45%, ${GREEN_DARK} 100%)`
            : "linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #f1eefb 100%)",
          boxShadow: `0 ${10 * unit}px 0 ${showBack ? "#0f5f2c" : "#d9d2f0"}, 0 ${34 * unit}px ${60 * unit}px -${20 * unit}px rgba(20,8,40,0.6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          padding: `${pillH * 0.6 + 12 * unit}px ${44 * unit}px ${padBottom}px`,
          overflow: "hidden",
        }}
      >
        {showBack ? (
          <div style={{ textAlign: "center", width: "100%" }}>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontWeight: 700,
                fontSize: 34 * unit,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 6 * unit,
                opacity: answerIn,
              }}
            >
              {vt("ĐÁP ÁN")}
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontWeight: 900,
                fontSize: answerSize,
                lineHeight: 1.12,
                paddingTop: answerSize * 0.08,
                color: "#ffffff",
                textShadow: `0 ${5 * unit}px 0 rgba(10,70,30,0.45)`,
                transform: `scale(${0.6 + 0.4 * answerIn})`,
                opacity: Math.min(1, answerIn * 2),
                overflowWrap: "break-word",
                whiteSpace: "pre-line",
              }}
            >
              {answerText}
            </div>
          </div>
        ) : list ? (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: 22 * unit,
            }}
          >
            <div
              style={{
                textAlign: "center",
                opacity: textIn,
                transform: `translateY(${(1 - textIn) * 24 * unit}px) scale(${0.92 + 0.08 * textIn})`,
              }}
            >
              {info.context ? (
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontWeight: 600,
                    fontSize: contextSize,
                    lineHeight: 1.25,
                    color: "rgba(29,23,64,0.68)",
                    marginBottom: 8 * unit,
                    overflowWrap: "break-word",
                  }}
                >
                  {info.context}
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontWeight: 800,
                  fontSize: questionSize,
                  lineHeight: 1.22,
                  paddingTop: questionSize * 0.06,
                  color: INK,
                  overflowWrap: "break-word",
                }}
              >
                {info.question}
              </div>
            </div>
            {info.options.length ? (
              <OptionRows info={info} accent={accent} fontSize={optionSize} />
            ) : (
              <ScoreRows info={info} accent={accent} fontSize={optionSize} />
            )}
          </div>
        ) : (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 800,
              fontSize: questionSize,
              lineHeight: 1.22,
              paddingTop: questionSize * 0.06,
              color: INK,
              textAlign: "center",
              width: "100%",
              opacity: textIn,
              transform: `translateY(${(1 - textIn) * 24 * unit}px) scale(${0.92 + 0.08 * textIn})`,
              overflowWrap: "break-word",
            }}
          >
            {info.question}
          </div>
        )}
        {/* Sọc chéo mờ ở mặt trước, sáng chéo khi đang lật */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            backgroundImage: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${0.5 * lift}) 50%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Nhãn câu — viên thuốc vắt qua mép trên */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -pillH / 2,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${-lift * 26 * unit}px) scale(${interpolate(pillIn, [0, 1], [0.4, 1])})`,
          opacity: Math.min(1, pillIn * 2),
        }}
      >
        <div
          style={{
            height: pillH,
            padding: `0 ${34 * unit}px`,
            borderRadius: pillH,
            display: "flex",
            alignItems: "center",
            gap: 12 * unit,
            backgroundColor: showBack || listRevealed ? GREEN_DARK : pal.deep,
            border: `${5 * unit}px solid #ffffff`,
            boxShadow: `0 ${8 * unit}px ${18 * unit}px -${6 * unit}px rgba(20,8,40,0.5)`,
            fontFamily: FONTS.sans,
            fontWeight: 800,
            fontSize: pillFont,
            color: "#ffffff",
            whiteSpace: "nowrap",
          }}
        >
          {info.label}
        </div>
      </div>
    </div>
  );
};
