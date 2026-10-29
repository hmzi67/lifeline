import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import menimg from "@/assets/images/question/man-gender.webp";
import womenimg from "@/assets/images/question/women-gender.jpeg";
import api from '@/lib/axios'; 

interface GenderOption {
    id: 'male' | 'female';
    label: string;
    image: string;
}

interface GenderSelectorProps {
    onGenderSelect?: (gender: 'male' | 'female') => void;
    onContinue?: (gender: 'male' | 'female') => void;
}

const normalizeGender = (gender: 'male' | 'female'): 'Male' | 'Female' => {
    return gender === 'male' ? 'Male' : 'Female';
};

const GenderSelector: React.FC<GenderSelectorProps> = ({ onGenderSelect, onContinue }) => {
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);
    const [, setLoading] = useState(false);

    // Fetch previously-selected gender on mount
    useEffect(() => {
        const fetchGender = async () => {
            try {
                setLoading(true);
                const res = await api.get('/questionnaire/gender');
                const genderFromApi = res?.data?.data?.gender;
                // Normalize backend value to lowercase for UI selections
                if (genderFromApi === 'Male') setSelectedGender('male');
                else if (genderFromApi === 'Female') setSelectedGender('female');
            } catch {
                // Optionally handle error
            } finally {
                setLoading(false);
            }
        };
        fetchGender();
    }, []);

    const genderOptions: GenderOption[] = [
        { id: 'male', label: 'Male', image: menimg },
        { id: 'female', label: 'Female', image: womenimg }
    ];

    // Save gender to backend with capitalized value when user selects a card
    const handleGenderSelect = async (gender: 'male' | 'female') => {
        setSelectedGender(gender);
        onGenderSelect?.(gender);
        setLoading(true);
        try {
            const response = await api.put('/questionnaire/gender', { gender: normalizeGender(gender) });

            if (response.status == 200) {
                handleContinue(gender);
            }
        } catch {
            // Optionally handle API errors here
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = (gender?: 'male' | 'female') => {
        const g = gender ?? selectedGender;
        if (g) {
            onContinue?.(g);
        }
    };

    return (
        <div className="flex items-center justify-center py-12 px-4">
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4">
                        How would you describe your gender?
                    </h1>
                    <p className="text-base md:text-xl text-gray-600 font-medium">
                        Lose weight, tone up and gain strength at home
                    </p>
                </div>

                {/* Gender Cards */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center mb-6">
                    {genderOptions.map((option) => (
                        <div
                            key={option.id}
                            onClick={() => handleGenderSelect(option.id)}
                            className={`relative rounded-3xl cursor-pointer transition-all duration-300 transform hover:scale-105`}
                        >
                            <div className="flex justify-center mb-8">
                                <div
                                    className={`relative sm:w-64 sm:h-64 w-36 h-36 rounded-2xl overflow-hidden shadow-lg ${selectedGender === option.id ? 'ring-4 ring-primary-400 shadow-2xl' : 'shadow-xl ring-4 ring-white hover:shadow-xl'}`}
                                >
                                    <img
                                        src={option.image}
                                        alt={option.label}
                                        className="w-full h-full object-cover"
                                    />
                                    {selectedGender === option.id && (
                                        <div className="absolute top-2 right-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center shadow-lg z-10">
                                            <Check className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-3xl font-semibold text-gray-800 sm:block hidden">
                                    {option.label}
                                </h3>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="text-center text-xs sm:text-base text-gray-500 space-y-2 mb-6">
                    <p>
                        By selecting your gender and continuing, you agree to our Terms of Service and Privacy Policy. <br /> Please review them before proceeding.
                        <a href="#" className="text-primary-500 hover:text-primary-600 underline">Terms of Service</a> |{' '}
                        <a href="#" className="text-primary-500 hover:text-primary-600 underline">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GenderSelector;
