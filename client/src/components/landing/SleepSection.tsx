import React, { useState } from 'react';
import { Check, Download, X, Play } from 'lucide-react';
import sleepimg from '@/assets/images/landing/sleeping img.webp';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const SleepSection: React.FC = () => {
    const [isVideoOpen, setIsVideoOpen] = useState(false);

    // Replace this with your actual YouTube video ID
    const youtubeVideoId = "dQw4w9WgXcQ"; // Example: Rick Roll video ID


    const { isAuthenticated } = useAuth();

    const openVideoDialog = () => {
        setIsVideoOpen(true);
    };

    const closeVideoDialog = () => {
        setIsVideoOpen(false);
    };

    return (
        <div className="h-full overflow-hidden">
            <div className="py-4 sm:py-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-8 lg:gap-16 items-center">
                    {/* Left Side - Hero Video/Image - Hidden on mobile, shown on lg+ */}
                    <div className="lg:col-span-3 relative hidden lg:block">
                        <div
                            className="relative cursor-pointer group -translate-x-4"
                            onClick={openVideoDialog}
                        >
                            <img
                                src={sleepimg}
                                className="w-full h-auto"
                                alt="sleeping img with mobile mockup"
                            />
                            {/* Play button overlay */}
                            <div className="absolute sm:right-64 right-[150px] inset-0 flex items-center justify-center">
                                <div className="relative">
                                    {/* Animated border */}
                                    <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-white/20 animate-ping"></div>

                                    {/* Main button */}
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/90 rounded-full flex items-center justify-center">
                                        <Play className="w-6 h-6 sm:w-8 sm:h-8 text-primary ml-1" fill="currentColor" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Text Content */}
                    <div className="lg:col-span-2 text-left px-4 sm:px-0">
                        <h1 className="text-2xl sm:text-5xl lg:text-5xl font-bold mb-4 sm:mb-6 lg:mb-12 tracking-wider">
                            Get <span className="text-primary">Better</span> Sleep <br className='hidden sm:block' />
                            Now With <span className="text-primary">Us!</span>
                        </h1>

                        {/* Mobile Image - Only shown on mobile screens, placed after h1 */}
                        <div className="lg:hidden mb-4 sm:mb-6 -translate-x-7 w-full">
                            <div
                                className="relative cursor-pointer group"
                                onClick={openVideoDialog}
                            >
                                <img
                                    src={sleepimg}
                                    className="w-full h-auto"
                                    alt="sleeping img with mobile mockup"
                                />
                                {/* Play button overlay */}
                                <div className="absolute sm:right-64 right-[150px] inset-0 flex items-center justify-center">
                                    <div className="relative">
                                        {/* Animated border */}
                                        <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-white/20 animate-ping"></div>

                                        {/* Main button */}
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/90 rounded-full flex items-center justify-center">
                                            <Play className="w-6 h-6 sm:w-8 sm:h-8 text-primary ml-1" fill="currentColor" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats - Hidden on mobile, shown on lg+ */}
                        <div className="hidden lg:block space-y-3 sm:space-y-4 lg:space-y-6 mb-3 sm:mb-4">
                            <div className="flex items-center gap-y-3 lg:gap-x-16">
                                <div className="">
                                    <div className="text-sm sm:text-2xl font-bold sm:font-bold">Sounds</div>
                                    <div className="text-xl sm:text-2xl lg:text-4xl font-bold">99+</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary text-sm sm:text-base">Need of about 100 people</div>
                                    <div className="font-bold text-lg sm:text-xl lg:text-3xl">Calm & Mindful Sleep</div>
                                </div>
                            </div>
                            <hr className="my-1 sm:my-2" />
                            <div className="flex items-center gap-y-3 lg:gap-x-16">
                                <div className="">
                                    <div className="text-sm sm:text-2xl font-bold sm:font-bold ">Stories</div>
                                    <div className="text-xl sm:text-2xl lg:text-4xl font-bold">99+</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary text-sm sm:text-base">Need of about 100 people</div>
                                    <div className="font-bold text-lg sm:text-xl lg:text-3xl">Calm & Mindful Sleep</div>
                                </div>
                            </div>
                            <hr className="my-1 sm:my-2" />
                        </div>
                        {/* Features */}
                        <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-6 lg:mb-8">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-5 h-5 sm:w-7 sm:h-7 bg-primary-400 text-white rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 sm:w-4 sm:h-4 " />
                                </div>
                                <span className="text-sm sm:text-lg lg:text-xl">Increase Muscle and Strength</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-5 h-5 sm:w-7 sm:h-7 bg-primary-400 text-white rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 sm:w-4 sm:h-4 " />
                                </div>
                                <span className="text-sm sm:text-lg lg:text-xl">Be Healthier than before</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-5 h-5 sm:w-7 sm:h-7 bg-primary-400 text-white rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                </div>
                                <span className="text-sm sm:text-lg lg:text-xl">Increase Stamina</span>
                            </div>
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-6 lg:mb-0">
                            {
                                isAuthenticated ?
                                    <Link to="/questions">
                                        <button className="px-5 py-1 sm:px-7 sm:py-2 lg:px-8 lg:py-3 bg-primary hover:bg-primary-600 text-white font-semibold rounded-full transition-all duration-300 hover:scale-105 shadow-lg text-sm sm:text-base lg:text-lg">
                                            Review Information
                                        </button>
                                    </Link> :
                                    <Link to="/signup">
                                        <button className="px-5 py-1 sm:px-7 sm:py-2 lg:px-8 lg:py-3 bg-primary hover:bg-primary-600 text-white font-semibold rounded-full transition-all duration-300 hover:scale-105 shadow-lg text-sm sm:text-base lg:text-lg">
                                            Try Now
                                        </button>
                                    </Link>
                            }
                            <Link to="/contact">
                                <button className="px-5 py-1 sm:px-7 sm:py-2 lg:px-8 lg:py-3 bg-white/10 hover:bg-white/20 font-semibold rounded-full transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-white/20 flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg">
                                    <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                    Contact us
                                </button>
                            </Link>
                        </div>

                        {/* Mobile Stats - Only shown on mobile screens, placed after buttons */}
                        <div className="lg:hidden space-y-3 sm:space-y-4 lg:space-y-6">
                            <div className="flex items-center gap-y-3 lg:gap-x-16">
                                <div className="me-4">
                                    <div className="text-sm sm:text-2xl font-bold sm:font-bold">Sounds</div>
                                    <div className="text-xl sm:text-2xl lg:text-4xl font-bold">99+</div>
                                </div>
                                <div className="text-center ">
                                    <div className="text-primary text-sm sm:text-base">Need of about 100 people</div>
                                    <div className="font-bold text-lg sm:text-xl lg:text-3xl">Calm & Mindful Sleep</div>
                                </div>
                            </div>
                            <hr className="my-1 sm:my-2 w-64" />
                            <div className="flex items-center gap-y-3 lg:gap-x-16">
                                <div className="me-4">
                                    <div className="text-sm sm:text-2xl font-bold sm:font-bold ">Stories</div>
                                    <div className="text-xl sm:text-2xl lg:text-4xl font-bold">99+</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary text-sm sm:text-base">Need of about 100 people</div>
                                    <div className="font-bold text-lg sm:text-xl lg:text-3xl">Calm & Mindful Sleep</div>
                                </div>
                            </div>
                            <hr className="my-1 sm:my-2 w-64" />
                        </div>
                    </div>
                </div>
            </div>

            {/* YouTube Video Dialog */}
            {isVideoOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl mx-4 bg-black rounded-lg overflow-hidden shadow-2xl">
                        {/* Close button */}
                        <button
                            onClick={closeVideoDialog}
                            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>

                        {/* YouTube Video */}
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                className="absolute inset-0 w-full h-full"
                                src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};