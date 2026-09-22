import { useCallback, useRef, useState } from "react";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import * as ops from "../ops";
import { same } from "./constants";

type HistoryDeps = {
  propsRef: React.RefObject<ShortProps | null>;
  setProps: (next: ShortProps) => void;
  select: (next: ops.Selection) => void;
  scheduleSave: (next: ShortProps) => void;
};

/** Hoàn tác / làm lại: tối đa 100 bước; `commit` ghi một bước (gõ liên tục cùng mergeKey gộp thành một). */
export const useHistory = ({ propsRef, setProps, select, scheduleSave }: HistoryDeps) => {
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const history = useRef({ past: [] as ShortProps[], future: [] as ShortProps[], lastKey: null as string | null, lastAt: 0 });

  // ---------- lịch sử ----------
  const commit = useCallback((next: ShortProps, base: ShortProps, nextSelection: ops.Selection, mergeKey?: string) => {
    const normalized = ops.normalize(next, nextSelection);
    select(normalized.selection);
    setProps(normalized.props);
    if (same(base, normalized.props)) return;
    const h = history.current;
    const now = Date.now();
    // Gõ liên tục vào cùng một ô chỉ tính một bước hoàn tác.
    const merge = Boolean(mergeKey) && h.lastKey === mergeKey && now - h.lastAt < 1500;
    if (!merge) {
      h.past.push(base);
      if (h.past.length > 100) h.past.shift();
    }
    h.future = [];
    h.lastKey = mergeKey ?? null;
    h.lastAt = now;
    setHistorySize({ past: h.past.length, future: 0 });
    scheduleSave(normalized.props);
  }, [scheduleSave, select]);

  const undo = () => {
    const h = history.current;
    const current = propsRef.current;
    const previous = h.past.pop();
    if (!previous || !current) return;
    h.future.push(current);
    h.lastKey = null;
    setHistorySize({ past: h.past.length, future: h.future.length });
    select(null);
    setProps(previous);
    scheduleSave(previous);
  };

  const redo = () => {
    const h = history.current;
    const current = propsRef.current;
    const next = h.future.pop();
    if (!next || !current) return;
    h.past.push(current);
    h.lastKey = null;
    setHistorySize({ past: h.past.length, future: h.future.length });
    select(null);
    setProps(next);
    scheduleSave(next);
  };

  return { historySize, commit, undo, redo };
};
