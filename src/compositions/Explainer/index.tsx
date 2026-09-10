import { StepTracker } from "../../components/StepTracker";
import type { ShortProps } from "../Short/schema";
import { Short } from "../Short";

export { calculateShortMetadata as calculateExplainerMetadata } from "../Short";

/**
 * Hướng dẫn từng bước: dùng lại bộ khung của Short, thêm dãy chấm chỉ bước hiện tại.
 */
export const Explainer: React.FC<ShortProps> = (props) => (
  <>
    <Short {...props} />
    <StepTracker scenes={props.scenes} accent={props.accent} />
  </>
);
