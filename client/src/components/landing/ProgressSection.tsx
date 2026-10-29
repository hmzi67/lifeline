import React from 'react';
import { Check } from "lucide-react";
import progressTrackerImage from "../../assets/images/landing/trackerSectionBoth.webp"
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Fixed mobile layout to match the design image

export const ProgressSection: React.FC = () => {
    const desktopFeatures = [
        "Heart Rate Tracker",
        "Steps Counter",
        "Sleep Tracking",
        "Water Intake",
        "Calories Counter"
    ];

    const mobileFeatures = [
        "Increase Muscle and Strength",
        "Be Healthier than before",
        "Increase Stamina"
    ];

    const { isAuthenticated } = useAuth();

    return (
        <div className="py-12 sm:py-16 lg:py-20 bg-white">
            {/* Desktop Layout */}
            <div className="hidden lg:block">
                <div className="flex items-center">
                    {/* Left Content - Contained */}
                    <div className="w-1/2 pl-8 xl:pl-16 2xl:pl-24 pr-8">
                        <div className="max-w-xl">
                            <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-bold mb-6 leading-tight">
                                <span className="text-teal-400">Track</span> Your <br />
                                Fitness, <span className="text-teal-400">See</span> Your <br />
                                Progress
                            </h1>

                            <ul className="mt-8 space-y-4">
                                {desktopFeatures.map((item) => (
                                    <li key={item} className="flex items-center text-lg xl:text-xl">
                                        <div className="w-4 h-4 sm:w-5 sm:h-5 me-2 bg-primary-400 text-white rounded-full flex items-center justify-center">
                                            <Check className="w-4 h-4 " />
                                        </div>
                                        <span className="text-gray-700">{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-10 flex items-center gap-6">
                                {
                                    isAuthenticated ?
                                        <Link to="/questions">
                                            <Button className="bg-teal-400 hover:bg-primary-500 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg transition-all duration-300">
                                                Update Information
                                            </Button>
                                        </Link> : <Link to="/signup">
                                            <Button className="bg-teal-400 hover:bg-primary-500 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg transition-all duration-300">
                                                Buy Now
                                            </Button>
                                        </Link>
                                }
                                <button className="text-lg font-semibold text-gray-700 hover:text-primary-400 transition-colors duration-300">
                                    Download App
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Image - Extends beyond screen */}
                    <div className="w-1/2 flex justify-start overflow-hidden">
                        <img
                            className="w-full max-w-none h-auto ml-8 xl:ml-16"
                            src={progressTrackerImage}
                            alt="Fitness Progress Tracker"
                        />
                    </div>
                </div>
            </div>

            {/* Mobile/Tablet Layout - Fixed to match design */}
            <div className="block lg:hidden">
                <div className="px-4 sm:px-6">
                    {/* Header at Top - Centered */}
                    <div className="text-center mb-8 sm:mb-10">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                            <span className="text-primary-400">Track</span> Your Fitness, <span className="text-primary-400">See</span> Your Progress
                        </h1>
                    </div>

                    {/* Image - Centered */}
                    <div className="flex justify-center mb-4 sm:mb-4 translate-x-6">
                        <img
                            className="w-full h-auto"
                            src={progressTrackerImage}
                            alt="Fitness Progress Tracker"
                        />
                    </div>

                    {/* Features List Below Image - Positioned to the right */}
                    <div className="mb-4 sm:mb-8 flex justify-end">
                        <ul className="space-y-3 sm:space-y-4">
                            {mobileFeatures.map((item) => (
                                <li key={item} className="flex items-center text-base sm:text-lg md:text-xl">
                                    <div className="w-5 h-5 sm:w-7 sm:h-7 me-1 bg-primary-400 rounded-full text-white flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                    </div>
                                    <span className="text-black font-normal">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Buttons at Bottom - Centered */}
                    <div className="flex items-center justify-end gap-4 sm:gap-6 -translate-x-10">
                        <Button className="bg-primary-400 hover:bg-primary-500 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-semibold shadow-lg transition-all duration-300">
                            Try Now
                        </Button>
                        <button className="text-sm sm:text-base font-semibold text-gray-700 hover:text-primary-400 transition-colors duration-300">
                            Contact us
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};