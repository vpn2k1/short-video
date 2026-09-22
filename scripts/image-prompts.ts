/**
 * Mô tả hình cho AI vẽ ảnh (FLUX trên Cloudflare, Gemini) — một câu tiếng Anh cho mỗi cảnh.
 *
 * Trước đây prompt là nguyên văn "tiêu đề. lời đọc" tiếng Việt: FLUX không hiểu tiếng Việt (đã thử: "con mèo đen trên
 * ghế đỏ" ra ngôi chùa), và lời đọc là câu nói chứ không phải mô tả hình, nên ảnh lạc đề.
 * Ở đây nhờ model viết kịch bản đọc cả video rồi tả cụ thể từng cảnh. Kiểu ảnh KHÔNG để model tự chọn: mỗi phong cách
 * video có một kiểu cố định (IMAGE_LOOKS) — mặc định là ảnh chụp thật, cảnh chụp được ngoài đời, đúng sự thật.
 */
import { askJson, parseJson, type JsonReply } from "./llm-json";
import type { ProviderChoice, ScriptProvider } from "./generate-script";
import type { StyleId } from "../src/styles/meta";

export type SceneForPrompt = { lines: string[] };

type ImageLook = {
  /** photo: cảnh thật chụp được. illustration: tranh vẽ theo khung của phong cách. */
  kind: "photo" | "illustration";
  /** Cụm mô tả kiểu ảnh ghép vào cuối prompt — tiếng Anh, chỉ câu khẳng định. */
  look: string;
};

const PHOTO = "Realistic photograph, true-to-life colors, natural lighting, sharp focus, fine realistic detail, shot on a full-frame camera with a 35mm lens";

/**
 * Kiểu ảnh theo phong cách video. Hiệu ứng riêng (hạt phim, VHS, chỉnh màu điện ảnh, khung truyện) do phong cách tự
 * thêm lúc dựng — ảnh chỉ cần đúng chất liệu, không vẽ sẵn hiệu ứng để khỏi chồng hai lần.
 */
