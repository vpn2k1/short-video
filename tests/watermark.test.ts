/**
 * Watermark theo ô Cài đặt (scripts/watermark.ts): vị trí có sẵn, vị trí kéo thả, và cài đặt cũ lưu 4 góc.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseWatermarkXY, watermarkFromSettings, watermarkPosition } from "../scripts/watermark";

const NAMES = ["WATERMARK_ENABLED", "WATERMARK_TEXT", "WATERMARK_POSITION", "WATERMARK_XY"] as const;

describe("watermark theo Cài đặt", () => {
  afterEach(() => {
    for (const name of NAMES) delete process.env[name];
  });

  it("tắt hoặc chưa có chữ thì không vẽ", () => {
    assert.equal(watermarkFromSettings(), null);
    process.env.WATERMARK_ENABLED = "on";
    assert.equal(watermarkFromSettings(), null);
  });

  it("vị trí có sẵn giữ nguyên, mặc định là trên", () => {
    process.env.WATERMARK_ENABLED = "on";
    process.env.WATERMARK_TEXT = "Kênh Của Tôi";
    assert.equal(watermarkFromSettings()?.position, "top");
    for (const position of ["top", "bottom", "center", "left", "right", "custom"]) {
      process.env.WATERMARK_POSITION = position;
      assert.equal(watermarkFromSettings()?.position, position);
    }
  });

  it("tuỳ chỉnh lấy toạ độ kéo thả", () => {
    process.env.WATERMARK_ENABLED = "on";
    process.env.WATERMARK_TEXT = "site.vn";
    process.env.WATERMARK_POSITION = "custom";
    process.env.WATERMARK_XY = "72.5,8";
    assert.deepEqual(watermarkFromSettings(), { text: "site.vn", position: "custom", x: 72.5, y: 8, opacity: 0.7 });
  });

  it("cài đặt cũ lưu 4 góc về cạnh trên/dưới", () => {
    assert.equal(watermarkPosition("top-left"), "top");
    assert.equal(watermarkPosition("top-right"), "top");
    assert.equal(watermarkPosition("bottom-left"), "bottom");
    assert.equal(watermarkPosition("bottom-right"), "bottom");
    assert.equal(watermarkPosition(undefined), "top");
  });

  it("toạ độ sai định dạng hoặc quá 100% bị bỏ", () => {
    assert.deepEqual(parseWatermarkXY("50,10"), { x: 50, y: 10 });
    assert.equal(parseWatermarkXY("101,10"), null);
    assert.equal(parseWatermarkXY("-1,10"), null);
    assert.equal(parseWatermarkXY("abc"), null);
    assert.equal(parseWatermarkXY(undefined), null);
  });
});
