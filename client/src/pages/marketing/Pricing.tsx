import { PricingCard } from '@/components/marketing/PricingCard';
import React, { useEffect, useState } from 'react';
import PricingHero from "@/components/marketing/PricingHero.tsx";
import ProductShowcase from "@/components/Affiliate/ProductShowcase.tsx";
import api from '@/lib/axios';

interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  durationMonths: number;
  features: string[];
  isHighlighted: boolean;
  sortOrder: number;
  isActive: boolean;
}

const Pricing: React.FC = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await api.get('/pricing-plans');
        const allPlans = res.data?.data ?? [];
        const active = allPlans
          .filter((p: PricingPlan) => p.isActive)
          .sort((a: PricingPlan, b: PricingPlan) => a.sortOrder - b.sortOrder);
        setPlans(active);
        const highlightedIdx = active.findIndex((p: PricingPlan) => p.isHighlighted);
        setSelectedCardIndex(highlightedIdx >= 0 ? highlightedIdx : active.length > 0 ? 0 : null);
      } catch (err) {
        console.error('Failed to load pricing plans', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  return (
    <>
      <PricingHero />
      <div className="py-0 px-4 relative 2xl:mt-28 ">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Choose the Payment Plan
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
             LifeLine will support you on your fitness journey with a science-based approach.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No plans available yet.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {plans.map((plan, index) => (
                <PricingCard
                  key={plan.id}
                  title={plan.name}
                  price={String(plan.price)}
                  originalPrice={plan.originalPrice}
                  durationMonths={plan.durationMonths}
                  description={plan.description}
                  features={plan.features}
                  hasCoupon
                  isHighlighted={plan.isHighlighted}
                  isSelected={selectedCardIndex === index}
                  onSelect={() => setSelectedCardIndex(index)}
                  onContinue={() => console.log('clicked')}
                />
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <p className="text-gray-600 max-w-2xl mx-auto mb-6">
              Unlock our library of meditations, sleep sounds, and more. We'll remind you before your trial ends,
              and you can cancel anytime before you're charged.
            </p>
          </div>
        </div>
      </div>

      <ProductShowcase />
    </>
  );
};

export default Pricing;
