/**
 * Kiểm thử dọn dung lượng (server/storage.ts) trên một thư mục tạm — không đụng dữ liệu thật.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "storage-test-"));
const touch = (rel: string, bytes = 10) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), "x".repeat(bytes));
};

before(() => {
  process.env.STORAGE_ROOT = dir;
  // Hai video đang có — một cái tên kết thúc bằng "-1" (dễ bị cắt nhầm thành tên khác).
  fs.mkdirSync(path.join(dir, "videos", "meo-hay"), { recursive: true });
  fs.mkdirSync(path.join(dir, "videos", "video-prompt-1"), { recursive: true });
  touch("out/meo-hay.mp4");
  touch("out/video-prompt-1.mp4");
  touch("out/da-xoa.mp4", 100);
  touch("out/scenes/meo-hay-1.png");
  touch("out/scenes/da-xoa-2.png", 50);
  touch("public/voices/meo-hay/line-01.mp3");
  touch("public/voices/_samples/linh.mp3");
  touch("public/voices/.cache/abc.mp3", 30);
  touch("public/voices/da-xoa/line-01.mp3", 20);
  touch("out/covers/meo-hay.jpg");
});
after(() => {
  delete process.env.STORAGE_ROOT;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("storage", () => {
  it("chỉ tính file của video đã xoá là file sót", async () => {
    const { storageReport } = await import("../server/storage");
    const orphans = storageReport().categories.find((c) => c.id === "orphans")!;
    assert.equal(orphans.files, 3); // out/da-xoa.mp4, out/scenes/da-xoa-2.png, public/voices/da-xoa
    assert.equal(orphans.bytes, 170);
  });
  it("dọn đúng mục được chọn, giữ video đang có và mẫu nghe thử", async () => {
    const { cleanStorage } = await import("../server/storage");
    const res = cleanStorage({ ids: ["orphans"] });
    assert.equal(res.removed, 3);
    for (const kept of ["out/meo-hay.mp4", "out/video-prompt-1.mp4", "out/scenes/meo-hay-1.png", "public/voices/meo-hay/line-01.mp3",
      "public/voices/_samples/linh.mp3", "public/voices/.cache/abc.mp3", "out/covers/meo-hay.jpg"]) {
      assert.ok(fs.existsSync(path.join(dir, kept)), `${kept} phải còn`);
    }
    assert.ok(!fs.existsSync(path.join(dir, "out/da-xoa.mp4")));
  });
  it("mục không được chọn thì không đụng", async () => {
    const { cleanStorage } = await import("../server/storage");
    assert.equal(cleanStorage({ ids: [] }).removed, 0);
    assert.ok(fs.existsSync(path.join(dir, "public/voices/.cache/abc.mp3")));
  });
});
