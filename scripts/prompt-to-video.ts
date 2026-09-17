/**
 * prompt → mp4, in one command.
 *
 * Mỗi video có thư mục riêng trong videos/<slug>/ nên không đè lên nhau.
 *
 *   npx tsx scripts/prompt-to-video.ts "5 mẹo tiết kiệm pin iPhone"
 *   npx tsx scripts/prompt-to-video.ts "..." --name pin-iphone --script-only
 *   npx tsx scripts/prompt-to-video.ts --name pin-iphone          # render lại, không gọi API
 *   npx tsx scripts/prompt-to-video.ts "..." --voice linh    # giọng Việt
 *   npx tsx scripts/prompt-to-video.ts --list-voices         # xem tất cả giọng
 *   npx tsx scripts/prompt-to-video.ts --name x --sub center # phụ đề giữa màn hình
 *   npx tsx scripts/prompt-to-video.ts "..." --length 300    # video 5 phút (15|30|60|180|300|600|free)
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { generateScript } from "./generate-script";
import { assertImagesExist } from "./images";
import { renderShort } from "./render";
import { allLines, parseScript, scriptToProps } from "../src/compositions/Short/script";
import { TITLE_FRAMES } from "../src/constants";
import { slugify } from "./slug";
import {
  fetchAccountVoices,
  findVoice,
  formatVoiceList,
  isElevenLabsVoiceId,
} from "./voices";
import { generateVoiceover, type TtsEngine } from "./tts";
import { isLengthChoice, LENGTH_CHOICES, type LengthChoice } from "./video-length";

// .env là tuỳ chọn: có thì nạp key từ đó, không có thì dùng biến môi trường sẵn có.
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // không sao — .env không bắt buộc
}

const args = process.argv.slice(2);

// Danh sách tĩnh in được ngay. Nhánh --live cần await nên nằm trong main():
// project là CommonJS, top-level await sẽ lỗi lúc chạy dù tsc không báo gì.
const wantsLiveVoices =
  args.includes("--list-voices") && args.includes("--live");

if (args.includes("--list-voices") && !wantsLiveVoices) {
  console.log(formatVoiceList());
  console.log(
    "\nXem giọng thật trong tài khoản ElevenLabs:  --list-voices --live",
  );
  process.exit(0);
}

const listLiveVoices = async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("--live cần ELEVENLABS_API_KEY.");
    process.exit(1);
  }

  const voices = await fetchAccountVoices(apiKey);
  console.log(`\n${voices.length} giọng trong tài khoản ElevenLabs:\n`);
  for (const v of voices) {
    const flag = v.paidPlan ? "  [cần gói trả phí]" : "";
    console.log(
      `  ${v.id}  ${v.name.padEnd(12)} ${v.lang.padEnd(3)} ${v.gender.padEnd(7)} ${v.category.padEnd(12)} ${v.useCase}${flag}`,
    );
  }
  console.log("\nDùng trực tiếp voice_id:  --voice <voice_id>");
};

const words: string[] = [];
let out: string | undefined;
let name: string | undefined;
let scriptFile: string | undefined;
let scriptOnly = false;
let tts: TtsEngine | "none" = "elevenlabs";
let voiceOverride: string | undefined;
let voiceLabel = "";
let music: string | null = "music/placeholder.mp3";
let captionPosition: "bottom" | "center" = "bottom";
let sfx = true;
let length: LengthChoice = "auto";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--script-only") {
    scriptOnly = true;
  } else if (arg === "--no-sfx") {
    sfx = false;
  } else if (arg === "--list-voices" || arg === "--live") {
    // đã xử lý ở trên
  } else if (
    arg === "--out" ||
    arg === "--script" ||
    arg === "--tts" ||
    arg === "--music" ||
    arg === "--name" ||
    arg === "--voice" ||
    arg === "--sub" ||
    arg === "--length"
  ) {
    i += 1;
    const value = args[i];
    if (!value) {
      console.error(`${arg} cần một giá trị đi kèm.`);
      process.exit(1);
    }
    if (arg === "--length") {
      if (!isLengthChoice(value)) {
        console.error(`--length chỉ nhận: ${LENGTH_CHOICES.join(" | ")}`);
        process.exit(1);
      }
      length = value;
    } else if (arg === "--sub") {
      if (value !== "bottom" && value !== "center") {
        console.error("--sub chỉ nhận: bottom | center");
        process.exit(1);
      }
      captionPosition = value;
    } else if (arg === "--voice") {
      const voice = findVoice(value);
      if (voice) {
        // Giọng quyết định engine — không phải khai báo cả --tts lẫn voice id.
        tts = voice.engine;
        voiceOverride = voice.id;
        voiceLabel = `${voice.key} (${voice.lang}, ${voice.engine})`;
        if (voice.paidPlan) {
          console.warn(
            `Lưu ý: "${voice.key}" là library voice — gói Free của ElevenLabs sẽ trả 402.`,
          );
        }
      } else if (isElevenLabsVoiceId(value)) {
        // voice_id lấy thẳng từ ElevenLabs, không cần có trong catalog.
        tts = "elevenlabs";
        voiceOverride = value;
        voiceLabel = `${value} (elevenlabs)`;
      } else {
        console.error(
          `Không có giọng "${value}", và cũng không phải voice_id ElevenLabs hợp lệ.\n` +
            "Xem danh sách:  npm run prompt-to-video -- --list-voices\n" +
            "Giọng trong tài khoản:  npm run prompt-to-video -- --list-voices --live",
        );
        process.exit(1);
      }
    } else if (arg === "--out") {
      out = value;
    } else if (arg === "--name") {
      name = slugify(value);
    } else if (arg === "--script") {
      scriptFile = value;
    } else if (arg === "--music") {
      music = value === "none" ? null : value;
    } else {
      if (value !== "elevenlabs" && value !== "say" && value !== "local" && value !== "none") {
        console.error(`--tts chỉ nhận: elevenlabs | say | local | none`);
        process.exit(1);
      }
      tts = value;
    }
  } else if (arg.startsWith("--")) {
    console.error(`Không hiểu flag: ${arg}`);
    process.exit(1);
  } else {
    // Gộp lại để prompt không đặt trong ngoặc kép vẫn dùng được đủ chữ.
    words.push(arg);
  }
}

const prompt = words.join(" ");

// Khoá của video: --name, hoặc suy từ prompt. Nhờ vậy mỗi video có thư mục riêng
// và làm video mới không ghi đè kịch bản của video cũ.
const slug = name ?? (prompt ? slugify(prompt) : undefined);

if (!wantsLiveVoices && !slug && !scriptFile) {
  console.error(
    'Cần một prompt, --name, hoặc --script.\n  npx tsx scripts/prompt-to-video.ts "chủ đề video"',
  );
  process.exit(1);
}

const videoDir = path.resolve(process.cwd(), "videos", slug ?? "video");
const scriptPath = scriptFile
  ? path.resolve(process.cwd(), scriptFile)
  : path.join(videoDir, "script.json");
const propsPath = path.join(videoDir, "props.json");
const outputLocation = path.resolve(
  process.cwd(),
  out ?? `out/${slug ?? "video"}.mp4`,
);

// Không có prompt thì phải có sẵn kịch bản để render lại.
const reuseScript = !prompt && fs.existsSync(scriptPath);
if (!wantsLiveVoices && !prompt && !reuseScript) {
  console.error(`Không thấy kịch bản tại ${path.relative(process.cwd(), scriptPath)}.`);
  process.exit(1);
}

const main = async () => {
  if (wantsLiveVoices) {
    await listLiveVoices();
    return;
  }

  const useExisting = reuseScript || Boolean(scriptFile);

  if (useExisting) {
    console.log(
      `\n1/4  Đọc kịch bản có sẵn: ${path.relative(process.cwd(), scriptPath)}`,
    );
  } else {
    console.log(`\n1/4  Sinh kịch bản từ prompt: "${prompt}"`);
  }

  const script = useExisting
    ? parseScript(JSON.parse(fs.readFileSync(scriptPath, "utf8")))
    : await generateScript(prompt, slug, undefined, [], "auto", "auto", {
        length,
        log: (line) => console.log(`     ${line}`),
      });
  const lines = allLines(script);
  console.log(
    `     "${script.title}" — ${script.scenes.length} cảnh, ${lines.length} câu phụ đề`,
  );

  fs.mkdirSync(videoDir, { recursive: true });
  if (!useExisting) {
    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  }

  // Slug theo nội dung kịch bản: hai video khác nhau không ghi đè voiceover của nhau,
  // còn chạy lại cùng một kịch bản thì dùng lại đúng thư mục cũ.
  // Thư mục voiceover gắn với nội dung: sửa kịch bản thì sinh lại, không dùng nhầm file cũ.
  const voiceSlug = `${slug ?? "video"}-${crypto
    .createHash("sha256")
    .update(JSON.stringify(script))
    .digest("hex")
    .slice(0, 8)}`;

  let voiceover;
  if (tts !== "none") {
    console.log(`2/4  Sinh voiceover — ${voiceLabel || tts}`);
    voiceover = await generateVoiceover(
      lines,
      voiceSlug,
      tts,
      voiceOverride,
    );
  }

  const props = scriptToProps(script, {
    startAtFrame: TITLE_FRAMES,
    voiceover,
    music,
    sfx,
    captionPosition,
  });
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
  console.log(`3/4  Props đã ghi: ${path.relative(process.cwd(), propsPath)}`);

  if (scriptOnly) {
    console.log(
      `\n--script-only: bỏ qua render.\nSửa ${path.relative(process.cwd(), scriptPath)} rồi chạy lại với --name ${slug} để khỏi gọi API.`,
    );
    return;
  }

  // Chặn sớm: để tới lúc render thì Remotion retry vài giây rồi mới báo lỗi.
  assertImagesExist(props);

  console.log("4/4  Render");
  const { durationInFrames } = await renderShort(props, outputLocation);
  const seconds = (durationInFrames / 30).toFixed(1);
  console.log(
    `\nXong: ${path.relative(process.cwd(), outputLocation)} (${durationInFrames} frame, ${seconds}s)\n`,
  );
};

main().catch((error) => {
  console.error(`\nLỗi: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
