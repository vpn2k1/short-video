---
name: remotion
description: Cửa vào bộ skill Remotion chính thức và quy ước code của project. Dùng khi viết/sửa component Remotion, animation, timing, hoặc render. KHÔNG viết API Remotion từ trí nhớ.
---

# Remotion

## Quy tắc số một

**Đừng viết API Remotion từ trí nhớ.** Remotion phát hành rất nhanh (project đang ở
4.0.523). Bộ skill chính thức nằm sẵn trong `.claude/skills/`, đọc file tương ứng trước:

| Cần gì | Đọc |
|---|---|
| Router chung | `remotion-best-practices/SKILL.md` |
| Audio, transition, sequencing, font, 3D, effects | `remotion-markup/` (30+ file) |
| Phụ đề, phiên âm, SRT | `remotion-captions/` |
| Render nâng cao, video trong suốt | `remotion-render/` |
| Chạy Studio, CLI flag | `remotion-studio/` |
| Viết markup để Studio sửa được bằng chuột | `remotion-interactivity/` |
| Player, Lambda, Vercel, Cloudflare | `remotion-saas/` |
| Trim/crop/metadata trong browser | `remotion-multimedia/` |
| Bản đồ, route animation | `remotion-maps/` |
| Tra docs online | `remotion-docs/` |
| Nâng cấp Remotion + skill | `remotion-upgrade/` |

## Cấu trúc code project

```
src/
  constants.ts          FPS, WIDTH, HEIGHT, SAFE, TITLE_FRAMES, msToFrames
  Root.tsx              đăng ký composition
  compositions/<Tên>/   index.tsx (component + calculateMetadata), schema.ts, defaultProps.ts
  scenes/               Background, Scenes (ảnh + cross-fade), SceneVisual, Scrim
  captions/             Captions
  audio/                Soundtrack, mix.ts (hàm thuần tính volume)
  components/           TitleCard, WatermarkOverlay, ProgressBar
```

Thứ tự lớp cố định — đảo là hỏng:

```
Background → Scenes → Scrim → SceneVisual → TitleCard → Captions → Soundtrack → ProgressBar
```

`Background` là `AbsoluteFill` có `backgroundColor` đục. Đặt nó SAU `Scenes` là che sạch ảnh.

## Quy ước bắt buộc

- **Timing suy ra từ dữ liệu.** `calculateMetadata` tính `durationInFrames` từ caption
  cuối VÀ mốc kết thúc cảnh — chỉ nhìn caption thì cắt mất khoảng lặng đuôi audio.
- **Style inline.** Studio chỉ chỉnh được object literal; tách ra hằng số hay `useMemo`
  là Studio làm xám ô nhập.
- **Mọi giá trị động từ `useCurrentFrame()`.** Không `Date.now()`, không `Math.random()`,
  không timer.
- **`interpolate` cần dãy mốc tăng NGHIÊM NGẶT.** Hai mốc bằng nhau là ném lỗi lúc render,
  không phải lúc build. Cảnh đầu/cuối phải tách nhánh riêng.

## Render

```bash
npm run dev                                   # Studio
npm run render-all                            # render lại mọi video trong videos/
npx remotion still Short out/x.png --frame=N --props=videos/<slug>/props.json
```

Tốc độ đo trên máy này: **27 frame/s** ở 1080×1920 (~1.1× realtime). Bundle được cache
trong `renderShort()` nên N video chỉ bundle một lần.
