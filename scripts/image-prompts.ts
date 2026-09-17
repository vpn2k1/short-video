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
};

export const imageLookFor = (style: string | undefined): ImageLook =>
  (style && style in IMAGE_LOOKS ? IMAGE_LOOKS[style as StyleId] : IMAGE_LOOKS.caption);

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
 */
export const writeImagePrompts = async (
  video: { title: string; subtitle?: string | null; scenes: SceneForPrompt[] },
  indexes: number[],
  options: { provider: ProviderChoice; style?: string },
): Promise<{ prompts: string[]; look: ImageLook; provider: ScriptProvider }> => {
  const look = imageLookFor(options.style);
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