export const IMAGE_LOOKS: Record<StyleId, ImageLook> = {
  caption: { kind: "photo", look: PHOTO },
  bold: { kind: "photo", look: PHOTO },
  kinetic: { kind: "photo", look: PHOTO },
  plain: { kind: "photo", look: PHOTO },
  chat: { kind: "photo", look: PHOTO },
  social: { kind: "photo", look: PHOTO },
  quiz: { kind: "photo", look: PHOTO },
  ranking: { kind: "photo", look: PHOTO },
  documentary: { kind: "photo", look: "Documentary photograph, candid real moment, natural available light, authentic real-world details, realistic textures, shot on a full-frame camera" },
  news: { kind: "photo", look: "Photojournalism press photograph, realistic, eye-level, natural light, authentic real-world scene, sharp focus" },
  cinematic: { kind: "photo", look: "Cinematic film still, realistic, dramatic natural lighting, shallow depth of field, anamorphic lens, rich but true-to-life colors" },
  retro: { kind: "photo", look: "Realistic candid snapshot from the 1990s, film camera photo, slightly warm faded colors, period-accurate clothing and objects" },
  tech: { kind: "photo", look: "Clean realistic studio photograph, dark background, cool blue accent light, crisp modern detail" },
  vox: { kind: "photo", look: "Realistic editorial photograph, subject clearly separated against a plain light background, sharp focus" },
  comic: { kind: "illustration", look: "Comic book illustration, bold black ink outlines, flat vivid colors, halftone dot shading, expressive characters" },
  whiteboard: { kind: "illustration", look: "Hand-drawn black marker line drawing on white paper, simple clean sketch, a few soft colored marker accents" },
  book: { kind: "illustration", look: "Classic book illustration plate, detailed pen-and-ink drawing with soft watercolor wash, muted vintage palette" },
  storybook: { kind: "illustration", look: "Children's picture book illustration, soft gouache and watercolor, warm pastel colors, cute friendly characters, gentle rounded shapes" },
  pen: { kind: "photo", look: "Vintage photograph, warm faded film colors, soft natural light, gentle film grain, nostalgic candid moment" },
  neon: { kind: "photo", look: "Night photograph, glowing neon signs and city lights, deep blue and magenta tones, wet reflective streets, high contrast, cinematic" },
  scrapbook: { kind: "photo", look: "Warm candid snapshot, soft natural daylight, gentle film colors, casual personal moment, slightly faded like a printed photo" },
  magazine: { kind: "photo", look: "High-end editorial magazine photograph, polished studio or location lighting, clean composition, fashion-grade styling, crisp detail" },
  timeline: { kind: "photo", look: "Realistic archival-style photograph, period-accurate details, natural light, clear subject, documentary composition" },
  recipe: { kind: "photo", look: "Appetizing overhead food photograph, natural window light, rustic wooden table, fresh ingredients, shallow depth of field, vibrant true colors" },
  terminal: { kind: "photo", look: "Clean realistic tech photograph, dark background, cool green and cyan light, crisp modern detail, minimal composition" },
  pixel: { kind: "illustration", look: "16-bit pixel art game scene, crisp pixels, limited retro palette, clear readable sprites, side-view or top-down game style" },
  versus: { kind: "photo", look: "Clean realistic product-style photograph, single subject centered on a plain contrasting background, sharp focus, even studio light" },
  luxury: { kind: "photo", look: "Minimal luxury editorial photograph, soft diffused natural light, neutral beige and cream tones, generous negative space, refined textures" },
  horror: { kind: "photo", look: "Dark eerie photograph, dim moonlight or a single weak light source, deep shadows, cold desaturated tones, fog, unsettling empty places, no gore" },
  anime: { kind: "illustration", look: "Anime key visual, cel-shaded characters, clean line art, vivid saturated colors, dramatic sky, cinematic anime film style" },
  podcast: { kind: "photo", look: "Moody podcast studio photograph, warm key light, microphones and headphones, shallow depth of field, dark background" },
  map: { kind: "photo", look: "Travel photograph of a recognizable landmark or landscape, golden hour light, wide establishing shot, vivid true colors" },
  sport: { kind: "photo", look: "Dynamic sports action photograph, frozen motion, stadium lights, high shutter speed, intense energy, sharp detail" },
  finance: { kind: "photo", look: "Clean corporate finance photograph, trading screens or city skyline, cool blue light, crisp modern detail" },
  watercolor: { kind: "illustration", look: "Delicate watercolor painting, soft wet-on-wet washes, visible paper texture, gentle pastel palette, loose expressive brushwork" },
  story: { kind: "photo", look: "Casual smartphone photo, natural light, authentic everyday moment, vertical framing, slightly warm colors" },
  blueprint: { kind: "photo", look: "Clean technical product photograph, isolated object on plain background, even studio light, sharp mechanical detail" },
  festive: { kind: "photo", look: "Festive Vietnamese Lunar New Year photograph, red and gold decorations, lanterns, peach and apricot blossoms, warm joyful light" },
  liveshop: { kind: "photo", look: "Bright e-commerce product photograph, clean studio background, soft even lighting, appealing colors, sharp detail" },
  karaoke: { kind: "photo", look: "Music video still, cinematic concert or city-at-dusk scene, warm stage lights and soft bokeh, emotional atmosphere, room at the bottom for lyrics" },
  lyrics: { kind: "photo", look: "Album cover style photograph, one clear subject, rich saturated colors, soft moody light, simple composition that still reads when heavily blurred" },
  vinyl: { kind: "photo", look: "Square album cover photograph, centered subject that still reads inside a small circle, moody warm film tones, lofi atmosphere" },
};

/**
 * Kiểu vẽ người dùng tự chọn (nút "Kiểu vẽ" khi AI vẽ ảnh / tạo clip) — thắng kiểu ảnh cố định của phong cách.
 * Hiệu ứng dựng của phong cách (khung truyện, hạt phim…) vẫn giữ, chỉ chất liệu ảnh đổi.
 */
