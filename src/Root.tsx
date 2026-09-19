import { Composition, Folder } from "remotion";
import "./index.css";
import { FPS, HEIGHT, WIDTH } from "./constants";
import { calculateShortMetadata, Short } from "./compositions/Short";
import { defaultShortProps } from "./compositions/Short/defaultProps";
import { shortSchema } from "./compositions/Short/schema";
import { LongVideo } from "./compositions/LongVideo";
import { Explainer } from "./compositions/Explainer";
import { NewComposition } from "./NewComposition";
import { calculateCoverMetadata, Cover, coverSchema, defaultCoverProps } from "./compositions/Cover";

/** Ba composition dùng chung một schema — khác nhau ở lớp phủ, không ở dữ liệu. */
const shared = {
  schema: shortSchema,
  defaultProps: defaultShortProps,
  calculateMetadata: calculateShortMetadata,
  durationInFrames: FPS * 15,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Video">
        <Composition id="Short" component={Short} {...shared} />
        <Composition id="LongVideo" component={LongVideo} {...shared} />
        <Composition id="Explainer" component={Explainer} {...shared} />
      </Folder>
      {/* Ảnh bìa: một khung tĩnh, kích thước theo props.aspect (calculateCoverMetadata). */}
      <Composition
        id="Cover"
        component={Cover}
        schema={coverSchema}
        defaultProps={defaultCoverProps}
        calculateMetadata={calculateCoverMetadata}
        durationInFrames={1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="NewComposition"
        component={NewComposition}
        durationInFrames={492}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
