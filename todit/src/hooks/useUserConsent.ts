import { useQuery } from "@tanstack/react-query";

interface UserConsent {
  agreed: boolean;
}

export function useUserConsent(enabled: boolean = true) {
  return useQuery<UserConsent>({
    queryKey: ["user-consent"],
    queryFn: async () => {
      const res = await fetch("/api/consent");
      if (!res.ok) throw new Error("Failed to fetch consent");
      return res.json();
    },
    enabled,
  });
}
