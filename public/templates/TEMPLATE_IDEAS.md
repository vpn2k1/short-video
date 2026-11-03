# Gợi ý mẫu nhân vật — để tạo ảnh

Danh sách mẫu nhân vật cho chức năng **"Tạo video theo mẫu"** (`server/template-video.ts`). Mỗi mẫu
chỉ cần **1 ảnh PNG** — hệ thống tự "diễn" hành động (lắc, nhảy, vẫy tay…) bằng cách di chuyển/xoay
chính ảnh đó theo từ khoá trong lời đọc, không cần vẽ nhiều tư thế hay nhiều biểu cảm cho một mẫu.

## Spec ảnh (áp dụng cho mọi mẫu)

- **Định dạng**: PNG, nền trong suốt (transparent).
- **Khung**: tỉ lệ dọc ~4:5 (ví dụ 800×1000px), nhân vật đứng thẳng, nhìn thẳng vào camera, toàn thân
  hoặc ít nhất từ đầu đến hông — overlay sẽ co giãn theo khung này (`aspect: 4/5` trong code).
  (xem ảnh demo hiện có để biết tỉ lệ đang dùng: [`characters/demo-stickman.png`](characters/demo-stickman.png))
- **Phong cách**: nét đơn giản, phẳng (flat/vector), màu tương phản tốt với nền để nổi trên video —
  tránh ảnh quá chi tiết/ảnh thật vì overlay nhỏ (chiếm ~55% chiều ngang khung hình).
- **Tư thế trung tính (idle)**: tay xuôi hoặc hơi mở, không cầm vật gì — vì cùng 1 ảnh sẽ được xoay/lắc
  cho mọi hành động (vui, buồn, nhảy, vẫy tay).
- **Tên file**: `<id>.png`, đặt vào [`characters/`](characters) (cùng cấp với `demo-stickman.png`).

## Danh sách mẫu gợi ý

| id | Tên | Mô tả | Màu nền gợi ý | Prompt vẽ ảnh |
|---|---|---|---|---|
| `stickman` | Người que | Người que đen trắng tối giản (đã có — ảnh demo vẽ bằng code) | `#87CEEB` | *(đã có, có thể vẽ lại cho đẹp hơn)* |
| `stickgirl` | Người que tóc dài | Người que có tóc đuôi ngựa, cùng phong cách tối giản | `#FFD9EC` | "simple minimalist stick figure character with a ponytail, black line art, transparent background, standing pose, flat vector style" |
| `robot-kid` | Robot nhỏ | Robot hoạt hình dễ thương, thân vuông, mắt tròn | `#CFEFFF` | "cute small cartoon robot character, round eyes, flat 2D vector illustration, standing pose, transparent background" |
| `cat-mascot` | Mèo linh vật | Mèo hoạt hình đứng 2 chân, phong cách phẳng | `#FFF3CF` | "cartoon cat mascot standing on two legs, flat vector illustration, friendly face, transparent background, full body" |
| `dog-mascot` | Chó linh vật | Chó hoạt hình đứng 2 chân, tai cụp | `#E8F5E9` | "cartoon dog mascot character standing upright, flat vector style, transparent background, full body front view" |
| `businessman` | Nhân viên văn phòng | Người mặc sơ mi, đeo cà vạt, phong cách phẳng | `#DCE6F1` | "flat vector illustration of an office worker character, shirt and tie, standing pose, transparent background, full body" |
| `student` | Học sinh | Mặc đồng phục, đeo cặp, phong cách hoạt hình dễ thương | `#FFF0E0` | "cute cartoon student character wearing school uniform and backpack, flat vector style, transparent background, full body" |
| `superhero` | Siêu nhân | Mặc áo choàng, dáng đứng tự tin | `#FFE0E0` | "cartoon superhero character with cape, confident standing pose, flat vector illustration, transparent background" |
| `princess` | Công chúa | Mặc váy, phong cách hoạt hình dễ thương | `#F3E5FF` | "cute cartoon princess character wearing a dress, flat vector illustration, standing pose, transparent background" |
| `chef` | Đầu bếp | Mặc áo bếp, đội nón bếp | `#FFF8DC` | "cartoon chef character wearing apron and chef hat, flat vector illustration, standing pose, transparent background" |
| `doctor` | Bác sĩ | Mặc áo blouse trắng, ống nghe | `#E0F7FA` | "cartoon doctor character wearing white coat with stethoscope, flat vector illustration, standing pose, transparent background" |
| `farmer` | Nông dân | Mặc áo bà ba/nón lá, phong cách Việt Nam | `#E8F0D9` | "cartoon Vietnamese farmer character wearing traditional ao ba ba and conical hat, flat vector illustration, transparent background" |
| `astronaut` | Phi hành gia | Mặc đồ vũ trụ, mũ bảo hiểm | `#1A1A2E` (nền tối) | "cartoon astronaut character in space suit with helmet, flat vector illustration, standing pose, transparent background" |
| `panda` | Gấu trúc | Gấu trúc hoạt hình đứng 2 chân | `#F0F0F0` | "cute cartoon panda mascot standing upright, flat vector illustration, transparent background, full body front view" |
| `ghost` | Ma dễ thương | Nhân vật ma tròn trịa, hợp video kể chuyện ma/hù vui | `#2B2B3D` (nền tối) | "cute friendly cartoon ghost character, round simple shape, flat vector illustration, transparent background" |

## Sau khi có ảnh — đăng ký mẫu

Thêm vào mảng `CHARACTER_TEMPLATES` trong [`server/template-video.ts`](../../server/template-video.ts):

```ts
{
  id: "cat-mascot",
  name: "Mèo linh vật",
  description: "Mèo hoạt hình đứng 2 chân, tự đổi hành động theo lời đọc.",
  image: "templates/characters/cat-mascot.png",
  background: "#FFF3CF",
  accent: "#2a2a2a",
},
```

Không cần sửa gì khác — `background`/`accent` là màu nền và màu chữ mặc định khi dùng mẫu này,
hành động (`idle`/`happy`/`sad`/`jump`/`wave`) áp dụng chung cho mọi mẫu (xem `ACTIONS` trong cùng
file) vì tất cả đều animate trên cùng 1 ảnh bằng cách xoay/di chuyển, không swap ảnh.
