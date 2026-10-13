import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  LifeBuoy,
  Mail,
  Minus,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

const SUPPORT_EMAIL = "support@lifeline.com";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQGroup {
  title: string;
  icon: React.ElementType;
  items: FAQItem[];
}

const FAQ_GROUPS: FAQGroup[] = [
  {
    title: "Account & sign in",
    icon: UserCircle,
    items: [
      {
        question: "How do I create a Lifeline account?",
        answer:
          "Open the app or visit our website and sign up with your email address, Google or Sign in with Apple. You'll then answer a few onboarding questions so we can personalise your plan.",
      },
      {
        question: "I forgot my password. What should I do?",
        answer:
          "On the login screen tap “Forgot password” and enter your email address. We'll send you a link to reset it. If you signed up with Google or Apple, sign in with that provider instead — there's no separate password.",
      },
      {
        question: "I used “Hide My Email” with Sign in with Apple. How do I contact you?",
        answer:
          "Email us from any address and include the relay email shown in your Apple ID settings so we can find your account.",
      },
    ],
  },
  {
    title: "Subscriptions & billing",
    icon: CreditCard,
    items: [
      {
        question: "How do I cancel or change my subscription?",
        answer:
          "If you subscribed in the iOS app, go to Settings → [your name] → Subscriptions → Lifeline on your iPhone. If you subscribed on Android, use Google Play → Payments & subscriptions. Web subscriptions can be managed from your profile on our website.",
      },
      {
        question: "How do I restore my purchases on a new device?",
        answer:
          "Sign in with the same account you used before, then tap “Restore purchases” on the subscription screen. Your plan will be linked back to your account.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Purchases made through the App Store are refunded by Apple — request one at reportaproblem.apple.com. For Google Play or web purchases, contact us and we'll help.",
      },
    ],
  },
  {
    title: "Using the app",
    icon: Smartphone,
    items: [
      {
        question: "My data isn't syncing between devices.",
        answer:
          "Make sure you're signed in to the same account on each device and have an internet connection. Pull down to refresh, or sign out and back in. If it still doesn't sync, email us with your device model and app version.",
      },
      {
        question: "How do I update my goals or diet preferences?",
        answer:
          "Go to your profile and choose “Update information” to retake the questionnaire. Your diet and exercise plans will be regenerated from your new answers.",
      },
      {
        question: "I'm not receiving reminders.",
        answer:
          "Check that notifications are enabled for Lifeline in your phone's settings, and that the reminder (water, medication, sleep, etc.) is switched on inside the app.",
      },
    ],
  },
  {
    title: "Privacy & data",
    icon: ShieldCheck,
    items: [
      {
        question: "How is my personal data used?",
        answer: (
          <>
            We only use your data to provide and improve Lifeline. Read the full
            details in our{" "}
            <Link to="/privacy" className="text-primary-600 hover:text-primary-700 font-medium">
              Privacy Policy
            </Link>
            .
          </>
        ),
      },
      {
        question: "How do I delete my account?",
        answer: (
          <>
            You can delete your account from the app's profile settings, or on
            the web at our{" "}
            <Link to="/delete-account" className="text-primary-600 hover:text-primary-700 font-medium">
              account deletion page
            </Link>
            . Deletion is permanent and removes your tracked data.
          </>
        ),
      },
    ],
  },
];

const Support: React.FC = () => {
  const [openKey, setOpenKey] = useState<string>("0-0");

  return (
    <div className="bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-400 to-primary-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl py-16 sm:py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-5">
            <LifeBuoy className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            Lifeline Support
          </h1>
          <p className="text-white/90 text-base sm:text-lg max-w-2xl mx-auto">
            Answers to common questions about your account, subscriptions and
            the Lifeline app. Can't find what you need? Our team is one email
            away.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-block mt-8">
            <Button className="rounded-full bg-white text-primary-600 hover:bg-white/90 font-semibold px-6 py-2.5 h-auto shadow-md">
              <Mail className="w-4 h-4" />
              Email {SUPPORT_EMAIL}
            </Button>
          </a>
        </div>
      </section>

      {/* Quick links */}
      <section className="container mx-auto px-4 sm:px-6 max-w-5xl -mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <Mail className="w-6 h-6 text-primary-500 mb-3" />
            <h2 className="font-semibold text-gray-900">Contact us</h2>
            <p className="text-sm text-gray-600 mt-1">
              Include your account email, device and app version so we can help
              faster.
            </p>
          </a>
          <Link
            to="/privacy"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <ShieldCheck className="w-6 h-6 text-primary-500 mb-3" />
            <h2 className="font-semibold text-gray-900">Privacy Policy</h2>
            <p className="text-sm text-gray-600 mt-1">
              How we collect, use and protect your information.
            </p>
          </Link>
          <Link
            to="/delete-account"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <Trash2 className="w-6 h-6 text-red-500 mb-3" />
            <h2 className="font-semibold text-gray-900">Delete account</h2>
            <p className="text-sm text-gray-600 mt-1">
              Permanently remove your Lifeline account and data.
            </p>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 sm:px-6 max-w-5xl py-14 sm:py-20">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-10">
          <span className="text-primary-400">Frequently</span> Asked Questions
        </h2>

        <div className="space-y-10">
          {FAQ_GROUPS.map((group, groupIndex) => {
            const Icon = group.icon;
            return (
              <div key={group.title}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {group.title}
                  </h3>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
                  {group.items.map((item, itemIndex) => {
                    const key = `${groupIndex}-${itemIndex}`;
                    const isOpen = openKey === key;
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() => setOpenKey(isOpen ? "" : key)}
                          className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4"
                          aria-expanded={isOpen}
                        >
                          <span className="font-medium text-gray-900">
                            {item.question}
                          </span>
                          {isOpen ? (
                            <Minus className="w-5 h-5 text-primary-500 shrink-0" />
                          ) : (
                            <Plus className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <p className="px-5 sm:px-6 pb-5 -mt-1 text-sm text-gray-600 leading-relaxed">
                            {item.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Still need help */}
        <div className="mt-14 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Still need help?
          </h3>
          <p className="text-gray-600 mb-6">
            Send us a message and a member of the Lifeline team will get back to
            you.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Button className="rounded-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold px-6 py-2.5 h-auto">
              <Mail className="w-4 h-4" />
              Email support
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default Support;