export const ART_STYLES = {
  photo: { label: "Ảnh thật", summary: "Ảnh chụp thật, đúng màu ngoài đời", kind: "photo", look: PHOTO },
  "3d": {
    label: "3D", summary: "Hoạt hình 3D kiểu phim chiếu rạp, khối mềm, ánh sáng dịu",
    kind: "illustration",
    look: "3D animated feature film style render, stylized characters with soft rounded shapes, soft global illumination, vibrant colors, high detail",
  },
  "2d": {
    label: "2D phẳng", summary: "Minh hoạ vector phẳng, hình khối gọn, màu trơn",
    kind: "illustration",
    look: "Flat 2D vector illustration, clean simple geometric shapes, solid flat colors, minimal shading, modern graphic design",
  },
  cartoon: {
    label: "Hoạt hình", summary: "Tranh hoạt hình viền đậm, màu tươi, dáng vui nhộn",
    kind: "illustration",
    look: "Cartoon illustration, bold clean outlines, bright saturated colors, playful exaggerated proportions, expressive faces",
  },
  anime: {
    label: "Anime", summary: "Tranh anime Nhật, nét sạch, tô bóng phẳng, nền vẽ kỹ",
    kind: "illustration",
    look: "Anime illustration, clean line art, cel shading, vivid colors, detailed painted background, Japanese animation style",
  },
  watercolor: {
    label: "Màu nước", summary: "Tranh màu nước mềm, loang nhẹ trên giấy",
    kind: "illustration",
    look: "Watercolor painting on textured paper, soft translucent washes, gentle bleeding edges, light airy palette",
  },
  clay: {
    label: "Đất sét", summary: "Mô hình đất sét nặn tay kiểu phim stop-motion",
    kind: "illustration",
    look: "Claymation style, handmade plasticine clay figures and miniature sets, visible fingerprint texture, soft studio lighting",
  },
  pixel: {
    label: "Pixel art", summary: "Đồ hoạ điểm ảnh kiểu game 16-bit",
    kind: "illustration",
    look: "Pixel art, 16-bit retro video game graphics, crisp visible square pixels, limited color palette",
  },
} satisfies Record<string, ImageLook & { label: string; summary: string }>;

/** "auto" = theo phong cách video (IMAGE_LOOKS). */
export type ArtStyle = "auto" | keyof typeof ART_STYLES;

export const isArtStyle = (value: unknown): value is ArtStyle =>
  value === "auto" || (typeof value === "string" && Object.prototype.hasOwnProperty.call(ART_STYLES, value));

/** Danh sách cho giao diện (/api/state). */
export const artStyleCatalog = () =>
  Object.entries(ART_STYLES).map(([id, s]) => ({ id, label: s.label, summary: s.summary, kind: s.kind }));

export const imageLookFor = (style: string | undefined, art: ArtStyle = "auto"): ImageLook => {
  if (art !== "auto" && isArtStyle(art)) {
    const { kind, look } = ART_STYLES[art];
    return { kind, look };
  }
  return style && style in IMAGE_LOOKS ? IMAGE_LOOKS[style as StyleId] : IMAGE_LOOKS.caption;
};

const COMMON = `You write image-generation prompts for the background pictures of a vertical short video (9:16).
The narration is usually Vietnamese; your prompts are ALWAYS English.

For each requested scene write ONE prompt (25-60 words) describing only WHAT is in the picture:
- Name the concrete main subject explicitly (e.g. "a bottlenose dolphin", "a Vietnamese street vendor"), never "it", "they", "this".
  Narration often omits the subject — infer it from the title and the other scenes.
- Be specific and correct: exact species, real place, real dish and ingredients, correct era and clothing. When the narration
  states a fact, pick the real situation that shows it (e.g. "dolphins help fishermen" → the real cooperative fishing with
  cast nets in shallow water, fishermen standing waist-deep).
- Describe setting, action/pose, and camera framing (close-up, medium shot, wide shot). Main subject centered and fully in frame.
- Keep the SAME recurring characters (same person, same clothes) in every scene.
- Use Vietnamese people, streets or dishes only when the topic is actually set in Vietnam or about Vietnamese life.
- Do NOT describe art style, medium, camera or lighting style — that part is added automatically.
- The image model draws any words it sees: do NOT write digits, ages ("5-year-old"), dates, quotes, brand names, or the words
  text/letters/caption/subtitle/sign/label/logo. Say "a small boy" not "a 5-year-old boy".
  Avoid objects that carry writing (calendars, books with titles, signs, screens, posters, newspapers).
- Do not use negations ("no ...", "without ...") — the image model ignores them and may draw the thing.`;

