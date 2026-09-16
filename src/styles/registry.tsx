import type { ShortProps } from "../compositions/Short/schema";
import type { StyleId } from "./meta";
import { CaptionStyle } from "./caption";
import { VoxStyle } from "./vox";
import { KineticStyle } from "./kinetic";
import { DocumentaryStyle } from "./documentary";
import { WhiteboardStyle } from "./whiteboard";
import { TechStyle } from "./tech";
import { PlainStyle } from "./plain";
import { BoldStyle } from "./bold";
import { ChatStyle } from "./chat";
import { NewsStyle } from "./news";
import { RetroStyle } from "./retro";
import { CinematicStyle } from "./cinematic";
import { ComicStyle } from "./comic";
import { SocialStyle } from "./social";
import { QuizStyle } from "./quiz";
import { RankingStyle } from "./ranking";

/** Phong cách → component vẽ. Thêm phong cách mới: thêm id vào meta.ts và một dòng ở đây. */
export const STYLE_COMPONENTS: Record<StyleId, React.FC<ShortProps>> = {
  caption: CaptionStyle,
  vox: VoxStyle,
  kinetic: KineticStyle,
  documentary: DocumentaryStyle,
  whiteboard: WhiteboardStyle,
  tech: TechStyle,
  plain: PlainStyle,
  bold: BoldStyle,
  chat: ChatStyle,
  news: NewsStyle,
  retro: RetroStyle,
  cinematic: CinematicStyle,
  comic: ComicStyle,
  social: SocialStyle,
  quiz: QuizStyle,
  ranking: RankingStyle,
};
