import MenGraph from "@/assets/images/question/men_graph.webp";
import WomenGraph from "@/assets/images/question/women_graph.png";
import GraphImage from "@/assets/images/question/graph.png";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";

interface FitnessGoalCardProps {
  gender: string;
  onSelect?: (isSelected: boolean) => void;
  isSelected?: boolean;
  onBack?: () => void;
  hasPaid?: boolean;
}

export const FitnessGraph: React.FC<FitnessGoalCardProps> = ({
  gender,
  hasPaid = false,
}) => {

  const navigate = useNavigate();
  const [message, setMessage] = useState("1")
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isUserLoading, setIsUserLoading] = useState(true)

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/user/profile')
      setCurrentUser(res?.data?.data?.user?.username ?? "there")
    } catch {
      setCurrentUser("there")
    } finally {
      setIsUserLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrentUser()

    // Already subscribed: let the user choose to skip or change their plan
    // instead of forcing them back through checkout.
    if (hasPaid) {
      setMessage("");
      return;
    }

    const timer = setTimeout(() => {
      setMessage("")
      navigate('/plan')
    }, 7000);

    // cleanup timer on unmount
    return () => clearTimeout(timer);
  }, [hasPaid]);

  if (isUserLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="">
      <div
        className={`rounded-2xl p-0 transition-all duration-300 max-w-6xl mx-auto`}
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          {/* Graph Section */}
          <div className="flex-1">
            <div className="text-center mb-8 lg:mb-12">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-pink-500 mb-4">
                {currentUser}, your wish is our command
              </h1>
              <p className="text-gray-600 text-base sm:text-lg md:text-xl">
                Empowering Dreams, Visualizing Success!
              </p>
              <p className='font-bold text-xl md:text-2xl text-primary mt-4'>
                Active goal graph
              </p>
            </div>
            <img
              src={GraphImage}
              alt="Active goal graph"
              className='h-auto max-h-80 w-full object-contain'
            />
          </div>

          {/* Model Section */}
          <div className="flex-shrink-0 hidden lg:flex">
            {gender === 'female' ? (
              <img
                src={WomenGraph}
                alt="Female Fitness Model"
                className="w-48 h-auto object-contain"
              />
            ) : (
              <img
                src={MenGraph}
                alt="Male Fitness Model"
                className="w-48 h-auto object-contain"
              />
            )}
          </div>
        </div>
        <div className="w-full flex items-center justify-center text-gray-700 mt-8">
          {
            message &&
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-xs sm:text-sm">Redirecting to pricing. Please wait...</p>
            </>
          }
        </div>

        {hasPaid && (
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 rounded-xl font-bold border border-primary text-primary hover:bg-primary-50 transition-all duration-300"
            >
              Skip
            </button>
            <button
              onClick={() => navigate('/plan')}
              className="px-8 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary-600 shadow-md hover:shadow-lg transition-all duration-300"
            >
              Update Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};