import { useQuery } from "@tanstack/react-query";
import type { TodoPlanV2 } from "@/types";

interface SavedPlan {
  id: string;
  plan: TodoPlanV2;
  title: string;
  category: string | null;
  document_type: string | null;
  created_at: string;
}

interface PlansResponse {
  data: SavedPlan[];
  totalCount: number;
}

interface PlansParams {
  page: number;
  category: string;
  documentType: string;
  search: string;
}

export function usePlans(params: PlansParams, enabled: boolean = true) {
  return useQuery<PlansResponse>({
    queryKey: ["plans", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        category: params.category,
        documentType: params.documentType,
        search: params.search,
      });
      const res = await fetch(`/api/plans?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
