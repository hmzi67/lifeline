import React from 'react';
import heroImg2 from '../../assets/images/affiliatehero/business hero.webp'
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const EmployeeWellbeingLanding: React.FC = () => {

  const { isAuthenticated } = useAuth();
  return (
    <>
      <div className="h-full aspect-square lg:aspect-video  overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 aspect-[1/1] lg:aspect-[16/9]">
          <img
            src={heroImg2}
            alt="Background"
            className="w-full h-full object-cover object-right"
          />
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-col lg:flex-row items-center justify-between px-8 sm:py-10 py-0 max-w-7xl mx-auto hidden md:flex ">
          {/* Left Content */}
          <div className="lg:w-1/2 text-white sm:mb-12 mb-0 lg:mb-0 pt-20">
            <h1 className="text-5xl lg:text-4xl font-semibold leading-tight mt-10">
              RETHINK{' '}
              <span className="text-primary">EMPLOYEE</span>
              <br />
            </h1>
            <h1 className="text-4xl lg:text-8xl leading-tight text mb-6">
              WELLBEING
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-lg leading-relaxed">
              Cultivate a healthy, thriving, and unstoppable workforce with BetterMe's health transformation ecosystem
            </p>

            {
              isAuthenticated ?
                <Link to='/questions'>
                  <button className="bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-600 transition-all duration-300 transform hover:scale-105">
                    Update Information
                  </button>
                </Link> : <Link to='/signup'>
                  <button className="bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-600 transition-all duration-300 transform hover:scale-105">
                    Get Started
                  </button>
                </Link>
            }

          </div>
        </div>
      </div>

      <div className="relative z-10 flex-col lg:flex-row items-center justify-between px-8 max-w-7xl mx-auto flex md:hidden ">
        {/* Left Content */}
        <div className="lg:w-1/2 sm:mb-12 mb-0  lg:mb-0 sm:-translate-y-0 -translate-y-16">
          <h1 className="text-4xl lg:text-5xl font-semibold leading-tight mt-10 text-gray-900">
            YOUR{' '}
            <span className="text-primary">FITNESS</span>
            <br />
          </h1>
          <h1 className="text-4xl lg:text-9xl leading-tight font-semibold text mb-6 text-gray-900">
            PARTNER
          </h1>
          <p className="text-base sm:text-xl  mb-8 max-w-lg leading-relaxed">
            Cultivate a healthy, thriving, and unstoppable workforce with BetterMe's health transformation ecosystem
          </p>

          <Link to="./signup">
            <button className="bg-primary text-white px-6 py-2 rounded-lg text-lg font-semibold hover:bg-primary-600 transition-all duration-300 transform hover:scale-105">
              Get Started
            </button>
          </Link>

        </div>
      </div>
    </>
  );
};

export default EmployeeWellbeingLanding;