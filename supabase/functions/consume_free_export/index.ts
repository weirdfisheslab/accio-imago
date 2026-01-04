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
    .select("status, current_period_end")
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

  if (isProActive) {
    return jsonResponse(200, { allowed: true, reason: "pro_active" });
  }

  const { data: consumeResult, error: consumeError } = await admin.rpc(
    "consume_free_export",
    {
      p_user_id: userData.user.id,
      p_product_id: productId,
    },
  );

  if (consumeError || !consumeResult || consumeResult.length === 0) {
    return jsonResponse(500, { error: "Failed to consume free export" });
  }

  const result = consumeResult[0] as {
    allowed: boolean;
    reason: string;
  };

  return jsonResponse(200, { allowed: result.allowed, reason: result.reason });
});
