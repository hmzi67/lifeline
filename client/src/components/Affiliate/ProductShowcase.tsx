import ps1img from "@/assets/images/affiliatehero/P-S-1.webp";
import ps2img from "@/assets/images/affiliatehero/P-S-2.webp";
import ps3img from "@/assets/images/affiliatehero/P-S-3.webp";

const ProductShowcase = () => {
  return (
    <div className=" py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Let's <span className="text-primary">Meet</span> the Product
          </h1>
          <p className="text-gray-600 text-lg">
            LifeLine where every heartbeat counts!
          </p>
        </div>

        {/* Phone Mockups */}
        <div className="grid md:grid-cols-3 ">
          {/* Phone 1 - Heart Rate Monitor */}
          <div className="flex flex-col items-center ">
          <div className="h-96 px-14 bg-primary-50 gap-y-6 rounded-2xl ">
             <img className="h-80 mt-16" src={ps1img} alt=""/> 
          </div>
            <div className="mt-4 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2 ">Better Sleep</h3>
              <p className="text-gray-600 text-x mx-12">
                Unlock our library of meditations, sleep sounds, and more.
              </p>
            </div>
          </div>

          {/* Phone 2 - Sleep Tracking */}
          <div className="flex flex-col items-center ">
          <div className="h-96 px-14 bg-primary-50 gap-y-6 rounded-2xl  ">
             <img className="h-80 mt-16" src={ps2img} alt=""/> 
          </div>
            <div className="mt-4 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2 ">Better Sleep</h3>
              <p className="text-gray-600 text-x mx-12">
                Unlock our library of meditations, sleep sounds, and more.
              </p>
            </div>
          </div>

          {/* Phone 3 - Progress Tracking */}
          <div className="flex flex-col items-center ">
          <div className="h-96 px-14 bg-teal-50 gap-y-6 rounded-2xl ">
             <img className="h-80 mt-16" src={ps3img} alt=""/> 
          </div>
            <div className="mt-4 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2 ">Better Sleep</h3>
              <p className="text-gray-600 text-x mx-12">
                Unlock our library of meditations, sleep sounds, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductShowcase;