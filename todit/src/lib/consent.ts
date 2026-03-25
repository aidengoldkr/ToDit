import { createAdminClient } from "@/lib/supabase/admin";

export class ConsentStorageError extends Error {
  constructor(message = "Consent storage is unavailable.") {
    super(message);
    this.name = "ConsentStorageError";
  }
}

function getConsentClient() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new ConsentStorageError();
  }
  return supabase;
}

export async function getTermsAgreed(userId: string): Promise<boolean> {
  const supabase = getConsentClient();
  const { data, error } = await supabase
    .from("user_consents")
    .select("terms_agreed_at")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new ConsentStorageError(error.message);
  }

  return !!data?.terms_agreed_at;
}

export async function setTermsAgreed(userId: string): Promise<void> {
  const supabase = getConsentClient();
  const { error } = await supabase.from("user_consents").upsert(
    { user_id: userId, terms_agreed_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new ConsentStorageError(error.message);
  }
}
