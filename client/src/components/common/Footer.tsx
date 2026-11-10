import { Link } from 'react-router-dom';
import {
  FacebookIcon,
  LinkedinIcon,
  InstagramIcon
} from 'lucide-react';

export default function Footer() {
  const footerLinks = [
    { name: 'About Us', href: '/about' },
    { name: 'Careers', href: '/careers' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'Blogs', href: '/blogs' }
  ];

  const socialLinks = [
    { name: 'LinkedIn', icon: LinkedinIcon, href: 'https://www.linkedin.com/company/lifelineappofficial/' },
    { name: 'Facebook', icon: FacebookIcon, href: 'https://web.facebook.com/lifelineappofficial/' },
    { name: 'Instagram', icon: InstagramIcon, href: 'https://www.instagram.com/lifelineappofficial/' }
  ];

  return (
    <footer className="bg-primary text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Navigation and Social Links Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 lg:gap-4 mb-8 lg:mb-12">
          {/* Navigation Links */}
          <div className="w-full lg:w-auto">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 sm:gap-x-8 lg:gap-x-16 gap-y-4 sm:gap-y-6">
              {footerLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-white text-base sm:text-lg lg:text-xl font-medium hover:text-white/80 transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Social Links */}
          <div className="flex justify-center sm:justify-start lg:justify-end w-full lg:w-auto">
            <div className="flex space-x-3 sm:space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center text-primary-400 hover:bg-gray-100 transition-colors duration-200 hover:scale-105 transform"
                    aria-label={social.name}
                  >
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Company Description Section */}
        <div className="flex items-start">
          <div className="w-full lg:max-w-3xl xl:max-w-4xl">
            <p className="text-white text-sm sm:text-base lg:text-lg leading-relaxed text-center sm:text-left">
              Transform your fitness journey with LifeLine. Smart tracking for a healthier you.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="border-t border-teal-300/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
            {/* Logo */}
            <div className="flex items-center order-2 md:order-1">
              <div className="relative">
                <img
                  src="/logo-dark.webp"
                  alt="Lifeline"
                  width={157}
                  height={101}
                  loading="lazy"
                  className="w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 object-contain"
                />
              </div>
            </div>

            {/* Copyright */}
            <div className="text-center order-1 md:order-2">
              <p className="text-white text-sm sm:text-base">
                © {new Date().getFullYear()} All rights reserved.
              </p>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 order-3">
              <Link
                to="/terms"
                className="text-white hover:text-white/80 transition-colors duration-200 text-sm sm:text-base"
              >
                Terms
              </Link>
              <Link
                to="/privacy"
                className="text-white hover:text-white/80 transition-colors duration-200 text-sm sm:text-base"
              >
                Privacy
              </Link>
              <Link
                to="/delete-account"
                className="text-white hover:text-white/80 transition-colors duration-200 text-sm sm:text-base"
              >
                Delete Account
              </Link>
              <Link
                to="/cookies"
                className="text-white hover:text-white/80 transition-colors duration-200 text-sm sm:text-base"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}