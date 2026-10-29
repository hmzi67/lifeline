// done
import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { Star } from 'lucide-react';

// Import Swiper styles
import 'swiper/swiper-bundle.css';

interface Testimonial {
    name: string;
    rating: number;
    text: string;
}

// Initials instead of photos: these are not real customer pictures, and a
// random-image service showed a different face on every visit.
const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

export const TestimonialsSection: React.FC = () => {
    const testimonials: Testimonial[] = [
        {
            name: "Lina Williams",
            rating: 5,
            text: "I didn’t realize how little I moved until I started using this band. Now I actually look forward to checking my steps.",
        },
        {
            name: "Maria Lopez",
            rating: 4,
            text: "I check my heart rate during workouts with the band. It keeps me from overdoing it, which I really appreciate",
        },
        {
            name: "Daniel Reyes",
            rating: 5,
            text: "The sleep tracker is surprisingly accurate! I woke up and saw exactly why I felt tired. Super helpful.",
        },
        {
            name: "James Carter",
            rating: 4,
            text: "It’s become part of my routine. Steps, sleep, heart rate—all in one place without me having to worry about it.",
        },
    ];

    return (
        <section className="py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h4 className="text-lg sm:text-xl text-primary mb-4">Hear from our satisfied users!</h4>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Health Made Simple, Progress Made Real</h2>
                <p className="text-base sm:text-lg text-gray-600 max-w-xl sm:max-w-3xl mx-auto">
                    Join thousands of satisfied users who have transformed their lives with our comprehensive wellness platform.
                </p>
            </div>
            <div className="relative">
                <Swiper
                    modules={[Pagination]}
                    spaceBetween={20}
                    slidesPerView={1}
                    pagination={{
                        clickable: true,
                        bulletClass: 'swiper-pagination-bullet !bg-teal-400',
                        bulletActiveClass: 'swiper-pagination-bullet-active !bg-teal-600',
                    }}
                    breakpoints={{
                        640: { slidesPerView: 1 },
                        768: { slidesPerView: 2 },
                        1024: { slidesPerView: 3 },
                    }}
                    className="testimonials-swiper !pb-12"
                >
                    {testimonials.map((testimonial, index) => (
                        <SwiperSlide key={index}>
                            <div className="bg-white rounded-2xl p-4 sm:p-6 border shadow-sm hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
                                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                                    <div
                                        aria-hidden="true"
                                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-xl sm:text-2xl font-semibold"
                                    >
                                        {initials(testimonial.name)}
                                    </div>
                                    <h4 className="font-semibold text-gray-900 text-lg sm:text-xl">{testimonial.name}</h4>
                                </div>
                                <div className="flex w-full justify-center sm:justify-start items-center gap-1 mb-4">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star key={i} className="w-3 h-3 sm:w-4 sm:h-4 text-primary fill-primary" />
                                    ))}
                                </div>
                                <p className="text-gray-600 leading-relaxed mt-auto text-sm sm:text-base">
                                    "{testimonial.text}"
                                </p>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </section>
    );
};
