import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "@/lib/auth";

export async function POST() {
  const { user, supabase } = await requireUser();

  const customerLookup = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  const stripeCustomerId = customerLookup.error ? null : customerLookup.data?.stripe_customer_id ?? null;

  if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_APP_URL || !stripeCustomerId) {
    return NextResponse.json(
      {
        message: "Billing portal is not available yet for this account.",
      },
      { status: 400 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
