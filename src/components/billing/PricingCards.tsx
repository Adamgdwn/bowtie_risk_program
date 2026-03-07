"use client";

const PLANS = [
  { id: "free", name: "Free", price: "$0", detail: "2 projects, BYOK AI key", priceId: "" },
  {
    id: "pro",
    name: "Pro",
    price: "$10 / month",
    detail: "Unlimited projects, BYOK AI key",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
  },
  {
    id: "team",
    name: "Team",
    price: "$30 / month",
    detail: "Unlimited projects + managed model placeholder",
    priceId: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID || "",
  },
];

export function PricingCards() {
  async function checkout(priceId: string) {
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const payload = await response.json();
    if (payload.url) {
      window.location.assign(payload.url);
    } else {
      alert(payload.message ?? "Stripe placeholder mode. Configure env + products.");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLANS.map((plan) => (
        <article key={plan.id} className="brand-card rounded-xl p-4">
          <h3 className="brand-heading text-base font-semibold">{plan.name}</h3>
          <p className="mt-1 text-sm font-semibold text-[#325D88]">{plan.price}</p>
          <p className="brand-text-muted mt-1 text-sm">{plan.detail}</p>
          {plan.id !== "free" ? (
            <button
              className="brand-btn-primary mt-3 rounded px-3 py-1 text-sm"
              onClick={() => checkout(plan.priceId)}
            >
              Subscribe
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
