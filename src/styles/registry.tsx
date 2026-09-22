import type { ShortProps } from "../compositions/Short/schema";
import type { StyleId } from "./meta";
import { CaptionStyle } from "./caption";
import { VoxStyle } from "./vox";
import { KineticStyle } from "./kinetic";
import { DocumentaryStyle } from "./documentary";
import { WhiteboardStyle } from "./whiteboard";
import { TechStyle } from "./tech";
import { PlainStyle, PlainTop } from "./plain";
import { BoldStyle } from "./bold";
import { ChatStyle } from "./chat";
import { NewsStyle } from "./news";
import { RetroStyle } from "./retro";
import { CinematicStyle } from "./cinematic";
import { ComicStyle } from "./comic";
import { SocialStyle } from "./social";
import { QuizStyle } from "./quiz";
import { RankingStyle } from "./ranking";
import { PenStyle } from "./pen";
import { BookStyle } from "./book";
import { StorybookStyle } from "./storybook";
import { NeonStyle } from "./neon";
import { ScrapbookStyle } from "./scrapbook";
import { MagazineStyle } from "./magazine";
import { TimelineStyle } from "./timeline";
import { RecipeStyle } from "./recipe";
import { TerminalStyle } from "./terminal";
import { PixelStyle } from "./pixel";
import { VersusStyle } from "./versus";
import { LuxuryStyle } from "./luxury";
import { HorrorStyle } from "./horror";
import { AnimeStyle } from "./anime";
import { PodcastStyle } from "./podcast";
import { MapStyle } from "./map";
import { SportStyle } from "./sport";
import { FinanceStyle } from "./finance";
import { WatercolorStyle } from "./watercolor";
import { StoryStyle } from "./story";
import { BlueprintStyle } from "./blueprint";
import { FestiveStyle } from "./festive";
import { LiveshopStyle } from "./liveshop";
import { KaraokeStyle } from "./karaoke";
import { LyricsStyle } from "./lyrics";
import { VinylStyle } from "./vinyl";

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
  book: BookStyle,
  storybook: StorybookStyle,
  pen: PenStyle,
  neon: NeonStyle,
  scrapbook: ScrapbookStyle,
  magazine: MagazineStyle,
  timeline: TimelineStyle,
  recipe: RecipeStyle,
  terminal: TerminalStyle,
  pixel: PixelStyle,
  versus: VersusStyle,
  luxury: LuxuryStyle,
  horror: HorrorStyle,
  anime: AnimeStyle,
  podcast: PodcastStyle,
  map: MapStyle,
  sport: SportStyle,
  finance: FinanceStyle,
  watercolor: WatercolorStyle,
  story: StoryStyle,
  blueprint: BlueprintStyle,
  festive: FestiveStyle,
  liveshop: LiveshopStyle,
  karaoke: KaraokeStyle,
  lyrics: LyricsStyle,
  vinyl: VinylStyle,
};

/**
 * Phần của phong cách vẽ TRÊN lớp video chồng (MediaOverlays) thay vì dưới — tiêu đề, phụ đề. Trình chỉnh
 * sửa gộp cảnh thành video phủ kín khung; phần nào phong cách vẽ chung với cảnh sẽ bị video đó che.
 */
export const STYLE_TOP_LAYERS: Partial<Record<StyleId, React.FC<ShortProps>>> = {
  plain: PlainTop,
};
