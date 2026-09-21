/**
 * Thư viện hook: các công thức mở đầu quen thuộc của Reels/TikTok, chia nhóm để chọn lúc tạo video.
 *
 * Chọn một mẫu = ra lệnh cho AI viết câu đầu THEO CÔNG THỨC đó cho đúng chủ đề video — không chép câu ví dụ.
 * "auto" (mặc định) giữ cách cũ: mỗi video một kiểu hook theo prompt, để làm hàng loạt không ra 10 video mở giống nhau.
 *
 * Không mẫu nào bảo đảm nhiều view: hiệu quả còn do nội dung, nhịp dựng và tệp người xem. Chọn mẫu khác nhau cho
 * từng video rồi đo bằng số liệu thật (Thử A/B hook trong chế độ hàng loạt, xem scripts/hooks.ts).
 */

/** Kiểu hook gợi ý — mỗi video một kiểu (theo nội dung yêu cầu) để làm hàng loạt không ra 10 video mở đầu giống nhau. */
export const HOOK_TYPES = ["tò mò", "ngạc nhiên", "ngược thường thức", "câu hỏi chạm vấn đề", "mở giữa câu chuyện", "thách thức", "hậu quả, cái giá"];

export type HookGroup = {
  id: string;
  label: string;
  /** Câu mô tả ngắn hiện dưới tên nhóm trong menu chọn. */
  hint: string;
};

export const HOOK_GROUPS: HookGroup[] = [
  { id: "curiosity", label: "Gây tò mò", hint: "kiến thức, khám phá, bí ẩn, sự thật thú vị" },
  { id: "surprise", label: "Bất ngờ, ngược kỳ vọng", hint: "đi ngược điều người xem đang nghĩ" },
  { id: "benefit", label: "Vấn đề & lợi ích", hint: "nói trúng vấn đề hoặc hứa một lợi ích rõ" },
  { id: "challenge", label: "Thử thách & tương tác", hint: "rủ người xem thử, đoán, chọn, bình luận" },
  { id: "ready", label: "Mẫu dùng ngay", hint: "câu mở đã thành hình, hợp nhiều loại nội dung" },
  { id: "quiz", label: "Cho câu đố, kiểm tra kiến thức", hint: "" },
  { id: "science", label: "Cho kiến thức, khoa học, tự nhiên", hint: "" },
  { id: "story", label: "Cho kể chuyện, chuyện hài", hint: "" },
];

export type HookTemplate = {
  id: string;
  group: string;
  /** Công thức — cũng là nhãn hiện trên chip và trong menu. */
  formula: string;
  /** Câu mẫu cho AI hiểu kiểu viết. AI KHÔNG được chép nguyên câu này. */
  example: string;
};

/**
 * Mẫu hook. Thêm mẫu mới: đặt id không trùng, xếp vào một nhóm ở trên — giao diện và prompt tự nhận.
 */