const PHOTO_RULES = `
The pictures are REAL PHOTOGRAPHS. Every prompt must be a moment a photographer could actually capture:
- Only physically real things. No symbols, glowing trails, visible sound waves, holograms, floating icons, fantasy, cartoon
  or surreal elements, no double exposure. Abstract ideas (memory, numbers, emotions) → a real scene that shows them
  (people, animals, places, objects, facial expressions).
- Natural poses and plausible scale; animals and people in their real habitat or setting.`;

const ILLUSTRATION_RULES = `
The pictures are simple ILLUSTRATIONS. Keep each picture to one clear idea with few elements.
A simple visual metaphor is allowed for abstract ideas, but characters and objects must stay recognizable.`;

const OUTPUT = `

Return JSON only: {"prompts": ["<prompt for scene 1>", ...]} with exactly one prompt per requested scene, in the given order.`;

/**
 * `indexes`: những cảnh cần ảnh (theo thứ tự trả về). Cả kịch bản được gửi kèm làm ngữ cảnh.
 * `style`: id phong cách video — quyết định kiểu ảnh (ảnh thật hay tranh vẽ) theo IMAGE_LOOKS.
 * `art`: kiểu vẽ người dùng chọn (ART_STYLES), khác "auto" thì thắng kiểu của phong cách.
 */
export const writeImagePrompts = async (
  video: { title: string; subtitle?: string | null; scenes: SceneForPrompt[] },
  indexes: number[],
  options: { provider: ProviderChoice; style?: string; art?: ArtStyle },
): Promise<{ prompts: string[]; look: ImageLook; provider: ScriptProvider }> => {
  const look = imageLookFor(options.style, options.art);
  const outline = video.scenes
    .map((scene, i) => `Scene ${i + 1}${indexes.includes(i) ? " [NEEDS IMAGE]" : ""}: ${scene.lines.join(" ")}`)
    .join("\n");
  const user = [
    `Video title: ${video.title}`,
    video.subtitle ? `Subtitle: ${video.subtitle}` : "",
    "",
    outline,
    "",
    `Write prompts for these scenes, in this order: ${indexes.map((i) => i + 1).join(", ")}.`,
  ].filter((line, k, all) => line !== "" || all[k - 1] !== "").join("\n");

  const read = (reply: JsonReply) => {
    const body = parseJson<{ prompts?: unknown }>(reply);
    const prompts = Array.isArray(body.prompts) ? body.prompts.map((p) => (typeof p === "string" ? p.trim() : "")) : [];
    if (prompts.length !== indexes.length || prompts.some((p) => p.length < 10)) {
      throw new Error(`${reply.who} trả ${prompts.length}/${indexes.length} mô tả hình.`);
    }
    return prompts;
  };

  const ask = (choice: ProviderChoice) => askJson(
    choice,
    {
      system: COMMON + (look.kind === "photo" ? PHOTO_RULES : ILLUSTRATION_RULES) + OUTPUT,
      user,
      // Thấp: cần tả đúng sự thật, không cần sáng tạo.
      temperature: 0.3,
      maxTokens: 300 + indexes.length * 160,
      schema: {
        type: "object",
        properties: { prompts: { type: "array", items: { type: "string" } } },
        required: ["prompts"],
      },
      slowHint: "chọn nguồn hình khác hoặc ít cảnh hơn",
    },
    read,
    "Chưa có AI nào để viết mô tả hình.",
  );

  try {
    const { value, provider } = await ask(options.provider);
    return { prompts: value, look, provider };
  } catch (error) {
    // Cài đặt chỉ định một nhà cung cấp (ví dụ Groq) mà nó lỗi mạng/hết lượt: việc này nhẹ, thử các nhà cung cấp
    // trên mạng khác đang có key trước khi lùi về bản dịch thô. Bỏ qua model trên máy (chậm, tả kém) — askJson tự bỏ
    // nhà cung cấp chưa có key hoặc tính tiền khi đang bật chế độ Miễn phí.
    const failures = [error instanceof Error ? error.message : String(error)];
    for (const other of FALLBACK_PROVIDERS) {
      if (other === options.provider) continue;
      try {
        const { value, provider } = await ask(other);
        return { prompts: value, look, provider };
      } catch (next) {
        if (!/Chưa có key|Chưa có AI/.test(next instanceof Error ? next.message : "")) {
          failures.push(next instanceof Error ? next.message : String(next));
        }
      }
    }
    throw new Error(failures.join(" · "));
  }
};

