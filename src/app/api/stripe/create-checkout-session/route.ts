import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  const { user } = await requireUser();
  const { priceId } = await request.json();

  if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json(
      {
        placeholder: true,
        message:
          "Stripe is not configured yet. Add STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL, and price IDs.",
      },
      { status: 200 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?status=cancel`,
    metadata: {
      userId: user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
