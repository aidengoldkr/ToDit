import { getServerSession as getServerSessionNextAuth } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function getServerSession() {
  return getServerSessionNextAuth(authOptions);
}