/** Thứ tự thử khi nhà cung cấp đã chọn lỗi: gói miễn phí trước, trả phí sau. */
const FALLBACK_PROVIDERS: ProviderChoice[] = ["gemini", "groq", "openrouter", "openai", "anthropic"];

/**
 * Ghép mô tả cảnh + kiểu ảnh thành prompt gửi model vẽ.
 * Chỉ câu khẳng định: FLUX không hiểu phủ định — "no text" làm nó vẽ chữ, "keep the lower third darker" làm nó vẽ
 * một dải đen dưới ảnh (đã thử 2026-09-17). Phụ đề đã có viền/bóng riêng nên không cần làm tối nền.
 */
export const composeImagePrompt = (scenePrompt: string, look: string) =>
  [
    scenePrompt.replace(/\.?\s*$/, "."),
    look ? `${look}.` : "",
    "Tall portrait composition, main subject centered.",
  ].filter(Boolean).join(" ");

/** Kế hoạch tìm ảnh kho (Pexels/Pixabay) cho một cảnh: truy vấn chính, truy vấn dự phòng, từ khoá để chấm ảnh. */
export type StockPlan = { queries: string[]; keywords: string[] };

const STOCK_RULES = `You choose stock-photo search queries (Pexels, Pixabay) for the background pictures of a vertical short video.
The narration is usually Vietnamese; queries and keywords are ALWAYS English — the stock sites are searched in English.

For each requested scene return:
- "query": 2-4 words naming the concrete, photographable main subject of that scene: an object, animal, dish, place,
  or a person doing a specific action. Examples: "bowl of pho", "snail on leaf", "surgeon in operating room",
  "Hoi An lantern street", "woman jogging at sunrise".
- "alternates": 2 backup queries on the SAME subject, a little broader ("vietnamese noodle soup", "noodle soup bowl").
- "keywords": 3-5 single English words a matching photo's description would contain, MOST IMPORTANT FIRST — the first
  one is the main subject noun (["pho","noodle","soup","bowl"]).

Rules:
- The narration often omits the subject — infer it from the title and the other scenes. Every query must be about the
  video's topic. Never generic words alone: people, concept, idea, question, quiz, thinking, background, happy, success.
- Prefer what a photographer actually shoots and stock sites actually have. Abstract idea → a concrete scene that shows it.
- Quiz and riddle videos: show what the question is ABOUT, never the answer. "What is the dipping sauce of banh cuon
  made from?" (answer: fish sauce) → "banh cuon rice rolls", not "fish sauce". "Which city was the last imperial
  capital?" (answer: Hue) → "ancient asian palace gate", not "hue citadel". Even when you can guess the answer yourself,
  show the broader topic of the question: "Which bone is the longest?" → "human skeleton model", not "femur bone".
- Add "vietnam"/"vietnamese" only when the subject is really Vietnamese (a dish, a place, Vietnamese daily life).
- No text, digits, brand names or people's names in queries.

Return JSON only: {"scenes":[{"query":"...","alternates":["...","..."],"keywords":["...","..."]}]} with exactly one
object per requested scene, in the given order.`;

