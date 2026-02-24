import { useEffect, useState } from "react";

export function useEventListingsCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCount() {
      try {
        const response = await fetch("/api/events/count", { credentials: "same-origin" });
        if (!response.ok) return;
        const payload = (await response.json()) as { count?: number };
        if (!mounted) return;
        setCount(typeof payload?.count === "number" ? payload.count : 0);
      } catch {
        // silent fail for non-critical nav badge
      }
    }

    loadCount();
    return () => {
      mounted = false;
    };
  }, []);

  return count;
}
