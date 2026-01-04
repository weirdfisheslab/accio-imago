import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing Authorization header" });
  }

  let payload: { product_id?: string };
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const productId = payload.product_id?.trim();
  if (!productId) {
    return jsonResponse(400, { error: "product_id is required" });
  }

  const userClient = createUserClient(authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid user" });
  }

  const admin = createAdminClient();
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, is_active")
    .eq("id", productId)
    .single();

  if (productError || !product || !product.is_active) {
    return jsonResponse(404, { error: "Product not found or inactive" });
  }

  const { data: entitlement } = await admin
    .from("entitlements")
    .select("plan, status, current_period_end")
    .eq("user_id", userData.user.id)
    .eq("product_id", productId)
    .maybeSingle();

  const { data: usage } = await admin
    .from("usage")
    .select("free_exports_used")
    .eq("user_id", userData.user.id)
    .eq("product_id", productId)
    .maybeSingle();

  const now = Date.now();
  const periodEnd = entitlement?.current_period_end
    ? Date.parse(entitlement.current_period_end)
    : null;
  const isProActive = Boolean(
    entitlement &&
      entitlement.status === "active" &&
      periodEnd &&
      periodEnd > now,
  );

  const freeExportsUsed = usage?.free_exports_used ?? 0;
  const freeExportsRemaining = Math.max(0, 1 - freeExportsUsed);

  return jsonResponse(200, {
    product_id: productId,
    plan: isProActive ? "pro" : "free",
    isActive: isProActive,
    freeExportsUsed,
    freeExportsRemaining,
    currentPeriodEnd: entitlement?.current_period_end ?? null,
  });
});
