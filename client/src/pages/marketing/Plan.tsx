import Footer from "@/components/common/Footer";
import { PricingCard } from "@/components/marketing/PricingCard";
import { Tag, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import StripePaymentForm from "@/components/payment/StripePaymentForm";
import { config } from "@/config";
import api from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";

if (!config.stripePublishableKey) {
  // VITE_* vars are baked in at build time, so a missing key here means the
  // production build ran without VITE_STRIPE_PUBLISHABLE_KEY set - a rebuild
  // (not just a server restart) is required after adding it.
  console.error(
    "Stripe publishable key is missing (VITE_STRIPE_PUBLISHABLE_KEY). Card fields will not render."
  );
}

// Stripe() throws on an empty key; without one, Elements renders nothing instead of crashing.
const stripePromise = config.stripePublishableKey ? loadStripe(config.stripePublishableKey) : null;

// Urgency countdown shown once a coupon is applied (15 minutes).
const COUPON_COUNTDOWN_SECONDS = 15 * 60;

const formatCountdown = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

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

export default function Plan() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [showStripeForm, setShowStripeForm] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null);
  const [checkoutCouponCode, setCheckoutCouponCode] = useState<string | undefined>(undefined);
  const [couponSecondsLeft, setCouponSecondsLeft] = useState<number | null>(null);
  const couponTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [appStoreBilled, setAppStoreBilled] = useState(false);

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

  // VIP bought in the iOS app is billed by Apple; a card checkout here would
  // be refused by the API, so tell the user up front.
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/subscription/status')
      .then((res) => {
        const status = res.data?.data;
        setAppStoreBilled(status?.active === true && status?.source === 'app_store');
      })
      .catch(() => setAppStoreBilled(false));
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (couponTimerRef.current) clearInterval(couponTimerRef.current);
    };
  }, []);

  const handleCouponApplied = () => {
    if (couponTimerRef.current) clearInterval(couponTimerRef.current);
    setCouponSecondsLeft(COUPON_COUNTDOWN_SECONDS);
    couponTimerRef.current = setInterval(() => {
      setCouponSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (couponTimerRef.current) clearInterval(couponTimerRef.current);
          couponTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCouponCleared = () => {
    if (couponTimerRef.current) clearInterval(couponTimerRef.current);
    couponTimerRef.current = null;
    setCouponSecondsLeft(null);
  };

  const selectedPlan = selectedCardIndex !== null ? plans[selectedCardIndex] : null;

  return (
    <>
      {/* Header */}
      <div className="container mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <img src="/logo.webp" alt="Lifeline" width={110} height={70} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
          {couponSecondsLeft !== null && (
            <p className="hidden md:flex items-center justify-center gap-2 font-semibold text-primary-600">
              <Tag />
              Your Discount is applied for {formatCountdown(couponSecondsLeft)}
            </p>
          )}
        </div>
      </div>


      <div className="flex flex-col items-center justify-center bg-white text-gray-800 py-8 sm:py-16 px-4">
        {!showPayment ? (
          // PRICING SCREEN
          <>
            <div className="mb-8 sm:mb-12 text-center max-w-2xl">
              <h1 className="font-extrabold text-3xl sm:text-4xl text-gray-900 mb-4">
                Select Payment Method
              </h1>
              <p className="text-base sm:text-lg text-gray-600">
                LifeLine will help you in this fitness journey with science based approach this
              </p>
            </div>

            {appStoreBilled ? (
              <div className="max-w-xl w-full text-center rounded-2xl border border-gray-200 bg-gray-50 p-8">
                <h2 className="font-bold text-xl text-gray-900 mb-2">You already have Lifeline VIP</h2>
                <p className="text-gray-600">
                  Your subscription is billed through the App Store. To change or cancel it, open
                  Settings on your iPhone, tap your name, then Subscriptions.
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
              {loading ? (
                <div className="col-span-3 text-center py-12 text-gray-500">Loading plans...</div>
              ) : plans.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-gray-500">No plans available yet.</div>
              ) : (
                plans.map((plan, index) => (
                  <PricingCard
                    key={plan.id}
                    title={plan.name}
                    price={String(plan.price)}
                    originalPrice={plan.originalPrice != null ? `$${plan.originalPrice}/m` : ''}
                    features={plan.features}
                    hasCoupon
                    isHighlighted={plan.isHighlighted}
                    isSelected={selectedCardIndex === index}
                    onSelect={() => setSelectedCardIndex(index)}
                    onContinue={(finalPrice, couponCode) => {
                      setCheckoutAmount(finalPrice);
                      setCheckoutCouponCode(couponCode);
                      setShowPayment(true);
                    }}
                    onCouponApplied={handleCouponApplied}
                    onCouponCleared={handleCouponCleared}
                  />
                ))
              )}
            </div>
            )}

            <p className="text-gray-700 font-semibold max-w-4xl text-center mt-12 text-sm sm:text-base">
              Unlock our library of meditations, sleep sounds, and more. We'll remind you before your trial ends, and you can cancel anytime before you're charged.
            </p>
          </>
        ) : !showStripeForm ? (
          // PAYMENT METHOD SCREEN
          <div className="w-full max-w-2xl rounded-3xl p-4 sm:p-8">
            <button
              onClick={() => setShowPayment(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Plans
            </button>
            <div className="mb-8 sm:mb-12 text-center max-w-2xl">
              <h1 className="font-extrabold text-3xl sm:text-4xl text-gray-900 mb-4">
                Select Payment Method
              </h1>
              <p className="text-base sm:text-lg text-gray-600">
                LifeLine will support you on your fitness journey with a science-based approach.
              </p>
            </div>
            <div className="space-y-6">
              <div
                onClick={() => setShowStripeForm(true)}
                className="flex items-center border border-primary rounded-full p-4 sm:p-5 hover:shadow-md transition cursor-pointer hover:bg-gray-50"
              >
                <span className="text-blue-600 font-bold mr-4 text-xl w-16 sm:w-20 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="100%"
                    height="100%"
                    viewBox="0 0 750 471"
                  >
                    <g fill="#3EC6C9">
                      <path d="M278.198,334.228l33.36-195.763h53.358l-33.384,195.763H278.198L278.198,334.228z" />
                      <path d="M524.307,142.687c-10.57-3.966-27.135-8.222-47.822-8.222c-52.725,0-89.863,26.551-90.18,64.604c-0.297,28.129,26.514,43.821,46.754,53.185c20.77,9.597,27.752,15.716,27.652,24.283c-0.133,13.123-16.586,19.116-31.924,19.116c-21.355,0-32.701-2.967-50.225-10.274l-6.877-3.112l-7.488,43.823c12.463,5.466,35.508,10.199,59.438,10.445c56.09,0,92.502-26.248,92.916-66.884c0.199-22.27-14.016-39.216-44.801-53.188c-18.65-9.056-30.072-15.099-29.951-24.269c0-8.137,9.668-16.838,30.559-16.838c17.447-0.271,30.088,3.534,39.936,7.5l4.781,2.259L524.307,142.687" />
                      <path d="M661.615,138.464h-41.23c-12.773,0-22.332,3.486-27.941,16.234l-79.244,179.402h56.031c0,0,9.16-24.121,11.232-29.418c6.123,0,60.555,0.084,68.336,0.084c1.596,6.854,6.492,29.334,6.492,29.334h49.512L661.615,138.464L661.615,138.464z M596.198,264.872c4.414-11.279,21.26-54.724,21.26-54.724c-0.314,0.521,4.381-11.334,7.074-18.684l3.607,16.878c0,0,10.217,46.729,12.352,56.527h-44.293V264.872L596.198,264.872z" />
                      <path d="M45.878906 138.46484L45.197266 142.53711C66.290228 147.64311 85.129273 155.0333 101.62305 164.22656L148.96875 333.91406L205.42383 333.85156L289.42773 138.46484L232.90234 138.46484L180.66406 271.96094L175.09961 244.83008C174.83893 243.99185 174.55554 243.15215 174.26562 242.31055L156.10547 154.99219C152.87647 142.59619 143.50892 138.89684 131.91992 138.46484L45.878906 138.46484z" />
                    </g>
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-lg sm:text-xl">Stripe</p>
                  <p className="text-gray-500 text-sm">
                    Pay securely using your VISA/MasterCard via Stripe.
                  </p>
                </div>
              </div>

              <div className="flex items-center border border-primary rounded-full p-4 sm:p-5 hover:shadow-md transition cursor-pointer">
                <span className="mr-4 w-16 sm:w-20 flex-shrink-0">
                  <svg viewBox="0 0 356.44 141.39000000000001" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><g fill="#5f6368"><path d="M168.58 20.77V56.5h22.04c5.25 0 9.59-1.76 13.02-5.29 3.53-3.52 5.29-7.72 5.29-12.58s-1.76-8.91-5.29-12.44c-3.44-3.62-7.78-5.43-13.02-5.43h-22.04zm0 48.32v41.45h-13.16V8.19h34.91c8.87 0 16.39 2.96 22.6 8.86 6.31 5.9 9.45 13.1 9.45 21.58s-3.14 15.92-9.45 21.72c-6.1 5.82-13.64 8.72-22.6 8.72h-21.75zM235.68 89.08c0 3.44 1.45 6.29 4.37 8.58 2.91 2.28 6.32 3.43 10.23 3.43 5.54 0 10.46-2.05 14.8-6.14 4.34-4.1 6.51-8.91 6.51-14.43-4.1-3.25-9.83-4.86-17.17-4.86-5.34 0-9.8 1.29-13.37 3.86s-5.37 5.75-5.37 9.56m17.03-50.88c9.73 0 17.41 2.59 23.04 7.79s8.43 12.31 8.43 21.36v43.17h-12.59v-9.72h-.57c-5.44 8-12.68 12-21.74 12-7.73 0-14.2-2.28-19.39-6.85-5.2-4.58-7.8-10.29-7.8-17.16 0-7.24 2.73-13 8.22-17.28 5.49-4.29 12.81-6.43 21.96-6.43 7.82 0 14.26 1.43 19.31 4.29v-3c0-4.57-1.81-8.45-5.43-11.64-3.63-3.2-7.86-4.79-12.73-4.79-7.35 0-13.16 3.09-17.45 9.29l-11.6-7.29c6.4-9.15 15.84-13.72 28.34-13.72M356.44 40.49l-43.93 100.9h-13.59l16.31-35.3-28.9-65.6h14.31l20.89 50.31h.28l20.32-50.31z" /></g><path d="M115.39 60.14c0-4.14-.35-8.14-1.01-11.96H58.86v22.65h31.79c-1.36 7.38-5.49 13.66-11.75 17.87v14.71h18.98c11.11-10.24 17.51-25.37 17.51-43.26" fill="#4285f4" /><path d="M58.86 117.61c15.89 0 29.26-5.21 39.02-14.2L78.9 88.7c-5.28 3.55-12.08 5.63-20.04 5.63-15.35 0-28.38-10.34-33.05-24.27H6.27v15.15c9.69 19.21 29.6 32.41 52.6 32.41" fill="#34a853" /><path d="M25.82 70.05c-1.19-3.55-1.85-7.34-1.85-11.25s.65-7.7 1.85-11.25V32.4H6.27C2.26 40.34 0 49.3 0 58.8s2.26 18.47 6.27 26.4z" fill="#fabb05" /><path d="M58.86 23.27c8.67 0 16.45 2.98 22.58 8.82s16.8-16.78 16.8-16.78C88.04 5.83 74.74 0 58.86 0 35.87 0 15.96 13.19 6.27 32.4l19.55 15.15c4.66-13.93 17.69-24.27 33.05-24.27" fill="#e94235" /></svg>
                </span>
                <div>
                  <p className="font-semibold text-lg sm:text-xl">Google Pay</p>
                  <p className="text-gray-500 text-sm">
                    Quick checkout with your Google account.
                  </p>
                </div>
              </div>

              <div className="flex items-center border border-primary rounded-full p-4 sm:p-5 hover:shadow-md transition cursor-pointer">
                <span className="mr-4 w-16 sm:w-20 flex-shrink-0">
                  <svg height="100%" viewBox="-2.48 135.79 499.389 229.888" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m131.82 230.99c.3 27.1 24.6 36.1 24.8 36.2-.2.6-3.9 12.9-12.8 25.5-7.7 10.9-15.7 21.8-28.3 22-12.4.2-16.4-7.1-30.5-7.1-14.2 0-18.6 6.9-30.3 7.3-12.2.4-21.4-11.8-29.2-22.7-15.9-22.2-28-62.8-11.7-90.2 8.1-13.6 22.6-22.2 38.3-22.5 11.9-.2 23.2 7.8 30.5 7.8s21-9.6 35.4-8.2c6 .2 23 2.4 33.8 17.8-.9.5-20.2 11.4-20 34.1m-23.3-66.6c6.5-7.6 10.8-18.1 9.6-28.6-9.3.4-20.6 6-27.2 13.6-6 6.7-11.2 17.4-9.8 27.7 10.4.8 21-5.1 27.4-12.7m93.551-12.985c4.756-.79 10.118-1.483 15.886-2.175s12.141-.988 19.021-.988c9.916 0 18.415 1.186 25.599 3.46 7.184 2.371 13.052 5.633 17.706 10.08 3.946 3.855 7.083 8.5 9.309 13.738 2.226 5.337 3.339 11.465 3.339 18.383 0 8.401-1.518 15.715-4.553 22.04s-7.184 11.564-12.445 15.814-11.535 7.413-18.82 9.587c-7.285 2.075-15.177 3.163-23.777 3.163-7.79 0-14.266-.593-19.528-1.68v69.579h-11.635v-161.001zm11.636 81.241c2.833.791 5.97 1.384 9.41 1.68s7.183.495 11.13.495c14.873 0 26.306-3.36 34.502-10.18 8.195-6.72 12.242-16.703 12.242-29.75 0-6.325-1.112-11.76-3.237-16.406s-5.16-8.5-9.106-11.464-8.702-5.239-14.064-6.721c-5.464-1.483-11.434-2.273-18.112-2.273-5.26 0-9.814.197-13.659.593s-6.88.89-9.106 1.285zm171.702 52.184c0 4.646.101 9.39.202 14.035.203 4.646.708 9.192 1.518 13.54h-10.927l-1.72-16.405h-.506c-1.518 2.273-3.34 4.547-5.667 6.72a41.22 41.22 0 0 1 -7.993 6.129c-3.035 1.877-6.475 3.36-10.421 4.447-3.845 1.087-8.095 1.68-12.749 1.68-5.767 0-10.826-.89-15.177-2.767s-7.993-4.25-10.725-7.215c-2.833-2.965-4.958-6.424-6.273-10.279-1.416-3.854-2.125-7.709-2.125-11.563 0-13.738 5.869-24.215 17.707-31.627s29.544-10.97 53.321-10.674v-3.163c0-3.064-.303-6.523-.91-10.476s-1.821-7.71-3.845-11.267-4.958-6.524-8.904-8.896-9.308-3.656-16.087-3.656c-5.16 0-10.22.79-15.177 2.273a49.895 49.895 0 0 0 -13.76 6.424l-3.744-8.5c5.26-3.558 10.725-6.029 16.29-7.61 5.564-1.483 11.433-2.273 17.605-2.273 8.296 0 14.974 1.384 20.134 4.15s9.309 6.326 12.243 10.675 4.958 9.192 6.071 14.627 1.619 10.773 1.619 16.11zm-11.636-34.492c-6.273-.198-12.85.099-19.629.692-6.88.691-13.153 2.075-18.92 4.25s-10.523 5.337-14.368 9.586c-3.743 4.151-5.666 9.785-5.666 16.703 0 8.204 2.429 14.232 7.184 18.087s10.118 5.831 16.088 5.831c4.755 0 9.106-.692 12.85-1.976s7.082-3.064 9.915-5.239 5.16-4.645 7.082-7.412 3.34-5.535 4.351-8.5c.81-3.261 1.214-5.535 1.214-7.017zm34.3-53.964 30.152 75.41c1.618 4.152 3.237 8.5 4.755 12.948s2.833 8.5 3.946 12.255h.506c1.113-3.558 2.428-7.51 3.946-11.958s3.137-8.994 4.958-13.64l28.229-74.916h12.344l-34.401 85.096c-3.44 8.994-6.78 17.198-9.815 24.511s-6.172 13.936-9.308 19.866-6.273 11.07-9.511 15.616-6.78 8.5-10.725 11.86c-4.654 4.052-8.904 7.017-12.749 8.796-3.845 1.878-6.475 3.064-7.79 3.46l-3.947-9.39c2.935-1.285 6.274-2.965 9.916-5.04s7.184-4.843 10.624-8.204c2.934-2.866 6.273-6.72 9.814-11.465s6.678-10.476 9.511-17.296c1.012-2.57 1.518-4.25 1.518-5.04 0-1.087-.506-2.866-1.518-5.04l-42.798-107.533h12.344z" fill="#010101" /></svg>
                </span>
                <div>
                  <p className="font-semibold text-lg sm:text-xl">Apple Pay</p>
                  <p className="text-gray-500 text-sm">
                    Pay seamlessly with your Apple devices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // STRIPE PAYMENT FORM SCREEN
          <div className="w-full max-w-2xl rounded-3xl p-4 sm:p-8">
            <button
              onClick={() => setShowStripeForm(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Payment Methods
            </button>
            <div className="mb-8 sm:mb-12 text-center max-w-2xl">
              <h1 className="font-extrabold text-3xl sm:text-4xl text-gray-900 mb-4">
                Complete Your Payment
              </h1>
              <p className="text-base sm:text-lg text-gray-600">
                Secure payment powered by Stripe
              </p>
            </div>
            <Elements stripe={stripePromise}>
              <StripePaymentForm
                pricingPlanId={selectedPlan?.id ?? ''}
                amount={checkoutAmount ?? (selectedPlan ? parseFloat(String(selectedPlan.price)) : 0)}
                planTitle={selectedPlan?.name ?? ''}
                couponCode={checkoutCouponCode}
                onSuccess={() => {
                  navigate("/", {
                    state: {
                      paymentSuccess: true,
                      planTitle: selectedPlan?.name ?? '',
                    },
                  });
                }}
                onError={(error) => {
                  console.error("Payment error:", error);
                }}
              />
            </Elements>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
