import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Metadata = { supabase_user_id?: string; product_id?: string };

function extractMetadata(metadata?: Stripe.Metadata): Metadata {
  return {
    supabase_user_id: metadata?.supabase_user_id,
    product_id: metadata?.product_id,
  };
}

async function upsertEntitlement(params: {
  userId: string;
  productId: string;
  plan: "free" | "pro";
  status: "active" | "inactive";
  currentPeriodEnd: string | null;
  subscriptionId: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("entitlements").upsert(
    {
      user_id: params.userId,
      product_id: params.productId,
      plan: params.plan,
      status: params.status,
      current_period_end: params.currentPeriodEnd,
      stripe_subscription_id: params.subscriptionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product_id" },
  );
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!webhookSecret) {
    return jsonResponse(500, { error: "Missing STRIPE_WEBHOOK_SECRET" });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse(400, { error: "Missing Stripe signature" });
  }

  const rawBody = await req.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (_error) {
    return jsonResponse(400, { error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = extractMetadata(session.metadata);
        if (!metadata.supabase_user_id || !metadata.product_id) break;

        const subscriptionId = session.subscription?.toString();
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await upsertEntitlement({
          userId: metadata.supabase_user_id,
          productId: metadata.product_id,
          plan: "pro",
          status: "active",
          currentPeriodEnd: periodEnd,
          subscriptionId,
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription?.toString();
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = extractMetadata(subscription.metadata);
        if (!metadata.supabase_user_id || !metadata.product_id) break;

        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await upsertEntitlement({
          userId: metadata.supabase_user_id,
          productId: metadata.product_id,
          plan: "pro",
          status: "active",
          currentPeriodEnd: periodEnd,
          subscriptionId,
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription?.toString();
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = extractMetadata(subscription.metadata);
        if (!metadata.supabase_user_id || !metadata.product_id) break;

        await upsertEntitlement({
          userId: metadata.supabase_user_id,
          productId: metadata.product_id,
          plan: "free",
          status: "inactive",
          currentPeriodEnd: null,
          subscriptionId,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const metadata = extractMetadata(subscription.metadata);
        if (!metadata.supabase_user_id || !metadata.product_id) break;

        await upsertEntitlement({
          userId: metadata.supabase_user_id,
          productId: metadata.product_id,
          plan: "free",
          status: "inactive",
          currentPeriodEnd: null,
          subscriptionId: subscription.id,
        });
        break;
      }
      default:
        break;
    }
  } catch (_error) {
    return jsonResponse(500, { error: "Webhook handler error" });
  }

  return new Response("ok", { status: 200 });
});
