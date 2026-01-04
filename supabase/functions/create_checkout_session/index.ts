import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { createStripeClient } from "../_shared/stripe.ts";

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

  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  if (!siteUrl) {
    return jsonResponse(500, { error: "Missing SITE_URL" });
  }

  const userClient = createUserClient(authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid user" });
  }

  const admin = createAdminClient();
  const { data: product, error: productError } = await admin
    .from("products")
    .select("stripe_price_id, is_active")
    .eq("id", productId)
    .single();

  if (productError || !product || !product.is_active) {
    return jsonResponse(404, { error: "Product not found or inactive" });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  const stripe = createStripeClient();
  let stripeCustomerId = profile?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: userData.user.email ?? undefined,
      metadata: { supabase_user_id: userData.user.id },
    });

    stripeCustomerId = customer.id;

    await admin
      .from("profiles")
      .upsert(
        {
          id: userData.user.id,
          email: userData.user.email ?? null,
          stripe_customer_id: stripeCustomerId,
        },
        { onConflict: "id" },
      );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: product.stripe_price_id, quantity: 1 }],
    success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/billing/cancel`,
    metadata: {
      supabase_user_id: userData.user.id,
      product_id: productId,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: userData.user.id,
        product_id: productId,
      },
    },
  });

  return jsonResponse(200, { url: session.url });
});
