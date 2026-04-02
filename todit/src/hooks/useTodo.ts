import { useQuery } from "@tanstack/react-query";
import type { TodoPlanV2 } from "@/types";

export function useTodo(id: string | null, enabled: boolean = true) {
  return useQuery<TodoPlanV2>({
    queryKey: ["todo", id],
    queryFn: async () => {
      if (!id) throw new Error("No ID provided");
      const res = await fetch(`/api/todo/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch todo");
      }
      return res.json();
    },
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 10, // 10 minutes for specific todo
  });
}
