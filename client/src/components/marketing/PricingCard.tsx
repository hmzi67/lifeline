import React, { useState } from 'react';
import api from '@/lib/axios';

/** "month", "3 months", "year": what one payment of a plan covers. */
const planPeriod = (durationMonths: number): string => {
  if (durationMonths === 12) return 'year';
  if (durationMonths <= 1) return 'month';
  return `${durationMonths} months`;
};

interface PricingCardProps {
  title: string;
  price: string;
  /** Crossed-out earlier price, in USD; null for none. */
  originalPrice: number | null;
  durationMonths: number;
  /** Shown under the price; a generic line is used when empty. */
  description?: string | null;
  features: string[];
  hasCoupon?: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: () => void;
  onContinue: (finalPrice: number, couponCode?: string) => void;
  onCouponApplied?: (discountPercent: number, couponCode: string) => void;
  onCouponCleared?: () => void;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  originalPrice,
  durationMonths,
  description,
  features,
  hasCoupon = true,
  isSelected,
  isHighlighted = false,
  onSelect,
  onContinue,
  onCouponApplied,
  onCouponCleared,
}) => {
  const [showCouponField, setShowCouponField] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [couponError, setCouponError] = useState('');
  const [finalPrice, setFinalPrice] = useState(price);
  const period = planPeriod(durationMonths);
  const [appliedCode, setAppliedCode] = useState<string | undefined>(undefined);

  const handleCouponSubmit = async () => {
    if (!couponCode.trim()) return;
    setCouponStatus('checking');
    setCouponError('');
    try {
      const response = await api.post('/coupons/validate', { code: couponCode });
      const discountPercent = response.data?.data?.discountPercent;
      const normalizedCode = couponCode.trim().toUpperCase();
      setCouponStatus('valid');
      setAppliedCode(normalizedCode);
      const newPrice = (parseFloat(price) * (1 - discountPercent / 100)).toFixed(2);
      setFinalPrice(newPrice);
      onCouponApplied?.(discountPercent, normalizedCode);
    } catch (err: any) {
      setCouponStatus('invalid');
      setCouponError(err.response?.data?.message || 'Invalid coupon code');
      setAppliedCode(undefined);
      setFinalPrice(price);
      onCouponCleared?.();
    }
  };

  const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCouponCode(e.target.value);
    setCouponStatus('idle');
    setAppliedCode(undefined);
    setFinalPrice(price);
    onCouponCleared?.();
  };

  const handleCouponToggle = () => {
    setShowCouponField(!showCouponField);
    if (showCouponField) {
      setCouponCode('');
      setCouponStatus('idle');
      setAppliedCode(undefined);
      setFinalPrice(price);
      onCouponCleared?.();
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`
        relative p-5 sm:p-8 rounded-3xl transition-all duration-300 cursor-pointer flex flex-col 
        ${isSelected
          ? 'bg-primary text-white shadow-lg sm:transform sm:scale-105'
          : 'bg-white text-gray-800 shadow-sm hover:shadow-md border border-gray-100'
        }
      `}
    >
      {/* Featured Badge */}
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={`px-4 py-1 rounded-full text-xs font-bold tracking-wide ${isSelected ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
            Featured
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className={`text-xl font-medium mb-8 text-center ${isSelected ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </h3>

      {/* Price Section */}
      <div className="text-center mb-6">
        {originalPrice != null && (
          <div className={`
            line-through inline-block px-3 py-1 mb-2 font-medium rounded-full text-sm sm:text-lg
            ${isSelected ? 'bg-white text-primary' : 'bg-primary text-white'}
          `}>
            ${originalPrice}/{period}
          </div>
        )}
        <div className="mb-2 inline-flex items-baseline">
          <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>$</span>
          <span className={`text-3xl sm:text-5xl font-bold ml-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>{finalPrice}</span>
          <span className={`text-base sm:text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>/{period}</span>
        </div>

        {/* Description */}
        <p className={`mt-4 text-sm leading-relaxed mb-6 ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
          {description?.trim()
            || `Full access to Lifeline for ${durationMonths === 12 ? 'a year' : `${durationMonths <= 1 ? '1 month' : `${durationMonths} months`}`} at just $${finalPrice}.`}
        </p>

        {/* Coupon Section */}
        {hasCoupon && (
          <div className="mb-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCouponToggle();
              }}
              className={`
                py-2 px-6 rounded-2xl font-medium transition-all border border-teal-200
                ${isSelected ? 'bg-white text-gray-900' : 'bg-teal-50 text-gray-900'}
              `}
            >
              {showCouponField ? 'Hide coupon field' : 'Enter Coupon Code'}
            </button>

            {showCouponField && (
              <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={handleCouponChange}
                    placeholder="Enter coupon code"
                    className={`
                      flex-1 min-w-0 px-4 py-3 rounded-xl text-sm
                      ${isSelected
                        ? 'bg-white/20 border border-white/30 text-white placeholder-white/70'
                        : 'bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-500'
                      }
                      focus:outline-none focus:ring-2 focus:ring-teal-300
                    `}
                  />
                  <button
                    onClick={handleCouponSubmit}
                    disabled={couponStatus === 'checking'}
                    className={`
                      px-6 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-60 whitespace-nowrap
                      ${isSelected
                        ? 'bg-white text-teal-500 hover:bg-gray-50'
                        : 'bg-teal-500 text-white hover:bg-teal-600'
                      }
                    `}
                  >
                    {couponStatus === 'checking' ? 'Checking...' : 'Apply'}
                  </button>
                </div>

                {couponStatus === 'valid' && (
                  <div className={`
                    text-sm p-3 rounded-xl
                    ${isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-green-50 text-green-700 border border-green-200'
                    }
                  `}>
                    ✓ Coupon applied successfully!
                  </div>
                )}

                {couponStatus === 'invalid' && (
                  <div className={`
                    text-sm p-3 rounded-xl
                    ${isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-red-50 text-red-700 border border-red-200'
                    }
                  `}>
                    ✗ {couponError || 'Invalid coupon code'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Features List */}
      <div className="space-y-4 mb-8 flex-grow">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start">
            <div className={`
              w-2 h-2 rounded-full mt-2.5 mr-4 flex-shrink-0
              ${isSelected ? 'bg-white' : 'bg-gray-600'}
            `}></div>
            <span className={`text-sm leading-relaxed ${isSelected ? 'text-white/95' : 'text-gray-600'}`}>
              {feature}
            </span>
          </div>
        ))}
      </div>

      {/* Get Started Button */}
      <div className='w-full flex items-center justify-center mt-auto'>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContinue(parseFloat(finalPrice), appliedCode);
          }}
          className={`
           w-full sm:w-auto py-3 px-8 rounded-xl font-bold transition-all duration-300 hover:transform hover:scale-105
          ${isSelected
              ? 'bg-white text-primary hover:bg-gray-50 shadow-md'
              : 'bg-primary text-white hover:bg-teal-500 shadow-md'
            }
        `}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};