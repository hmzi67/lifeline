// done
import React from 'react';
import phoneImage from "@/assets/images/landing/reasons-1.webp";

export const ReasonsSection: React.FC = () => {
    return (
        <section className="py-10 bg-white relative overflow-hidden md:py-20">
            <div className="container mx-auto px-4 relative md:px-6">
                {/* Section Header */}
                <div className="text-center mb-10 md:mb-20">
                    <p className="text-primary font-medium text-sm tracking-wider uppercase mb-2 md:mb-4">
                        WHY LIFELINE
                    </p>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight md:text-4xl lg:text-6xl">
                        Reasons To <span className="text-primary">Run</span> With Us!
                    </h2>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 gap-10 md:gap-16 md:grid-cols-3 items-center max-w-7xl mx-auto">
                    {/* Left Column */}
                    <div className="space-y-10 md:space-y-24">
                        {/* BE HEALTHY - Left Aligned */}
                        <div className="text-left relative">
                            <div className="relative">
                                <div className="absolute -top-4 -left-6 text-6xl font-bold text-primary-200 opacity-50 z-0 md:-top-16 md:-left-12 md:text-8xl lg:text-9xl">
                                    01
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3 md:gap-4 md:mb-6">
                                        <h3 className="text-xl font-bold text-primary tracking-wide whitespace-nowrap md:text-2xl lg:text-3xl">
                                            BE HEALTHY
                                        </h3>
                                        <div className="hidden md:flex flex-1 h-0.5 bg-primary"></div>
                                    </div>
                                    <p className="text-gray-500 text-base leading-relaxed max-w-xs md:text-lg md:max-w-sm">
                                        Fresh air and early morning running trips sure can cure almost anything.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* FEEL FREE - Left Aligned */}
                        <div className="text-left relative">
                            <div className="relative">
                                <div className="absolute -top-4 -left-6 text-6xl font-bold text-primary-200 opacity-50 z-0 md:-top-16 md:-left-12 md:text-8xl lg:text-9xl">
                                    02
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3 md:gap-4 md:mb-6">
                                        <h3 className="text-xl font-bold text-primary tracking-wide whitespace-nowrap md:text-2xl lg:text-3xl">
                                            FEEL FREE
                                        </h3>
                                        <div className="hidden md:flex flex-1 h-0.5 bg-primary"></div>
                                    </div>
                                    <p className="text-gray-500 text-base leading-relaxed max-w-xs md:text-lg md:max-w-sm">
                                        Nothing makes you feel more free and independent as running open road.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Center Phone Mockup */}
                    <div className="relative flex justify-center order-first md:order-none">
                        <div className="relative">
                            <img
                                src={phoneImage}
                                alt="Fitness app interface"
                                className="w-64 h-auto max-w-full drop-shadow-xl md:w-80 lg:w-96"
                            />
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-10 md:space-y-24">
                        {/* BE ONE OF US - Right Aligned */}
                        <div className="text-left md:text-right relative">
                            <div className="relative">
                                <div className="absolute -top-4 -left-6 md:-right-6 md:left-auto text-6xl font-bold text-primary-200 opacity-50 z-0 md:-top-16 md:text-8xl lg:text-9xl">
                                    03
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3 md:gap-4 md:mb-6">
                                        <div className="hidden md:flex flex-1 h-0.5 bg-primary"></div>
                                        <h3 className="text-xl font-bold text-primary tracking-wide whitespace-nowrap md:text-2xl lg:text-3xl">
                                            BE ONE OF US
                                        </h3>
                                    </div>
                                    <p className="text-gray-500 text-base text-left md:text-right leading-relaxed max-w-xs mr-auto md:ml-auto md:text-lg md:max-w-sm">
                                        By joining our group, you get to experience 100% unforgettable moments.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* BE STRONG - Right Aligned */}
                        <div className="text-left md:text-right relative">
                          <div className="relative">
                              <div className="absolute -top-4 -left-6 md:-right-6 text-6xl font-bold text-primary-200 opacity-50 z-0 md:-top-16 md:text-8xl lg:text-9xl">
                                  04
                              </div>
                              <div className="relative z-10">
                                  <div className="flex items-center gap-2 mb-3 md:gap-4 md:mb-6">
                                      <div className="hidden md:flex flex-1 h-0.5 bg-primary"></div>
                                      <h3 className="text-xl font-bold text-primary tracking-wide whitespace-nowrap md:text-2xl lg:text-3xl">
                                          BE STRONG
                                      </h3>
                                  </div>
                                  <p className="text-gray-500 text-base leading-relaxed max-w-xs mr-auto md:ml-auto md:text-lg md:max-w-sm text-start md:text-end">
                                      Regular running helps you stay fit, healthy and hardy no matter what.
                                  </p>
                              </div>
                          </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
