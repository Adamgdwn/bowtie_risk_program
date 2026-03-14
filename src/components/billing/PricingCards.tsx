"use client";

import { BILLING_PLANS, type PlanTier } from "@/lib/billing/plans";

interface Props {
  currentPlan: PlanTier;
  subscriptionStatus: string | null;
  hasBillingProfile: boolean;
}

export function PricingCards({ currentPlan, subscriptionStatus, hasBillingProfile }: Props) {
  async function checkout(planId: Exclude<PlanTier, "free">) {
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const payload = await response.json();
    if (payload.url) {
      window.location.assign(payload.url);
    } else {
      alert(payload.message ?? "Stripe placeholder mode. Configure env + products.");
    }
  }

  async function openBillingPortal() {
    const response = await fetch("/api/stripe/create-portal-session", {
      method: "POST",
    });
    const payload = await response.json();
    if (payload.url) {
      window.location.assign(payload.url);
    } else {
      alert(payload.message ?? "Billing portal is not available yet.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#9CA3AF] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#325D88]">Current subscription</p>
            <p className="mt-1 text-sm text-[#1F2933]">
              Plan: <strong className="capitalize">{currentPlan}</strong>
              {subscriptionStatus ? (
                <span className="text-[#1F2933]/65"> | Stripe status: {subscriptionStatus}</span>
              ) : null}
            </p>
          </div>
          {hasBillingProfile ? (
            <button
              className="brand-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold"
              onClick={openBillingPortal}
            >
              Manage Billing
            </button>
          ) : null}
        </div>
        <p className="brand-text-muted mt-2 text-sm">
          Checkout accepts cards and Stripe-supported wallet options such as Apple Pay, Google Pay, and Link when enabled in Stripe.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
        <article
          key={plan.id}
          className={`brand-card rounded-2xl p-4 transition hover:-translate-y-0.5 ${
            plan.highlight ? "border-[#325D88]/45 bg-white" : "bg-white/90"
          }`}
        >
          <h3 className="brand-heading text-base font-semibold">{plan.name}</h3>
          <p className="mt-1 text-sm font-semibold text-[#325D88]">{plan.priceLabel}</p>
          <p className="brand-text-muted mt-1 text-sm">{plan.detail}</p>
          {plan.id === currentPlan ? (
            <span className="brand-stat-pill mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1F2933]/80">
              Current plan
            </span>
          ) : plan.isPublicCheckout && plan.id !== "free" ? (
            <button
              className="brand-btn-primary mt-3 rounded-lg px-3 py-1 text-sm"
              onClick={() => checkout(plan.id as Exclude<PlanTier, "free">)}
            >
              {plan.billingCta}
            </button>
          ) : plan.id === "team" ? (
            <a
              className="brand-btn-secondary mt-3 inline-block rounded-lg px-3 py-1 text-sm font-semibold"
              href="mailto:hello@bowtieriskbuilder.com?subject=Consultant%20or%20Team%20Plan"
            >
              {plan.billingCta}
            </a>
          ) : (
            <span className="brand-stat-pill mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1F2933]/80">
              {plan.billingCta}
            </span>
          )}
        </article>
        ))}
      </div>
    </div>
  );
}
