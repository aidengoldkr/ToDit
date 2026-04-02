import { useQuery } from "@tanstack/react-query";

interface UserUsage {
  count: number;
  limit: number | null;
  last_reset_at: string;
}

export function useUserUsage(enabled: boolean = true) {
  return useQuery<UserUsage>({
    queryKey: ["user-usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    enabled,
  });
}
