/**
 * Chạy `run` cho từng phần tử, tối đa `limit` việc cùng lúc; kết quả giữ đúng thứ tự đầu vào.
 * Một việc lỗi thì cả lượt lỗi như Promise.all — việc nào muốn nuốt lỗi thì tự bắt trong `run`.
 */
export const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
};
