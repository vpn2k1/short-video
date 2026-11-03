# Template Animation System

Thư mục cho hệ thống mẫu hoạt hình nhân vật.

## Cấu trúc

### `/characters`
Chứa hình ảnh nhân vật/puppet:
- Ảnh full character hoặc sprite sheet
- Format: PNG (transparent background tốt nhất)
- VD: `stick-figure.png`, `character-01.png`

### `/animations`
Chứa các file JSON định nghĩa hành động/biểu cảm:
- Mỗi file = 1 hành động (nhảy, cười, quỳ, v.v.)
- Chứa keyframe animation (vị trí, xoay, opacity)
- VD: `dancing.json`, `happy.json`

### `/presets`
Chứa template video hoàn chỉnh:
- Kết hợp character + animation + scene
- Dùng để generate video ngay
- VD: `template-dance-intro.json`

## Tiếp theo

Sau khi bạn tạo hình ảnh, tôi sẽ dùng:

1. **Image Analysis** (Python + PIL/OpenCV) - để bóc tách các phần (đầu, tay, chân)
2. **PixelLab** - nếu cần tạo thêm frame animation
3. **SVG/Skeleton Rig** - để link các phần thành skeleton có thể animate
4. **Keyframe Generator** - để tạo hành động tự động từ skeleton

**Câu hỏi trước khi tạo hình:**
- Format: **Sprite sheet** (tất cả frame nằm 1 ảnh) hay **ảnh riêng lẻ per frame**?
- Kiểu vẽ: **Pixel art**, **Vector/SVG**, hay **Photo realistic**?
- Nhân vật có **nhiều phần riêng** (đầu/tay/chân) hay **vẽ nguyên khối**?
