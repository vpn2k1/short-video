import { AbsoluteFill } from "remotion";

/**
 * Nhiễu "tuyết" của TV: feTurbulence xám, đẩy tương phản cho ra hạt đen trắng gắt.
 * `frequency` dạng "x y" — x nhỏ, y lớn cho ra vệt ngang như băng bị rè.
 * `id` phải khác nhau giữa các lớp cùng hiện để filter không trùng tên.
 */
export const Static: React.FC<{
  id: string;
  seed: number;
  opacity: number;
  frequency?: string;
  contrast?: number;
  blend?: React.CSSProperties["mixBlendMode"];
}> = ({ id, seed, opacity, frequency = "0.9 0.7", contrast = 2.4, blend = "normal" }) => {
  const filterId = `retro-static-${id}-${seed}`;
  const intercept = -(contrast - 1) / 2;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: blend, pointerEvents: "none" }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={1} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope={contrast} intercept={intercept} />
            <feFuncG type="linear" slope={contrast} intercept={intercept} />
            <feFuncB type="linear" slope={contrast} intercept={intercept} />
            <feFuncA type="linear" slope={0} intercept={1} />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
};
