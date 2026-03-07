import { PricingCards } from "@/components/billing/PricingCards";

export default function BillingPage() {
  return (
    <main className="mx-auto max-w-7xl p-4">
      <section className="brand-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="brand-heading text-xl font-semibold">Billing & Plans</h1>
            <p className="brand-text-muted mt-1 text-sm">
              Stripe subscription checkout is wired. Add your Stripe keys and price IDs to activate.
            </p>
          </div>
          <span className="brand-accent-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            no credit card for free
          </span>
        </div>
        <div className="mt-4">
          <PricingCards />
        </div>
      </section>
    </main>
  );
}
