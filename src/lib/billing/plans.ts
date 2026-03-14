export type PlanTier = "free" | "pro" | "team";

export type BillingPlan = {
  id: PlanTier;
  name: string;
  priceLabel: string;
  detail: string;
  billingCta: string;
  isPublicCheckout: boolean;
  highlight?: boolean;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    detail: "2 active projects, exports, public examples, and BYOK AI access.",
    billingCta: "Start free",
    isPublicCheckout: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$15 / month",
    detail: "Unlimited active projects, exports, example-to-template workflow, and BYOK AI access.",
    billingCta: "Subscribe",
    isPublicCheckout: true,
    highlight: true,
  },
  {
    id: "team",
    name: "Consultant / Team",
    priceLabel: "Contact us",
    detail: "For teams adopting Bowtie Risk Builder across workshops, clients, or multi-user rollouts.",
    billingCta: "Talk to us",
    isPublicCheckout: false,
  },
];

export function getStripePriceIdForPlan(planId: Exclude<PlanTier, "free">) {
  if (planId === "pro") {
    return process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "";
  }
  return process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID || "";
}

export function getPlanTierFromStripePriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return "free";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) {
    return "pro";
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID) {
    return "team";
  }
  return "free";
}
