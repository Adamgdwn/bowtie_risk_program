import { PricingCards } from "@/components/billing/PricingCards";

export default function BillingPage() {
  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="brand-heading text-xl font-semibold">Billing & Plans</h1>
      <p className="brand-text-muted mt-1 text-sm">
        Stripe subscription checkout is wired. Add your Stripe keys and price IDs to activate.
      </p>
      <div className="mt-4">
        <PricingCards />
      </div>
    </main>
  );
}
