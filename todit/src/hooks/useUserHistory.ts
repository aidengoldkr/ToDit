import { useQuery } from "@tanstack/react-query";

interface HistoryItem {
  id: string;
  title: string | null;
  created_at: string;
}

export function useUserHistory(enabled: boolean = true) {
  return useQuery<HistoryItem[]>({
    queryKey: ["user-history"],
    queryFn: async () => {
      const res = await fetch("/api/todo/history");
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled,
  });
}
