/**
 * Tên thư mục an toàn, suy từ prompt tiếng Việt: bỏ dấu, hạ chữ thường,
 * thay mọi thứ còn lại bằng "-". Dùng làm khoá cho một video.
 */
export const slugify = (input: string, maxLength = 48) => {
  const stripped = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const trimmed = stripped.slice(0, maxLength).replace(/-+$/g, "");
  return trimmed.length > 0 ? trimmed : "video";
};