export const HOOK_TEMPLATES: HookTemplate[] = [
  // A. Gây tò mò
  { id: "know", group: "curiosity", formula: "Bạn có biết…?", example: "Bạn có biết loài vật này sống được cả năm không cần uống nước?" },
  { id: "little-known", group: "curiosity", formula: "Sự thật ít người biết", example: "Có một sự thật về đại dương mà rất ít người biết." },
  { id: "what-if", group: "curiosity", formula: "Điều gì xảy ra nếu…?", example: "Điều gì xảy ra nếu Trái Đất ngừng quay trong 5 giây?" },
  { id: "wont-believe", group: "curiosity", formula: "Bạn sẽ không tin…", example: "Bạn sẽ không tin thứ đang sống bên trong quả chuối này." },
  { id: "secret", group: "curiosity", formula: "Bí mật đằng sau…", example: "Đây là bí mật đằng sau thứ bạn dùng mỗi ngày." },

  // B. Bất ngờ, ngược kỳ vọng
  { id: "misunderstood", group: "surprise", formula: "Bạn đang hiểu sai về…", example: "Bạn đang hiểu sai về loài cá mập này." },
  { id: "not-normal", group: "surprise", formula: "Nhìn bình thường, nhưng…", example: "Quả chuối này trông bình thường, nhưng hãy nhìn bên trong." },
  { id: "x-is-y", group: "surprise", formula: "Thứ bạn tưởng là X hoá ra là Y", example: "Thứ bạn tưởng là hòn đá hoá ra là một sinh vật sống." },
  { id: "dont-do", group: "surprise", formula: "Đừng bao giờ làm điều này…", example: "Đừng bao giờ làm điều này khi điện thoại rơi xuống nước." },
  { id: "sounds-crazy", group: "surprise", formula: "Nghe vô lý nhưng…", example: "Nghe vô lý, nhưng loài vật này sống lại sau khi đông cứng." },

  // C. Vấn đề & lợi ích
  { id: "if-you-are", group: "benefit", formula: "Nếu bạn đang…, xem cái này", example: "Nếu bạn đang học tiếng Anh, 5 từ này rất dễ nhầm." },
  { id: "n-things", group: "benefit", formula: "3 điều bạn cần biết trước khi…", example: "3 điều nên biết trước khi mua chiếc điện thoại này." },
  { id: "how-to", group: "benefit", formula: "Đây là cách để…", example: "Đây là cách nhớ 10 từ tiếng Anh mà không cần học thuộc." },
  { id: "common-mistake", group: "benefit", formula: "Sai lầm nhiều người mắc phải", example: "Đây là sai lầm khiến nhiều người học mãi không tiến bộ." },
  { id: "wish-i-knew", group: "benefit", formula: "Giá như tôi biết điều này sớm hơn", example: "Giá như tôi biết mẹo này trước khi bắt đầu làm Reels." },

  // D. Thử thách & tương tác
  { id: "most-people-cant", group: "challenge", formula: "Rất ít người nhận ra…", example: "Rất ít người nhận ra điểm khác biệt trong bức ảnh này." },
  { id: "guess", group: "challenge", formula: "Đoán xem đây là gì", example: "Bạn có 3 giây để đoán đây là loài vật nào." },
  { id: "sharp-eyes", group: "challenge", formula: "Chỉ người tinh mắt mới thấy…", example: "Chỉ người tinh mắt mới nhận ra chi tiết bất thường này." },
  { id: "a-or-b", group: "challenge", formula: "Bạn chọn A hay B?", example: "Nếu chỉ được chọn một, bạn sẽ sống ở đâu?" },
  { id: "watch-to-end", group: "challenge", formula: "Xem đến cuối để…", example: "Xem đến cuối để biết bạn trả lời đúng mấy câu." },

  // Mẫu dùng ngay
  { id: "dont-scroll", group: "ready", formula: "Khoan lướt! Bạn cần xem cái này", example: "Khoan lướt đã, hiện tượng này chỉ xuất hiện vài giây." },
  { id: "bet-you", group: "ready", formula: "Tôi cá bạn chưa từng biết điều này", example: "Tôi cá bạn chưa từng biết cơ thể mình làm được điều này." },
  { id: "dont-blink", group: "ready", formula: "Đừng chớp mắt, bạn sẽ bỏ lỡ", example: "Đừng chớp mắt, thay đổi này diễn ra trong một giây." },
  { id: "easier-than", group: "ready", formula: "Dễ hơn bạn nghĩ… hay không?", example: "Câu này dễ hơn bạn nghĩ, hay không?" },
  { id: "bad-decision", group: "ready", formula: "Tất cả bắt đầu từ một quyết định ngu ngốc", example: "Mọi chuyện bắt đầu từ một quyết định ngu ngốc lúc 2 giờ sáng." },
  { id: "why-nobody", group: "ready", formula: "Sao không ai nói cho chúng ta biết điều này?", example: "Sao không ai nói cho chúng ta biết mẹo này sớm hơn?" },
  { id: "i-tried", group: "ready", formula: "Tôi đã thử điều này trong 7 ngày", example: "Tôi đã thử dậy lúc 5 giờ sáng suốt 7 ngày." },
  { id: "look-closer", group: "ready", formula: "Nhìn kỹ nhé, có gì đó không đúng", example: "Nhìn kỹ bức ảnh này, có gì đó không đúng." },
  { id: "changed-my-mind", group: "ready", formula: "Thứ khiến tôi thay đổi suy nghĩ hoàn toàn", example: "Đây là thứ khiến tôi bỏ hẳn thói quen mười năm." },
  { id: "what-would-you-do", group: "ready", formula: "Bạn sẽ làm gì nếu chuyện này xảy ra?", example: "Bạn sẽ làm gì nếu mở cửa ra và thấy cảnh này?" },

  // Cho câu đố
  { id: "even-experts", group: "quiz", formula: "Người giỏi cũng sai câu này", example: "Người giỏi tiếng Anh cũng có thể sai câu này." },
  { id: "five-seconds", group: "quiz", formula: "Bạn có 5 giây để chọn đáp án", example: "Bạn có 5 giây để chọn đáp án đúng." },
  { id: "its-a-trap", group: "quiz", formula: "Đừng trả lời vội, câu này có bẫy", example: "Đừng trả lời vội, câu này có bẫy." },
  { id: "score", group: "quiz", formula: "Bạn được mấy điểm trên 5?", example: "Xem bạn được mấy điểm trên 5 nhé." },
  { id: "dont-guess", group: "quiz", formula: "Đừng đoán theo mặt chữ", example: "Từ này nghĩa là gì? Đừng đoán theo mặt chữ." },

  // Cho kiến thức, khoa học
  { id: "alien-but-real", group: "science", formula: "Trông như ngoài hành tinh, nhưng có thật", example: "Sinh vật này trông như ngoài hành tinh, nhưng nó có thật." },
  { id: "what-would-you-do-there", group: "science", formula: "Nếu gặp thứ này, bạn sẽ làm gì?", example: "Nếu thấy thứ này dưới biển, bạn sẽ làm gì?" },
  { id: "not-what-you-fear", group: "science", formula: "Thứ đáng sợ nhất không phải là…", example: "Thứ đáng sợ nhất ở đại dương không phải cá mập." },
  { id: "body-can", group: "science", formula: "Bạn sẽ không tin cơ thể làm được điều này", example: "Bạn sẽ không tin cơ thể người chịu được mức này." },
  { id: "heres-why", group: "science", formula: "Đây là lý do hiện tượng này xảy ra", example: "Đây là lý do bầu trời chuyển màu đỏ trước bão." },

  // Cho kể chuyện
  { id: "unlucky", group: "story", formula: "Từ nhỏ tôi đã là người rất…", example: "Từ nhỏ tôi đã là một người cực kỳ thiếu may mắn." },
  { id: "still-alive", group: "story", formula: "Đến giờ tôi vẫn không hiểu sao mình…", example: "Đến giờ tôi vẫn không hiểu sao mình còn sống." },
  { id: "changed-life", group: "story", formula: "Một quyết định đổi đời… theo hướng rất tệ", example: "Tôi từng có quyết định đổi đời, theo hướng rất tệ." },
  { id: "deleted-scene", group: "story", formula: "Nếu đời tôi là phim, đây là cảnh bị cắt", example: "Nếu cuộc đời tôi là một bộ phim, đây chắc chắn là cảnh bị cắt." },
  { id: "successful-failure", group: "story", formula: "Tôi không thất bại, tôi chỉ…", example: "Tôi không phải người thất bại. Tôi chỉ rất giỏi việc thất bại." },
];

