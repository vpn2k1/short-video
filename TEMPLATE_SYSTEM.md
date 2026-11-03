# Template Animation System - Setup Complete ✅

## Điều vừa setup

### 1. **Thư mục template**
```
public/templates/
├── characters/        ← Thêm ảnh nhân vật ở đây
├── animations/        ← JSON animation
├── presets/          ← Template video hoàn chỉnh
├── README.md
└── SETUP.md          ← Guide chi tiết
```

### 2. **Thư viện & Tools**
- ✅ `sharp` - xử lý ảnh, cắt sprite sheet
- ✅ `template-utils.ts` - các utility function
  - `extractSpriteSheet()` - bóc tách sprite
  - `createMovementAnimation()` - tạo animation di chuyển
  - `createFrameAnimation()` - tạo animation frame-by-frame
  - `createExpressionAnimation()` - thay đổi biểu cảm
  - `createSkeletonRig()` - animate nhân vật multi-part

### 3. **NPM Scripts**
```bash
npm run generate-template -- --name="dancing" --image="public/templates/characters/stick.png" --action="dancing"
npm run extract-sprite -- --input="sprite.png" --cols=4 --rows=3 --output="frames/"
```

### 4. **Composition Component**
- `src/compositions/Template/index.tsx` - Remotion component để render template
- Support: movement, frame-sequence, expression-transition

### 5. **Example Files**
- `public/templates/presets/example-dancing.json` - template mẫu
- `SETUP.md` - guide chi tiết 50+ dòng

---

## Tiếp theo: Bạn cần làm gì

### Step 1️⃣ - Tạo/Upload hình ảnh
```
public/templates/characters/
├── character-01.png         ← Hình nhân vật chính
├── character-happy.png      ← (tuỳ chọn) variant biểu cảm
├── stick-frames.png         ← (tuỳ chọn) sprite sheet
└── character-01-parts/      ← (tuỳ chọn) folder chứa các phần (đầu, tay, chân)
    ├── head.png
    ├── body.png
    ├── left_arm.png
    └── right_arm.png
```

**Định dạng tối ưu:**
- PNG với transparent background
- 400×400px trở lên
- Nhân vật ở giữa

### Step 2️⃣ - Tạo template animation
Chọn **1 trong 4 cách** tùy vào cấu trúc ảnh:

#### **Cách 1: Simple movement (Đơn nhất)**
```bash
npm run generate-template -- \
  --name="my-character" \
  --image="public/templates/characters/character-01.png" \
  --action="dancing"
```
Hành động sẵn: `dancing`, `jumping`, `waving`, `standing`

#### **Cách 2: Sprite Sheet**
```bash
npm run extract-sprite -- \
  --input="public/templates/characters/stick-frames.png" \
  --cols=4 --rows=3 \
  --output="public/templates/characters/extracted-frames/"
```
Sau edit template JSON thêm:
```json
{ "animation": { "type": "frame-sequence", "frameCount": 12 } }
```

#### **Cách 3: Expression variants**
Tạo từng ảnh per biểu cảm, sau edit template:
```json
{
  "animation": {
    "type": "expression-transition",
    "transitions": [
      { "atMs": 0, "image": "character-happy.png" },
      { "atMs": 1000, "image": "character-sad.png" }
    ]
  }
}
```

#### **Cách 4: Skeleton animation (Chi tiết nhất)**
Nếu nhân vật có phần riêng (đầu, tay, chân):
```json
{
  "skeleton": {
    "head": { "src": "head.png", "x": 50, "y": 20 },
    "left_arm": { "src": "arm.png", "x": 35, "y": 45 }
  },
  "animation": {
    "type": "skeleton",
    "bones": {
      "left_arm": [
        { "atMs": 0, "rotate": 0 },
        { "atMs": 500, "rotate": 45 }
      ]
    }
  }
}
```

### Step 3️⃣ - Test & Render
```bash
npm run dev
# → Chọn "Template" composition trong Remotion Studio

npm run render-template -- --preset="my-character.json"
# → Output: out/template-my-character.mp4
```

---

## Cách tôi sẽ dùng khi bạn cung cấp ảnh

1. **Phân tích ảnh**
   - Detect format (single image, sprite sheet, multi-part?)
   - Extract keypoints nếu cần skeleton

2. **Bóc tách thành phần**
   - Dùng `sharp` + image processing để tách layers
   - Nếu pixel art → dùng PixelLab để generate variants

3. **Tạo animation tự động**
   - Generate keyframes từ skeleton/layers
   - Dùng PixelLab nếu cần expression variants

4. **Thêm UI template selector**
   - Dropdown trong editor để chọn template
   - Customize text, colors, duration
   - 1-click render

---

## Quick Reference

| Tệp | Mục đích |
|---|---|
| `scripts/template-utils.ts` | Utility functions (bóc tách, tạo animation) |
| `scripts/generate-template.ts` | CLI tạo template từ ảnh + action |
| `scripts/extract-sprite.ts` | CLI bóc tách sprite sheet |
| `src/compositions/Template/index.tsx` | Remotion component render template |
| `public/templates/SETUP.md` | Guide chi tiết |
| `public/templates/presets/example-dancing.json` | Example template |

---

## Lưu ý

- **shortcut**: hiện tại Template composition là basic version, support movement + frame-sequence. Upgrade khi bạn push ảnh nếu cần skeleton/expression.
- Khi render thực tế dùng **Short composition** (cách hiện tại), Template dùng để prototype & test animation.

---

## Ready!
👉 **Push ảnh lên `/public/templates/characters/`**, tôi sẽ tiếp tục!
