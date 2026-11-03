# Template Animation Setup Guide

## Quy trình tạo video từ template

### Bước 1: Tạo / Upload ảnh nhân vật

Thêm ảnh vào `/characters`:
```
public/templates/characters/
├── stick-figure.png
├── character-01.png
└── character-02.png
```

**Format tối ưu:**
- **PNG với transparent background** (nên dùng)
- Kích thước: 400×400px trở lên (tự scale)
- Nhân vật ở giữa ảnh

### Bước 2: Tạo Animation Keyframes

**Cách 1: CLI (tự động)**
```bash
npm run generate-template -- --name="dancing" --image="public/templates/characters/stick.png" --action="dancing"
```

**Hành động có sẵn:**
- `dancing` - nhân vật nhảy
- `jumping` - nhân vật nhảy lên
- `waving` - nhân vật vẫy tay
- `standing` - nhân vật đứng yên

**Cách 2: Manual (chỉnh chi tiết)**
1. Copy `example-dancing.json` thành tên mới
2. Chỉnh các keyframe trong array `animation.keyframes`

Mỗi keyframe có:
```json
{
  "atMs": 0,           // thời điểm (ms)
  "x": 50,             // vị trí ngang (% chiều rộng)
  "y": 50,             // vị trí dọc (% chiều cao)
  "width": 100,        // cỡ nhân vật (% mặc định)
  "rotate": 0,         // xoay (độ)
  "opacity": 1         // độ trong suốt (0-1)
}
```

### Bước 3: Thêm Hành động & Biểu Cảm

**Tùy chọn A: Frame Sequence (Sprite Sheet)**

Nếu bạn có sprite sheet với các frame animation:

```bash
npm run extract-sprite -- --input="stick-frames.png" --cols=4 --rows=3 --output="extracted-frames/"
```

Sau tạo template với `type: "frame-sequence"`:
```json
{
  "animation": {
    "type": "frame-sequence",
    "duration": 1200,
    "frameCount": 12,
    "frameDirectory": "public/templates/characters/stick-frames/"
  }
}
```

**Tùy chọn B: Expression Variants**

Nếu bạn có nhiều ảnh nhân vật (mỗi biểu cảm 1 ảnh):

```
characters/
├── character-happy.png
├── character-sad.png
├── character-surprised.png
└── character-neutral.png
```

Tạo preset chuyển biểu cảm:
```json
{
  "animation": {
    "type": "expression-transition",
    "duration": 2000,
    "transitions": [
      { "atMs": 0, "image": "character-neutral.png" },
      { "atMs": 500, "image": "character-happy.png" },
      { "atMs": 1000, "image": "character-happy.png" },
      { "atMs": 1500, "image": "character-neutral.png" }
    ]
  }
}
```

**Tùy chọn C: Skeleton Animation (nhiều phần)**

Nếu nhân vật có các phần riêng (đầu, tay, chân):

```json
{
  "skeleton": {
    "head": { "src": "head.png", "x": 50, "y": 20 },
    "body": { "src": "body.png", "x": 50, "y": 50 },
    "left_arm": { "src": "arm.png", "x": 35, "y": 45 },
    "right_arm": { "src": "arm.png", "x": 65, "y": 45 }
  },
  "animation": {
    "type": "skeleton",
    "duration": 2000,
    "bones": {
      "left_arm": [
        { "atMs": 0, "rotate": 0 },
        { "atMs": 500, "rotate": 45 },
        { "atMs": 1000, "rotate": 0 }
      ]
    }
  }
}
```

### Bước 4: Thêm Phụ đề & Âm thanh

```json
{
  "captions": [
    { "text": "Hãy nhảy!", "startMs": 0, "endMs": 1000 },
    { "text": "Cười nào!", "startMs": 1000, "endMs": 2000 }
  ],
  "music": "public/music/background.mp3"
}
```

### Bước 5: Render Video

```bash
npm run render-template -- --preset="dancing.json"
```

Output: `out/template-dancing.mp4`

---

## File Structure Tham Khảo

```
public/templates/
├── characters/
│   ├── stick-figure.png
│   ├── stick-frames.png (sprite sheet)
│   └── character-01.png
├── animations/
│   ├── dancing.json
│   ├── happy.json
│   └── sad.json
├── presets/
│   ├── example-dancing.json
│   ├── template-birthday.json
│   └── template-greeting.json
├── README.md
└── SETUP.md (file này)
```

---

## Tips

1. **Keyframe mượt mà**: 60fps = ~16ms/frame. Cứ ~100-200ms thêm 1 keyframe là mượt.
2. **Bóc tách sprite sheet**: Dùng `extract-sprite` script nếu có sprite sheet 10+ frame.
3. **PixelLab integration**: Sau dùng PixelLab để tạo expression variant từ 1 ảnh base.
4. **Test nhanh**: Dùng `npm run dev` → chọn Template composition trong Remotion Studio.

---

## Tiếp theo

Bạn push hình ảnh lên `/characters`, tôi sẽ:
- ✅ Bóc tách thành các phần (nếu cần)
- ✅ Tạo keyframe animation tự động
- ✅ Thêm hỗ trợ PixelLab cho expression
- ✅ Viết UI template selector trong editor
