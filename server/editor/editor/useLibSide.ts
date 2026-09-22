import { useState } from "react";

/** Thư viện bên trái hay phải — tiện ích cho từng người, lỗi storage thì mặc định bên trái. */
export const useLibSide = () => {
  const [libSide, setLibSide] = useState<"left" | "right">(() => {
    try {
      return localStorage.getItem("editorLibSide") === "right" ? "right" : "left";
    } catch {
      return "left";
    }
  });
  const toggleLibSide = () => {
    setLibSide((side) => {
      const next = side === "left" ? "right" : "left";
      try {
        localStorage.setItem("editorLibSide", next);
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  };
  return { libSide, toggleLibSide };
};
