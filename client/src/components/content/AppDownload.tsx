// Responsive AppDownload Component
import AppBgImage2 from '../../assets/images/landing/appbgimg12.png';
import AppDownloadBg from '@/assets/images/landing/AppDownloadBg.jpeg'
import mobileimg from '../../assets/images/landing/appDownloadImg.webp';
import AppDownloadBgMobile from '@/assets/images/landing/AppDonwloadBgMobile.webp';

export const AppDownload = ({ isLandingPage = false }) => {
    return (
        <>
            {/* Mobile Layout - Separate section with primary background */}
            <div className="block md:hidden bg-primary py-8 px-4">
                <div className="max-w-sm mx-auto space-y-6">
                    {/* Mobile Image on Top */}
                    <div className="flex justify-center">
                        <img
                            src={isLandingPage ? mobileimg : AppDownloadBgMobile}
                            alt="Mobile App Preview"
                            className="w-full max-w-[280px] h-auto drop-shadow-lg"
                        />
                    </div>

                    {/* Mobile Content */}
                    <div className="text-white text-center space-y-4">
                        <h1 className="text-xl font-bold leading-tight">
                            {isLandingPage ? (
                                <>
                                    <span className="block mb-1">Ready, Set, Run! The</span>
                                    <span className="block mb-1">Challenge is Live – Don't</span>
                                    <span className="block">Miss Out!</span>
                                </>
                            ) : (
                                <>
                                    <span className="block mb-1">Download the most</span>
                                    <span className="block">loved fitness app</span>
                                </>
                            )}
                        </h1>

                        <p className="text-sm opacity-90 leading-relaxed px-4">
                            Start your fitness journey with us. Join the cult!
                        </p>
                    </div>

                    {/* Mobile App Store Buttons */}
                    <div className="flex flex-col gap-4 px-4">
                        {/* Google Play Button */}
                        <a
                            href="#"
                            className="bg-black backdrop-blur-sm hover:bg-black/80 rounded-xl py-3 flex items-center space-x-3 justify-center cursor-pointer transition-all duration-300 shadow-lg border border-white/10 w-full h-[60px]"
                        >
                            <svg
                                className="w-5 h-5 flex-shrink-0"
                                version="1.1"
                                id="Layer_1"
                                xmlns="http://www.w3.org/2000/svg"
                                xmlnsXlink="http://www.w3.org/1999/xlink"
                                viewBox="0 0 511.999 511.999"
                                xmlSpace="preserve"
                            >
                                {/* SVG paths remain same */}
                                <g>
                                    <path
                                        style={{ fill: "#32BBFF" }}
                                        d="M382.369,175.623C322.891,142.356,227.427,88.937,79.355,6.028
                                          C69.372-0.565,57.886-1.429,47.962,1.93l254.05,254.05L382.369,175.623z"
                                    />
                                    <path
                                        style={{ fill: "#32BBFF" }}
                                        d="M47.962,1.93c-1.86,0.63-3.67,1.39-5.401,2.308C31.602,10.166,23.549,21.573,23.549,36v439.96
                                           c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98L47.962,1.93z"
                                    />
                                    <path
                                        style={{ fill: "#32BBFF" }}
                                        d="M302.012,255.98L47.956,510.035c9.927,3.384,21.413,2.586,31.399-4.103
                                        c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L302.012,255.98z"
                                    />
                                </g>
                                <path
                                    style={{ fill: "#2C9FD9" }}
                                    d="M23.549,255.98v219.98c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314
                                      L302.012,255.98H23.549z"
                                />
                                <path
                                    style={{ fill: "#29CC5E" }}
                                    d="M79.355,6.028C67.5-1.8,53.52-1.577,42.561,4.239l255.595,255.596l84.212-84.212
                                     C322.891,142.356,227.427,88.937,79.355,6.028z"
                                />
                                <path
                                    style={{ fill: "#D93F21" }}
                                    d="M298.158,252.126L42.561,507.721c10.96,5.815,24.939,6.151,36.794-1.789
                                      c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L298.158,252.126z"
                                />
                                <path
                                    style={{ fill: "#FFD500" }}
                                    d="M488.45,255.98c0-12.19-6.151-24.492-18.342-31.314c0,0-22.799-12.721-92.682-51.809l-83.123,83.123
                                       l83.204,83.205c69.116-38.807,92.6-51.892,92.6-51.892C482.299,280.472,488.45,268.17,488.45,255.98z"
                                />
                                <path
                                    style={{ fill: "#FFAA00" }}
                                    d="M470.108,287.294c12.191-6.822,18.342-19.124,18.342-31.314H294.303l83.204,83.205
                                       C446.624,300.379,470.108,287.294,470.108,287.294z"
                                />
                            </svg>
                            <div className="text-white">
                                <div className="text-xs opacity-80">GET IT ON</div>
                                <div className="text-base font-semibold">Google Play</div>
                            </div>
                        </a>

                        {/* App Store Button */}
                        <a
                            href="#"
                            className="bg-black backdrop-blur-sm hover:bg-black/80 rounded-xl py-3 flex items-center justify-center space-x-3 cursor-pointer transition-all duration-300 shadow-lg border border-white/10 w-full h-[60px]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="white">
                                <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.19 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                            </svg>
                            <div className="text-white">
                                <div className="text-xs opacity-80">Download on the</div>
                                <div className="text-base font-semibold">App Store</div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>

            {/* Desktop/Tablet Layout - Hidden on mobile */}
            <div className="hidden md:block my-8 md:my-16 lg:my-24 py-8 md:py-12 lg:py-16 relative overflow-hidden min-h-[500px] md:min-h-[600px] lg:min-h-[700px]">
                {/* Background Image - Only for desktop/tablet */}
                <img
                    src={isLandingPage ? AppBgImage2 : AppDownloadBg}
                    alt="Background"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 w-full relative z-10 flex items-center h-full">
                    <div className="grid lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 xl:gap-16 items-center w-full">

                        {/* Left Section - Text Content */}
                        <div className="text-white space-y-4 md:space-y-6 lg:space-y-8 order-2 lg:order-1 p-12 mt-16">
                            <div className="space-y-3 md:space-y-4 lg:space-y-6">
                                <h1 className="font-bold leading-tight text-center lg:text-left">
                                    {isLandingPage ? (
                                        <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
                                            <span className="block mb-1 md:mb-2">Ready, Set, Run! The</span>
                                            <span className="block mb-1 md:mb-2">Challenge is Live – Don't</span>
                                            <span className="block">Miss Out!</span>
                                        </span>
                                    ) : (
                                        <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
                                            <span className="block mb-1 md:mb-2">Download the most</span>
                                            <span className="block">loved fitness app</span>
                                        </span>
                                    )}
                                </h1>

                                <p className="text-sm sm:text-base md:text-lg lg:text-xl opacity-90 max-w-lg mx-auto lg:mx-0 text-center lg:text-left leading-relaxed">
                                    Start your fitness journey with us. Join the cult!
                                </p>
                            </div>

                            {/* App Store Buttons */}
                            <div className="flex flex-col sm:flex-row lg:justify-start justify-center gap-3 md:gap-4 max-w-md mx-auto lg:mx-0">

                                {/* Google Play Button */}
                                <a
                                    href="#"
                                    className="bg-black backdrop-blur-sm hover:bg-black/80 flex-1 rounded-xl px-3 sm:px-4 md:px-6 py-2.5 md:py-3 flex items-center space-x-2 md:space-x-3 justify-center cursor-pointer transition-all duration-300 shadow-lg border border-white/10 hover:border-white/20 group"
                                >
                                    <svg
                                        className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0"
                                        version="1.1"
                                        id="Layer_1"
                                        xmlns="http://www.w3.org/2000/svg"
                                        xmlnsXlink="http://www.w3.org/1999/xlink"
                                        viewBox="0 0 511.999 511.999"
                                        xmlSpace="preserve"
                                    >
                                        <g>
                                            <path
                                                style={{ fill: "#32BBFF" }}
                                                d="M382.369,175.623C322.891,142.356,227.427,88.937,79.355,6.028
            C69.372-0.565,57.886-1.429,47.962,1.93l254.05,254.05L382.369,175.623z"
                                            />
                                            <path
                                                style={{ fill: "#32BBFF" }}
                                                d="M47.962,1.93c-1.86,0.63-3.67,1.39-5.401,2.308C31.602,10.166,23.549,21.573,23.549,36v439.96
            c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98L47.962,1.93z"
                                            />
                                            <path
                                                style={{ fill: "#32BBFF" }}
                                                d="M302.012,255.98L47.956,510.035c9.927,3.384,21.413,2.586,31.399-4.103
            c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L302.012,255.98z"
                                            />
                                        </g>
                                        <path
                                            style={{ fill: "#2C9FD9" }}
                                            d="M23.549,255.98v219.98c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314
          L302.012,255.98H23.549z"
                                        />
                                        <path
                                            style={{ fill: "#29CC5E" }}
                                            d="M79.355,6.028C67.5-1.8,53.52-1.577,42.561,4.239l255.595,255.596l84.212-84.212
          C322.891,142.356,227.427,88.937,79.355,6.028z"
                                        />
                                        <path
                                            style={{ fill: "#D93F21" }}
                                            d="M298.158,252.126L42.561,507.721c10.96,5.815,24.939,6.151,36.794-1.789
          c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L298.158,252.126z"
                                        />
                                        <path
                                            style={{ fill: "#FFD500" }}
                                            d="M488.45,255.98c0-12.19-6.151-24.492-18.342-31.314c0,0-22.799-12.721-92.682-51.809l-83.123,83.123
          l83.204,83.205c69.116-38.807,92.6-51.892,92.6-51.892C482.299,280.472,488.45,268.17,488.45,255.98z"
                                        />
                                        <path
                                            style={{ fill: "#FFAA00" }}
                                            d="M470.108,287.294c12.191-6.822,18.342-19.124,18.342-31.314H294.303l83.204,83.205
          C446.624,300.379,470.108,287.294,470.108,287.294z"
                                        />
                                    </svg>
                                    <div className="text-white min-w-0">
                                        <div className="text-xs opacity-80">GET IT ON</div>
                                        <div className="text-sm sm:text-base md:text-lg font-semibold">Google Play</div>
                                    </div>
                                </a>

                                {/* App Store Button */}
                                <a
                                    href="#"
                                    className="bg-black backdrop-blur-sm hover:bg-black/80 flex-1 rounded-xl px-3 sm:px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-center space-x-2 md:space-x-3 cursor-pointer transition-all duration-300 shadow-lg border border-white/10 hover:border-white/20 group"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.19 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                                    </svg>
                                    <div className="text-white min-w-0">
                                        <div className="text-xs opacity-80">Download on the</div>
                                        <div className="text-sm sm:text-base md:text-lg font-semibold">App Store</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};