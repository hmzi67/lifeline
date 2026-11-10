// done
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { PlayIcon } from 'lucide-react';
import meditationImage1 from "@/assets/images/landing/meditation-1.webp";
import meditationImage2 from "@/assets/images/landing/meditation-2.webp";
import meditationImage3 from "@/assets/images/landing/meditation-3.webp";
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const MeditationSection: React.FC = () => {
    const [currentCardIndex, setCurrentCardIndex] = useState(0);

    // check if the user is authenticated
    const { isAuthenticated } = useAuth();

    // Card data
    const cards = [
        {
            image: meditationImage2,
            title: "Experience the future of meditation",
            description: "Guided sessions, sleep stories and calming sounds to help you unwind and sleep better"
        },
        {
            image: meditationImage3,
            title: "Mindful Journey & Inner Peace",
            description: "Discover tranquility through guided meditation sessions and breathing exercises"
        }
    ];

    // Auto-slide functionality for cards
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentCardIndex(prev => {
                const nextIndex = prev + 1;
                // Reset to 0 when we reach the end of the first set
                if (nextIndex >= cards.length) {
                    // Use setTimeout to reset without animation
                    setTimeout(() => {
                        setCurrentCardIndex(0);
                    }, 50); // Small delay to ensure smooth transition
                    return nextIndex;
                }
                return nextIndex;
            });
        }, 3000); // Change every 3 seconds

        return () => clearInterval(interval);
    }, [cards.length]);

    return (
        <section className="relative h-[80vh] overflow-hidden">
            {/* Background Image */}
            <div className="absolute inset-0">
                <img
                    src={meditationImage1}
                    alt="Woman meditating with mountain view"
                    className="w-full h-full object-cover"
                />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex items-start justify-center py-10 px-4">
                <div className="container mx-auto px-4 lg:px-12">
                    <div className="max-w-2xl mt-20 md:mt-40">
                        {/* Small subtitle */}
                        <p className="text-white text-xl md:text-2xl mb-4 font-medium">
                            Breathe and relax
                        </p>
                        {/* Main heading */}
                        <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-6 md:mb-12 leading-relaxed">
                            Balance Your Mind & Body <br /> with Guided Meditation and<br /> Mindfulness

                        </h1>
                        {/* CTA Button */}
                        {
                            isAuthenticated ? <Link to="/questions">
                                <Button
                                    size="lg"
                                    className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-6 py-4 md:px-10 md:py-6 text-base md:text-lg rounded-full transition-all duration-300 transform hover:scale-105"
                                >
                                    Review Information
                                </Button>
                            </Link> :
                                <Link to="/signup">
                                    <Button
                                        size="lg"
                                        className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-6 py-4 md:px-10 md:py-6 text-base md:text-lg rounded-full transition-all duration-300 transform hover:scale-105"
                                    >
                                        Start doing today
                                    </Button>
                                </Link>
                        }

                    </div>
                </div>
            </div>

            {/* Floating Cards with Invisible Slider - Bottom Right */}
            <div className="absolute bottom-4 right-0 w-full md:w-[600px] overflow-hidden">
                <div
                    className="flex transition-transform duration-1000 ease-in-out"
                    style={{ transform: `translateX(-${currentCardIndex * (window.innerWidth < 768 ? 300 : 396)}px)` }}
                >
                    {/* Render cards twice for a seamless circular effect */}
                    {[...cards, ...cards].map((card, index) => (
                        <div key={index} className="relative bg-white/15 backdrop-blur-lg rounded-3xl p-4 shadow-2xl w-[90%] md:w-[380px] h-[100px] md:h-[120px] border border-white/20 flex-shrink-0 mr-4">
                            <div className="flex gap-x-2 ">
                                {/* Image with Play Button */}
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={card.image}
                                        alt="Meditation scene"
                                        className=" sm:w-16 sm:h-20 h-16 w-16 mb-2 sm:mb-0 object-cover rounded-xl "
                                    />
                                    {/* Play Button Overlay */}
                                    <button className="absolute inset-0 flex items-center justify-center group">
                                        <div className="w-6 h-6 md:w-7 md:min-h-7  bg-white/90 rounded-full flex items-center justify-center group-hover:bg-white transition-all duration-300 group-hover:scale-110 shadow-lg">
                                            <PlayIcon className="w-2 h-2 md:w-2.5 md:h-2.5 text-gray-700 ml-0.5" fill="currentColor" />
                                        </div>
                                    </button>
                                </div>
                                {/* Text Content */}
                                <div className="flex-1 flex flex-col justify-center">
                                    <h3 className="text-sm md:text-base font-bold text-white mb-1 leading-tight">
                                        {card.title}
                                    </h3>
                                    <p className="text-white/70 text-xs leading-relaxed line-clamp-3">
                                        {card.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-10 left-4 w-2 h-2 bg-white bg-opacity-30 rounded-full animate-pulse"></div>
            <div className="absolute top-1/3 right-10 w-1.5 h-1.5 bg-white bg-opacity-40 rounded-full animate-pulse delay-75"></div>
            <div className="absolute bottom-1/3 left-1/4 w-1 h-1 bg-white bg-opacity-30 rounded-full animate-pulse delay-150"></div>
        </section>
    );
};
