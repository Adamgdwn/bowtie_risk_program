import { requireUser } from "@/lib/auth";
import { PricingCards } from "@/components/billing/PricingCards";

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const params = await searchParams;
  const billingQuery = await supabase
    .from("user_settings")
    .select("plan_tier, stripe_customer_id, stripe_subscription_status")
    .eq("user_id", user.id)
    .single();
  const fallbackQuery = billingQuery.error
    ? await supabase.from("user_settings").select("plan_tier").eq("user_id", user.id).single()
    : null;
  const settings = billingQuery.error
    ? {
        plan_tier: fallbackQuery?.data?.plan_tier ?? "free",
        stripe_customer_id: null,
        stripe_subscription_status: null,
      }
    : billingQuery.data;

  const statusMessage =
    params?.status === "success"
      ? "Checkout completed. Your subscription will sync here as soon as Stripe confirms the webhook."
      : params?.status === "cancel"
        ? "Checkout was canceled. Your plan has not changed."
        : null;

  return (
    <main className="mx-auto max-w-7xl p-4">
      <section className="brand-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="brand-heading text-xl font-semibold">Billing & Plans</h1>
            <p className="brand-text-muted mt-1 text-sm">
              Subscribe with Stripe Checkout, manage payment methods in the billing portal, and keep free usage card-free.
            </p>
          </div>
          <span className="brand-accent-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            no credit card for free
          </span>
        </div>
        {statusMessage ? (
          <div className="mt-4 rounded-xl border border-[#9CA3AF] bg-white p-3 text-sm text-[#1F2933]">
            {statusMessage}
          </div>
        ) : null}
        <div className="mt-4">
          <PricingCards
            currentPlan={settings?.plan_tier ?? "free"}
            subscriptionStatus={settings?.stripe_subscription_status ?? null}
            hasBillingProfile={Boolean(settings?.stripe_customer_id)}
          />
        </div>
      </section>
    </main>
  );
}
