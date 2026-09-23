/**
 * Hạn mức chi tiêu video AI (scripts/video-budget.ts) và lời báo đầy ổ (server/disk.ts).
 * Chạy trong thư mục tạm — data/usage.json thật không bị đụng.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { DISK_FULL_MESSAGE, errorBody, errorText, isDiskFull } from "../server/disk";
import { BUDGET_DAY_ENV, BUDGET_MONTH_ENV, reserveVideoBudget, videoBudget } from "../scripts/video-budget";

const cwd = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budget-test-"));

before(() => process.chdir(dir));
after(() => {
  process.chdir(cwd);
  fs.rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  fs.rmSync(path.join(dir, "data"), { recursive: true, force: true });
  delete process.env[BUDGET_DAY_ENV];
  delete process.env[BUDGET_MONTH_ENV];
});

describe("hạn mức video AI", () => {
  it("không đặt hạn mức: cho qua, vẫn ghi chi tiêu", () => {
    reserveVideoBudget(0.4, "Veo")(true);
    assert.equal(videoBudget().day.spent, 0.4);
    assert.equal(videoBudget().day.limit, null);
  });

  it("chặn clip làm vượt hạn mức ngày", () => {
    process.env[BUDGET_DAY_ENV] = "1";
    reserveVideoBudget(0.8, "Veo")(true);
    assert.throws(() => reserveVideoBudget(0.4, "Veo"), /Vượt hạn mức chi tiêu video AI hôm nay/);
    reserveVideoBudget(0.2, "Veo")(true); // vừa khít 1.00
  });

  it("chặn theo hạn mức tháng", () => {
    process.env[BUDGET_MONTH_ENV] = "0.5";
    assert.throws(() => reserveVideoBudget(0.8, "Veo"), /tháng này/);
  });

  it("clip đang tạo giữ chỗ — hai clip cùng lúc không cùng lọt", () => {
    process.env[BUDGET_DAY_ENV] = "1";
    const first = reserveVideoBudget(0.8, "Veo");
    assert.throws(() => reserveVideoBudget(0.8, "Veo"), /Vượt hạn mức/);
    first(false); // hỏng trước khi nhà cung cấp tạo xong: trả chỗ, không tính tiền
    assert.equal(videoBudget().day.spent, 0);
    reserveVideoBudget(0.8, "Veo")(true);
  });

  it("settle chỉ có tác dụng lần đầu", () => {
    const settle = reserveVideoBudget(0.4, "Veo");
    settle(true);
    settle(false);
    settle(true);
    assert.equal(videoBudget().day.spent, 0.4);
  });

  it("model chưa có giá: bị chặn khi đã đặt hạn mức, cho qua khi không", () => {
    reserveVideoBudget(null, "Kling")(true);
    process.env[BUDGET_DAY_ENV] = "5";
    assert.throws(() => reserveVideoBudget(null, "Kling"), /chưa có bảng giá/);
  });

  it("hạn mức 0 chặn hẳn video tính tiền", () => {
    process.env[BUDGET_DAY_ENV] = "0";
    assert.throws(() => reserveVideoBudget(0.2, "Veo"), /Vượt hạn mức/);
  });
});

describe("lỗi đầy ổ", () => {
  const enospc = Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" });

  it("nhận ra theo mã lỗi và theo chữ của tiến trình con", () => {
    assert.ok(isDiskFull(enospc));
    assert.ok(isDiskFull(new Error("ffmpeg: No space left on device")));
    assert.ok(!isDiskFull(new Error("Thiếu mô tả video")));
  });

  it("đổi thành lời tiếng Việt, kèm code cho giao diện", () => {
    assert.equal(errorText(enospc), DISK_FULL_MESSAGE);
    assert.deepEqual(errorBody(enospc), { error: DISK_FULL_MESSAGE, code: "ENOSPC" });
    assert.deepEqual(errorBody(new Error("Lỗi khác")), { error: "Lỗi khác" });
  });
});
