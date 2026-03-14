import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPlanTierFromStripePriceId, type PlanTier } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

function isPaidStatus(status: Stripe.Subscription.Status) {
  return ["active", "trialing", "past_due"].includes(status);
}

async function syncSubscriptionToUserSettings(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planTier: PlanTier = isPaidStatus(subscription.status)
    ? getPlanTierFromStripePriceId(priceId)
    : "free";
  const admin = createAdminClient();

  const primaryWrite = await admin.from("user_settings").upsert(
    {
      user_id: userId,
      plan_tier: planTier,
      stripe_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_subscription_status: subscription.status,
    },
    { onConflict: "user_id" },
  );

  if (primaryWrite.error) {
    await admin.from("user_settings").upsert(
      {
        user_id: userId,
        plan_tier: planTier,
      },
      { onConflict: "user_id" },
    );
  }
}

export async function POST(request: Request) {
  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json({ ok: true, placeholder: true });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    if (session.mode === "subscription" && userId && session.subscription) {
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscriptionToUserSettings({
        ...subscription,
        metadata: {
          ...subscription.metadata,
          userId,
        },
      });
    }
    return NextResponse.json({ ok: true, handled: true, type: event.type });
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    await syncSubscriptionToUserSettings(subscription);
    return NextResponse.json({ ok: true, handled: true, type: event.type });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await syncSubscriptionToUserSettings({
      ...subscription,
      status: "canceled",
    });
    return NextResponse.json({ ok: true, handled: true, type: event.type });
  }

  return NextResponse.json({ ok: true, handled: false, type: event.type });
}
