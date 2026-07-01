"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function useCloseOnNavigation(close: () => void) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousRouteKey = useRef(routeKey);

  useEffect(() => {
    if (previousRouteKey.current !== routeKey) {
      close();
      previousRouteKey.current = routeKey;
    }
  }, [close, routeKey]);
}