const byId = new Map(HOOK_TEMPLATES.map((t) => [t.id, t]));

/** Lựa chọn hợp lệ cho ô Hook: "auto" hoặc id một mẫu. */
export const isHookChoice = (value: unknown): value is string =>
  typeof value === "string" && (value === "auto" || byId.has(value));

export const hookTemplate = (id: string) => byId.get(id) ?? null;

/** Nhóm + mẫu cho giao diện chọn. */
export const hookCatalog = () =>
  HOOK_GROUPS.map((group) => ({
    ...group,
    templates: HOOK_TEMPLATES.filter((t) => t.group === group.id).map(({ id, formula, example }) => ({ id, formula, example })),
  })).filter((group) => group.templates.length > 0);

/** Mỗi prompt một kiểu hook cố định — cùng prompt luôn ra cùng kiểu, prompt khác nhau thì kiểu khác nhau. */
const autoHint = (prompt: string) => {
  let hash = 0;
  for (const ch of prompt) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return `\n\nKIỂU HOOK GỢI Ý CHO VIDEO NÀY: "${HOOK_TYPES[hash % HOOK_TYPES.length]}" — dùng nếu hợp nội dung; ` +
    "không hợp thì chọn kiểu khác trong mục HOOK. Hook vẫn phải đúng sự thật.";
};

/** Đoạn prompt về câu mở đầu: người dùng chọn mẫu thì bám công thức đó, "auto" thì gợi ý một kiểu. */
export const hookSection = (choice: string | undefined, prompt: string) => {
  const template = choice && choice !== "auto" ? byId.get(choice) : null;
  if (!template) return autoHint(prompt);
  return (
    `\n\nCÔNG THỨC HOOK NGƯỜI DÙNG CHỌN: "${template.formula}"\n` +
    `- Câu đọc đầu tiên PHẢI viết theo đúng công thức này, cho đúng chủ đề video.\n` +
    `- Câu mẫu chỉ để hiểu kiểu viết, KHÔNG chép lại: "${template.example}"\n` +
    "- Mục này thắng các luật hook chung ở trên nếu trái nhau, nhưng hook vẫn phải đúng sự thật và phần sau của " +
    "video phải trả lời được điều hook hứa.\n" +
    "- Vẫn giữ tối đa 12 từ, không chào hỏi, không giới thiệu kênh; câu thứ hai không lặp ý câu đầu."
  );
};

/** Nhãn ngắn cho giao diện: "Tự động" hoặc công thức của mẫu đã chọn. */
export const hookLabel = (choice: string | undefined) =>
  !choice || choice === "auto" ? "Tự động" : byId.get(choice)?.formula ?? "Tự động";
