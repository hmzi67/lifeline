import React from 'react';
import { ArrowRight } from 'lucide-react';
import uniqueFeaturesImage from '../../assets/images/business/UF-1.jpg'
import uniqueFeaturesImage2 from '../../assets/images/business/UF-2.jpg'
import uniqueFeaturesImage3 from '../../assets/images/business/UF-3.jpg'

const UniqueFeatures: React.FC = () => {
  return (
    <section className=" py-8 px-4 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">
          All-in-one <span className="text-primary">Wellness</span> Solution
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          One app with endless wellness possibilities for your team
        </p>
      </div>

      {/* Features Container with Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-1/2 transform -translate-x-1/2 w-1 bg-gray-300 h-full hidden lg:block">
          {/* Timeline dots */}
          <div className="absolute top-0 w-[20px] h-[20px] bg-gray-300 rounded-full -translate-x-2"></div>
          <div className="absolute left-0 top-32 -translate-y-1/2">
            <div className="w-20 h-1 bg-gray-300"></div>
           </div>

          <div className="absolute right-0 top-64 -translate-y-1/2">
            <div className="absolute right-0 top-96 w-20 h-1 bg-gray-300"></div>
           </div>
           
           <div className="absolute left-0 bottom-80 -translate-y-1/2">
            <div className="w-20 h-1 bg-gray-300"></div>
           </div>

          
          <div className="absolute bottom-0 w-[20px] h-[20px] bg-gray-300 rounded-full -translate-x-2"></div>
        </div>

        {/* Feature 1 - Work out at home */}
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 mb-24">
          {/* Mobile Order: H3 first */}
          <div className="flex-1 space-y-6 lg:pr-8 order-1 lg:order-1">
            <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Work out at home for free.
            </h3>
            {/* Mobile Order: Image second, hidden on mobile in this position */}
            <div className="lg:hidden pl-5">
              <img src={uniqueFeaturesImage} alt="" />
            </div>
            {/* Mobile Order: Paragraph third */}
            <p className="text-lg text-gray-600 leading-relaxed max-w-md">
              We believe fitness should be accessible to everyone, everywhere, regardless of income 
              or access to a gym. With hundreds of professional workouts, healthy recipes and 
              informative articles, as well as one of the most positive communities on the web, you'll 
              have everything you need to reach your personal fitness goals – for free!
            </p>
            {/* Mobile Order: Button fourth */}
           <button className="text-primary hover:text-primary-600 font-semibold text-base flex items-center gap-2 transition-colors ml-auto sm:ml-0">
            See More <ArrowRight className="h-4 w-4"/>
           </button>
          </div>

          {/* Desktop Image - hidden on mobile */}
          <div className="flex-1 relative hidden lg:block order-2">
            <img src={uniqueFeaturesImage} alt=""/>
          </div>
        </div>

        {/* Feature 2 - Get more with low-cost */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12 mb-24">
          {/* Mobile Order: H3 first */}
          <div className="flex-1 space-y-6 lg:pl-8 order-1 lg:order-1">
            <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Get more with low-cost challenge and advanced features.
            </h3>
            {/* Mobile Order: Image second, hidden on desktop in this position */}
            <div className="lg:hidden -translate-x-5">
              <img src={uniqueFeaturesImage2} alt="" />
            </div>
            {/* Mobile Order: Paragraph third */}
            <p className="text-lg text-gray-600 leading-relaxed max-w-md">
              We believe fitness should be accessible to everyone, everywhere, regardless of income 
              or access to a gym. With hundreds of professional workouts, healthy recipes and informative articles, 
              as well as one of the most positive communities on the web, you'll have everything you need to 
              reach your personal fitness goals – for free!
            </p>
            {/* Mobile Order: Button fourth */}
           <button className="text-primary hover:text-primary-600 font-semibold text-base flex items-center gap-2 transition-colors ml-auto sm:ml-0">
              See More <ArrowRight className="h-4 w-4"/>
           </button>
          </div>

          {/* Desktop Image - hidden on mobile */}
          <div className="flex-1 relative hidden lg:block order-2">
            <img src={uniqueFeaturesImage2} alt="" />
          </div>
        </div>

        {/* Feature 3 - Training that matches */}
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Mobile Order: H3 first */}
          <div className="flex-1 space-y-6 lg:pr-8 order-1 lg:order-1">
            <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Training that matches your pace.
            </h3>
            {/* Mobile Order: Image second, hidden on desktop in this position */}
            <div className="lg:hidden pl-5">
              <img src={uniqueFeaturesImage3} alt="" />
            </div>
            {/* Mobile Order: Paragraph third */}
            <p className="text-lg text-gray-600 leading-relaxed max-w-md">
              With flexible Training Plans, Guided Workouts and advanced Insights, we'll help you reach 
              your goals on your schedule. You let us know where you're at and we'll provide the 
              coaching to take you the rest of the way.
            </p>
            {/* Mobile Order: Button fourth */}
           <button className="text-primary hover:text-primary-600 font-semibold text-base flex items-center gap-2 transition-colors ml-auto sm:ml-0">
              See More <ArrowRight className="h-4 w-4"/>
           </button>
          </div>

          {/* Desktop Image - hidden on mobile */}
          <div className="flex-1 relative hidden lg:block order-2">
            <img src={uniqueFeaturesImage3} alt="" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default UniqueFeatures;