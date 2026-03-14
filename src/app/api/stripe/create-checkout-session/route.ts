import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { requireUser } from "@/lib/auth";
import { getStripePriceIdForPlan } from "@/lib/billing/plans";

const checkoutSchema = z.object({
  planId: z.enum(["pro", "team"]),
});

export async function POST(request: Request) {
  const { user, supabase } = await requireUser();
  const parsed = checkoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const customerLookup = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  const stripeCustomerId = customerLookup.error ? null : customerLookup.data?.stripe_customer_id ?? null;

  const priceId = getStripePriceIdForPlan(parsed.data.planId);

  if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_APP_URL || !priceId) {
    return NextResponse.json(
      {
        placeholder: true,
        message:
          "Stripe is not configured yet. Add STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL, and the plan price ID.",
      },
      { status: 200 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId || undefined,
    customer_email: stripeCustomerId ? undefined : user.email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?status=cancel`,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      planId: parsed.data.planId,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        planId: parsed.data.planId,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
