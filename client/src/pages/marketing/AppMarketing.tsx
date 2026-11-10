import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Apple,
  Brain,
  Droplets,
  Dumbbell,
  Moon,
  Pill,
  Timer,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { AppDownload } from "@/components/content/AppDownload";
import heroImage from "@/assets/images/landing/hero-1.webp";
import mockupImage from "@/assets/images/landing/[Mockup] iPhone 18-1.webp";

const FEATURES = [
  {
    icon: Apple,
    title: "Personalised diet plans",
    description: "Meal plans built around your goals, preferences and routine.",
  },
  {
    icon: Dumbbell,
    title: "Workout routines",
    description: "Guided exercise plans that adapt as you get stronger.",
  },
  {
    icon: Brain,
    title: "Guided meditation",
    description: "Short sessions to help you de-stress, focus and recover.",
  },
  {
    icon: Moon,
    title: "Sleep tracking",
    description: "Log your sleep and spot the habits that help you rest better.",
  },
  {
    icon: Droplets,
    title: "Water reminders",
    description: "Stay hydrated with daily targets and gentle nudges.",
  },
  {
    icon: Timer,
    title: "Intermittent fasting",
    description: "Start, track and finish fasts with a simple timer.",
  },
  {
    icon: Pill,
    title: "Medication reminders",
    description: "Never miss a dose with scheduled reminders.",
  },
  {
    icon: Trophy,
    title: "Challenges",
    description: "Join challenges and keep each other motivated.",
  },
  {
    icon: Activity,
    title: "Progress analytics",
    description: "See your trends over time in one clear dashboard.",
  },
];

const STEPS = [
  {
    title: "Tell us about you",
    description: "Answer a few quick questions about your goals and lifestyle.",
  },
  {
    title: "Get your plan",
    description: "Lifeline builds a personalised diet and exercise plan for you.",
  },
  {
    title: "Track and improve",
    description: "Log your day, follow reminders and watch your progress grow.",
  },
];

const AppMarketing: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 container mx-auto px-4 md:px-6 lg:px-12 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white mb-6 drop-shadow-lg">
                Your health,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                  all in one app.
                </span>
              </h1>
              <p className="text-base md:text-lg lg:text-xl text-white/90 leading-relaxed mb-8 max-w-xl">
                Lifeline brings your diet, workouts, sleep, hydration, fasting,
                meditation and medication into one simple, personalised daily
                plan.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary-600 text-white font-semibold px-8 py-4 h-auto text-base md:text-lg rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    Get Started
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-transparent border-white text-white hover:bg-white hover:text-primary-600 font-semibold px-8 py-4 h-auto text-base md:text-lg rounded-lg"
                  >
                    See Pricing
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <img
                src={mockupImage}
                alt="Lifeline app on iPhone"
                className="w-full max-w-sm drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-4">
              Everything you need to{" "}
              <span className="text-primary-400">live better</span>
            </h2>
            <p className="text-gray-600 text-lg">
              One app instead of nine. Lifeline keeps every part of your
              wellbeing connected.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-gray-50 rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-16 sm:py-20 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 text-center mb-12">
            How it <span className="text-primary-400">works</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-400 to-primary-500 text-white font-bold flex items-center justify-center mb-4">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AppDownload />

      {/* Closing CTA */}
      <section className="bg-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
            Start your journey with{" "}
            <span className="text-primary-400">Lifeline</span> today
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Create your free account and get a plan made for you in minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button className="rounded-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold px-8 py-3 h-auto">
                Create free account
              </Button>
            </Link>
            <Link to="/support">
              <Button variant="outline" className="rounded-full px-8 py-3 h-auto">
                Get support
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AppMarketing;
