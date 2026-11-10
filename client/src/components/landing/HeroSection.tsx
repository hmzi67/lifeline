import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import hero1 from "@/assets/images/landing/hero-1.webp";
import hero2 from "@/assets/images/landing/hero-2.webp";
import hero3 from "@/assets/images/landing/hero-3.webp";
import hero1Small from "@/assets/images/landing/hero-1-960.webp";
import hero2Small from "@/assets/images/landing/hero-2-960.webp";
import hero3Small from "@/assets/images/landing/hero-3-960.webp";
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const HeroSection: React.FC = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Memoize image array to prevent recreation on every render
  const images = React.useMemo(() => [
    { large: hero1, small: hero1Small },
    { large: hero2, small: hero2Small },
    { large: hero3, small: hero3Small },
  ], []);

  // Use useCallback to prevent recreation of an interval function
  const nextImage = useCallback(() => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const interval = setInterval(nextImage, 5000);
    return () => clearInterval(interval);
  }, [nextImage]);

  // check if the user is authenticated
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative min-h-[50vh] lg:min-h-screen overflow-hidden">
      {/* Background Images Container */}
      <div className="absolute inset-0 w-full h-full">
        <div className="w-full h-full aspect-[1/1] lg:aspect-[16/9] relative">
          {/* A real <img> (not a CSS background) so the browser finds and prioritises the LCP image early */}
          <img
            src={images[currentImageIndex].large}
            srcSet={`${images[currentImageIndex].small} 960w, ${images[currentImageIndex].large} 1920w`}
            sizes="100vw"
            alt=""
            width={1920}
            height={1240}
            fetchPriority={currentImageIndex === 0 ? 'high' : 'auto'}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-1000 ease-in-out"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40" />
        </div>
      </div>

      {/* Decorative elements with improved positioning */}
      <div className="absolute top-2 left-2 text-white/30 text-lg font-light md:text-3xl md:top-10 md:left-10 select-none pointer-events-none">
        +
      </div>
      <div className="absolute top-1/2 right-2 text-white/20 text-xl font-light md:text-4xl md:right-20 select-none pointer-events-none animate-pulse">
        +
      </div>
      <div className="absolute bottom-10 right-4 text-white/25 text-lg font-light md:text-3xl md:bottom-20 md:right-1/3 select-none pointer-events-none">
        +
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-[50vh] lg:min-h-screen flex items-center">
        <div className="container mx-auto px-4 md:px-6 lg:px-12">
          <div className="max-w-2xl animate-fade-in">
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-bold leading-tight text-white mb-4 md:mb-8 drop-shadow-lg">
              YOUR FITNESS{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600 animate-gradient">
                PARTNER!
              </span>
            </h1>
            <p className="text-sm md:text-lg lg:text-xl text-white/90 leading-relaxed mb-6 md:mb-12 max-w-xl drop-shadow-md">
              Personalized workout, diet and fasting plans, with water, sleep
              and progress tracking, all in one app.
            </p>
            <div className="animate-bounce-subtle">
              {
                isAuthenticated ? <Link to="/questions">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary-600 text-white font-semibold px-4 py-2 md:px-8 md:py-4 text-base md:text-lg rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95"
                  >
                    Update Information
                  </Button>

                </Link> : <Link to="/signup">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary-600 text-white font-semibold px-4 py-2 md:px-8 md:py-4 text-base md:text-lg rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95"
                  >
                    Get Started
                  </Button>

                </Link>
              }


            </div>
          </div>
        </div>
      </div>
    </section>
  );
};