/**
 * Truy vấn tìm ảnh kho cho các cảnh `indexes`. Trước đây truy vấn là cả câu lời đọc dịch sang tiếng Anh ghép tiêu đề
 * ("Guess the dish, 90% of people answer wrong… what noodles does pho use?") — kho ảnh tìm theo từ khoá nên trả ảnh
 * gần như ngẫu nhiên. Giờ AI nêu đúng chủ thể chụp được của từng cảnh, kèm từ khoá để chấm các ảnh tìm được.
 */
export const writeStockQueries = async (
  video: { title: string; subtitle?: string | null; scenes: SceneForPrompt[] },
  indexes: number[],
  options: { provider: ProviderChoice },
): Promise<{ plans: StockPlan[]; provider: ScriptProvider }> => {
  const outline = video.scenes
    .map((scene, i) => `Scene ${i + 1}${indexes.includes(i) ? " [NEEDS IMAGE]" : ""}: ${scene.lines.join(" ")}`)
    .join("\n");
  const user = [
    `Video title: ${video.title}`,
    video.subtitle ? `Subtitle: ${video.subtitle}` : "",
    "",
    outline,
    "",
    `Write search queries for these scenes, in this order: ${indexes.map((i) => i + 1).join(", ")}.`,
  ].filter(Boolean).join("\n");

  const words = (value: unknown) => (Array.isArray(value) ? value : [])
    .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
    .filter((w) => w && w.length <= 40);
  const read = (reply: JsonReply) => {
    const body = parseJson<{ scenes?: unknown }>(reply);
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    const plans = scenes.map((raw) => {
      const s = (raw ?? {}) as { query?: unknown; alternates?: unknown; keywords?: unknown };
      const query = typeof s.query === "string" ? s.query.trim().toLowerCase() : "";
      return {
        queries: [...new Set([query, ...words(s.alternates)].filter(Boolean))].slice(0, 3),
        keywords: [...new Set(words(s.keywords).flatMap((w) => w.split(/\s+/)))].slice(0, 6),
      };
    });
    if (plans.length !== indexes.length || plans.some((p) => p.queries.length === 0)) {
      throw new Error(`${reply.who} trả ${plans.length}/${indexes.length} truy vấn ảnh.`);
    }
    return plans;
  };

  const ask = (choice: ProviderChoice) => askJson(
    choice,
    {
      system: STOCK_RULES,
      user,
      temperature: 0.2,
      maxTokens: 200 + indexes.length * 90,
      schema: {
        type: "object",
        properties: {
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                query: { type: "string" },
                alternates: { type: "array", items: { type: "string" } },
                keywords: { type: "array", items: { type: "string" } },
              },
              required: ["query", "alternates", "keywords"],
            },
          },
        },
        required: ["scenes"],
      },
      slowHint: "chọn ít cảnh hơn",
    },
    read,
    "Chưa có AI nào để chọn từ khoá tìm ảnh.",
  );

  try {
    const { value, provider } = await ask(options.provider);
    return { plans: value, provider };
  } catch (error) {
    // Như writeImagePrompts: việc nhẹ — thử các AI trên mạng khác đang có key trước khi lùi về bản dịch thô.
    const failures = [error instanceof Error ? error.message : String(error)];
    for (const other of FALLBACK_PROVIDERS) {
      if (other === options.provider) continue;
      try {
        const { value, provider } = await ask(other);
        return { plans: value, provider };
      } catch (next) {
        if (!/Chưa có key|Chưa có AI/.test(next instanceof Error ? next.message : "")) {
          failures.push(next instanceof Error ? next.message : String(next));
        }
      }
    }
    throw new Error(failures.join(" · "));
  }
};
