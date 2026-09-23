/**
 * TanStack Query cho trình chỉnh sửa: một QueryClient dùng chung, bọc app ở main.tsx.
 *
 *   const { data, isPending } = useQuery({ queryKey: ["media"], queryFn: () => api<MediaItem[]>("/api/media") });
 *   const save = useMutation({ mutationFn: (p) => postJson("/api/…", p), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }) });
 *
 * Server chạy ngay trên máy người dùng nên không cần thử lại nhiều hay tự tải lại khi quay về cửa sổ —
 * lỗi thì báo luôn, dữ liệu đổi thì gọi invalidateQueries sau khi sửa.
 */
import { QueryClient, useQuery } from "@tanstack/react-query";
import type { StockKind } from "../../scripts/stock";
import { api, type MediaItem, type TranslateCatalog } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: { retry: 0 },
  },
});

/** Thư viện media (public/uploads…) — dùng chung giữa trình chỉnh sửa và màn hình tạo dự án. */
export const MEDIA_KEY = ["media"] as const;

export const useMedia = () =>
  useQuery({ queryKey: MEDIA_KEY, queryFn: () => api<{ items: MediaItem[] }>("/api/media").then((d) => d.items) });

/** Vừa tải lên / cắt / xoá file: đánh dấu cũ để thư viện tải lại. */
export const refreshMedia = () => queryClient.invalidateQueries({ queryKey: MEDIA_KEY });

/**
 * Danh sách phụ thuộc key trong Cài đặt ở trang chính (model video AI, kho free, công cụ dịch): staleTime 0 để
 * mở lại tab là tải lại — điền key xong quay về trình chỉnh sửa thấy ngay, không phải tải lại trang.
 */
export type VideoModelCatalog = {
  models: VideoModelOption[];
  defaultModel: string | null;
  freeMode?: boolean;
  /** Hạn mức chi tiêu video AI trong Cài đặt (scripts/video-budget.ts); limit null = không giới hạn. */
  budget?: { day: BudgetScope; month: BudgetScope };
};

export type BudgetScope = { limit: number | null; spent: number };

/** /api/ai-video/models */
export type VideoModelOption = {
  key: string;
  label: string;
  providerLabel: string;
  env: string;
  durations: number[];
  usdPerSecond: number | null;
  available: boolean;
};

export const useAiVideoModels = () =>
  useQuery({ queryKey: ["ai-video-models"], queryFn: () => api<VideoModelCatalog>("/api/ai-video/models"), staleTime: 0 });

export type { StockKind };

/** /api/stock/providers */
export type StockProviderInfo = { id: string; label: string; kinds: StockKind[]; available: boolean; env: string };

/** Lỗi thì coi như chưa có nhà cung cấp nào — khung tìm hiện hướng dẫn điền key thay vì báo lỗi. */
export const useStockProviders = () =>
  useQuery({
    queryKey: ["stock-providers"],
    queryFn: () => api<{ providers: StockProviderInfo[] }>("/api/stock/providers").then((d) => d.providers).catch(() => []),
    staleTime: 0,
  });

/** /api/translate/engines — nút "Kiểm tra lại" gọi refetch. */
export const useTranslateEngines = () =>
  useQuery({ queryKey: ["translate-engines"], queryFn: () => api<TranslateCatalog>("/api/translate/engines"), staleTime: 0 });
