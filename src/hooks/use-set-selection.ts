import { useCallback, useMemo, useState } from "react";

export function useSetSelection(initialIds: Iterable<string> = []) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds));

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: Iterable<string>) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const has = useCallback((id: string) => selected.has(id), [selected]);

  return useMemo(() => ({
    selected,
    toggle,
    selectAll,
    clear,
    has,
    size: selected.size,
  }), [selected, toggle, selectAll, clear, has]);
}
