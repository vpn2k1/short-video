/**
 * Chia việc cho video dài: mapLimit (scripts/concurrency.ts) và tìm hình theo lượt — tìm trước mọi cảnh cùng lúc,
 * rồi chọn theo thứ tự cảnh mà không gọi kho thêm lần nào (scripts/stock.ts). Kho ảnh được giả bằng fetch.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mapLimit } from "../scripts/concurrency";
import { chooseStockForScene, prefetchStockForScene } from "../scripts/stock";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapLimit", () => {
  it("giữ thứ tự kết quả và không vượt số việc cùng lúc", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([30, 5, 20, 1, 10, 2], 3, async (ms, i) => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(ms);
      running -= 1;
      return i * 10;
    });
    assert.deepEqual(out, [0, 10, 20, 30, 40, 50]);
    assert.equal(peak, 3);
  });

  it("danh sách rỗng trả rỗng", async () => {
    assert.deepEqual(await mapLimit([], 4, async () => 1), []);
  });
});

describe("tìm hình theo lượt", () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let inFlight = 0;
  let peak = 0;

  before(() => {
    process.env.PEXELS_API_KEY = "test";
    delete process.env.PIXABAY_API_KEY;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(20);
      inFlight -= 1;
      const query = new URL(url).searchParams.get("query") ?? "";
      // Mỗi truy vấn trả 3 ảnh có mô tả đúng chủ đề; ảnh "dog" dùng chung giữa hai truy vấn để thử chống trùng.
      const photos = [1, 2, 3].map((n) => ({
        id: query.includes("dog") ? n : 100 + query.length * 10 + n,
        alt: `${query} photo ${n}`, url: `https://www.pexels.com/photo/${n}/`, photographer: "A",
        width: 1080, height: 1920, src: { medium: "m", small: "s" },
      }));
      return new Response(JSON.stringify({ photos }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = realFetch;
    delete process.env.PEXELS_API_KEY;
  });

  it("tìm trước cùng lúc, chọn sau không gọi kho, không trùng ảnh", async () => {
    const plans = [
      { queries: ["happy dog"], keywords: ["dog", "happy"] },
      { queries: ["sleepy dog"], keywords: ["dog", "sleepy"] },
      { queries: ["red apple"], keywords: ["apple", "red"] },
      { queries: ["red apple"], keywords: ["apple", "red"] },
    ];
    await mapLimit(plans, 4, (plan) => prefetchStockForScene("image", plan, 3));
    // Hai cảnh cùng truy vấn "red apple" chỉ gọi kho một lần; các cảnh khác chạy song song.
    assert.equal(calls.length, 3);
    assert.ok(peak >= 2, `phải tìm song song, đỉnh ${peak}`);

    const before = calls.length;
    const used = new Set<string>();
    const picks = [];
    for (const plan of plans) picks.push(await chooseStockForScene("image", plan, 3, used));
    assert.equal(calls.length, before, "chọn sau khi tìm trước thì không gọi kho nữa");
    const ids = picks.map((p) => (p?.found ? p.pick.item.id : null));
    assert.ok(ids.every(Boolean));
    assert.equal(new Set(ids).size, ids.length, `không cảnh nào trùng ảnh: ${ids.join(", ")}`);
  });
});
