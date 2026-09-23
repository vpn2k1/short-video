/**
 * Kiểm thử ghim hình mở đầu vào câu hook (server/chat.ts, withHookMedia).
 * File hình là file tạm trong public/uploads, xoá sau khi chạy — không đụng ảnh thật.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { withHookMedia } from "../server/chat";
import type { VideoScript } from "../src/compositions/Short/script";

const MEDIA = "uploads/hook-media-test.png";
const file = path.join(process.cwd(), "public", MEDIA);

before(() => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x");
});
after(() => fs.rmSync(file, { force: true }));

const scene = (lines: string[], extra: Partial<VideoScript["scenes"][number]> = {}) =>
  ({ lines, image: null, visual: null, tag: null, punch: null, ...extra });

const script = (scenes: VideoScript["scenes"]): VideoScript => ({
  style: "caption", title: "Tiêu đề", subtitle: "Phụ đề",
  accent: "#e8590c", background: "#101010", scenes,
});

describe("withHookMedia", () => {
  it("cảnh đầu một câu: gán hình, không tách thêm cảnh", () => {
    const out = withHookMedia(script([scene(["Câu hook"]), scene(["Câu 2", "Câu 3"])]), MEDIA);
    assert.equal(out.scenes.length, 2);
    assert.equal(out.scenes[0].image, MEDIA);
    assert.deepEqual(out.scenes[0].lines, ["Câu hook"]);
    assert.equal(out.scenes[1].image, null);
  });

  it("cảnh đầu nhiều câu: tách câu hook thành cảnh riêng mang hình", () => {
    const out = withHookMedia(script([scene(["Câu hook", "Câu hai", "Câu ba"]), scene(["Cảnh sau"])]), MEDIA);
    assert.equal(out.scenes.length, 3);
    assert.deepEqual(out.scenes[0].lines, ["Câu hook"]);
    assert.equal(out.scenes[0].image, MEDIA);
    assert.deepEqual(out.scenes[1].lines, ["Câu hai", "Câu ba"]);
    assert.equal(out.scenes[1].image, null);
    assert.deepEqual(out.scenes[2].lines, ["Cảnh sau"]);
  });

  it("punch theo đúng cảnh chứa câu của nó", () => {
    const out = withHookMedia(script([scene(["Câu hook", "Câu hai đắt giá"], { punch: "đắt giá" })]), MEDIA);
    assert.equal(out.scenes[0].punch, null);
    assert.equal(out.scenes[1].punch, "đắt giá");

    const inHook = withHookMedia(script([scene(["Câu hook đắt giá", "Câu hai"], { punch: "đắt giá" })]), MEDIA);
    assert.equal(inHook.scenes[0].punch, "đắt giá");
    assert.equal(inHook.scenes[1].punch, null);
  });

  it("không thấy file thì giữ nguyên kịch bản và báo ra log", () => {
    const notes: string[] = [];
    const original = script([scene(["Câu hook", "Câu hai"])]);
    const out = withHookMedia(original, "uploads/khong-co-that.png", (line) => notes.push(line));
    assert.deepEqual(out, original);
    assert.match(notes.join("\n"), /Không thấy hình mở đầu/);
  });

  it("giữ nguyên tiêu đề, phong cách và các cảnh sau", () => {
    const original = script([scene(["Câu hook", "Câu hai"], { tag: "2024", visual: null }), scene(["Cảnh sau"], { tag: "Bước 2" })]);
    const out = withHookMedia(original, MEDIA);
    assert.equal(out.title, original.title);
    assert.equal(out.style, original.style);
    assert.deepEqual(out.scenes.at(-1), original.scenes.at(-1));
  });
});
