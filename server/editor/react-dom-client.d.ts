// Project không cài @types/react-dom — khai báo đúng phần trình chỉnh sửa dùng.
declare module "react-dom/client" {
  import type { ReactNode } from "react";

  export type Root = {
    render: (children: ReactNode) => void;
    unmount: () => void;
  };

  export const createRoot: (container: Element | DocumentFragment) => Root;
}
