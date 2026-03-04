import { PricingCards } from "@/components/billing/PricingCards";

export default function BillingPage() {
  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="text-xl font-semibold text-zinc-900">Billing & Plans</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Stripe subscription checkout is wired. Add your Stripe keys and price IDs to activate.
      </p>
      <div className="mt-4">
        <PricingCards />
      </div>
    </main>
  );
}
