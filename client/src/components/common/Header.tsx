import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {X, User, LogOut} from 'lucide-react';
import menu from "../../assets/images/comming-soon/menu.png";
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  // Routes that should have a transparent header
  const transparentRoutes = [
    '/',
    '/business',
    '/affiliate',
    '/pricing',
  ];

  // Check if current route should have transparent header
  const shouldBeTransparent = transparentRoutes.includes(location.pathname);

  // Handle scroll event
  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 30);
    };
    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Business', href: '/business' },
    { name: 'Fitness Band', href: '/analytics' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Blogs', href: '/blog' },
    { name: 'Affiliate Program', href: '/affiliate' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  // Dynamic classes based on page and scroll
  const getHeaderClasses = () => {
    if (shouldBeTransparent) {
      return `transition delay-150 duration-200 ease-in-out fixed w-full top-0 z-50 ${isVisible ? "bg-white shadow-sm" : "bg-transparent"}`;
    } else {
      return "fixed w-full top-0 z-50 bg-white shadow-sm";
    }
  };

  const getNavLinkClasses = (href: string) => {
    const baseClasses = "hover:text-teal-500 transition-colors duration-200 font-medium text-sm";
    const activeClasses = isActive(href) ? 'text-teal-500 font-semibold' : '';
    if (shouldBeTransparent && !isVisible) {
      return `${baseClasses} text-gray-200 hover:text-white ${activeClasses}`;
    }
    return `${baseClasses} text-gray-600 ${activeClasses}`;
  };

  const getMobileButtonClasses = () => {
    if (shouldBeTransparent && !isVisible) {
      return "lg:hidden text-gray-200 p-2";
    }
    return "lg:hidden text-gray-600 p-2";
  };

  return (
      <header className={getHeaderClasses()}>
        <nav className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <img src="/logo.webp" alt="Lifeline Logo" width={110} height={70} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6 xl:space-x-8 ms-auto me-8">
              {navigation.map((item) => (
                  <Link
                      key={item.name}
                      to={item.href}
                      className={getNavLinkClasses(item.href)}
                  >
                    {item.name}
                  </Link>
              ))}
            </div>

            {/* CTA Button / User Menu for Desktop */}
            <div className="hidden lg:flex items-center">
              {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                          variant="ghost"
                          className="flex items-center space-x-2 text-gray-700 hover:text-primary-500 focus:outline-none h-auto p-2"
                      >
                        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        {/*<span className="font-medium">{user?.firstName}</span>*/}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link
                            to="/profile"
                            className="flex items-center cursor-pointer w-full"
                        >
                          <User className="w-4 h-4 mr-2" />
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                            to="/questions?restart=true"
                            className="flex items-center cursor-pointer w-full"
                        >
                          <User className="w-4 h-4 mr-2" />
                          Update Information
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                          onClick={logout}
                          className="flex items-center cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              ) : (
                  <Link to="/signup">
                    <Button
                        className="bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold px-4 py-2 sm:px-6 sm:py-2.5 rounded-full transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg text-sm sm:text-base"
                    >
                      Try for Free
                    </Button>
                  </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
                className={getMobileButtonClasses()}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <img src={menu} alt="menu icon"
                   className='w-9 h-9' />
            </button>
          </div>

          {/* Mobile Menu Overlay */}
          <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`} onClick={() => setIsMenuOpen(false)} />

          {/* Mobile Menu */}
          <div className={`lg:hidden fixed inset-y-0 left-0 w-full bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <Link to="/" className="flex items-center space-x-3" onClick={() => setIsMenuOpen(false)}>
                  <img src="/logo.webp" alt="Lifeline Logo" width={110} height={70} className="w-12 h-12 object-contain" />
                </Link>
                <button
                    className="text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col flex-grow overflow-y-auto">
                <div className="px-4 py-2">
                  {navigation.map((item, index) => (
                      <Link
                          key={item.name}
                          to={item.href}
                          className={`block text-gray-700 hover:text-teal-500 hover:bg-teal-50 font-medium py-4 px-4 rounded-lg my-1 transform transition-transform ${isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                          }`}
                          style={{ transitionDelay: `${index * 50}ms` }}
                          onClick={() => setIsMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                  ))}
                </div>
              </div>

              {/* CTA Button / User Actions */}
              <div className={`p-4 border-t border-gray-100 transform transition-all duration-300 ${isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
              }`} style={{ transitionDelay: `${navigation.length * 50}ms` }}>
                {isAuthenticated ? (
                    <div className="space-y-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                              variant="ghost"
                              className="w-full flex items-center justify-start space-x-3 px-4 py-3 h-auto hover:bg-gray-50"
                          >
                            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-medium text-gray-700">{user?.firstName}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 ml-4">
                          <DropdownMenuItem asChild>
                            <Link
                                to="/profile"
                                className="flex items-center cursor-pointer w-full px-2 py-2"
                                onClick={() => setIsMenuOpen(false)}
                            >
                              <User className="w-4 h-4 mr-2" />
                              Profile
                            </Link>
                          </DropdownMenuItem>
                          {/* Same items as the desktop menu. */}
                          <DropdownMenuItem asChild>
                            <Link
                                to="/questions?restart=true"
                                className="flex items-center cursor-pointer w-full px-2 py-2"
                                onClick={() => setIsMenuOpen(false)}
                            >
                              <User className="w-4 h-4 mr-2" />
                              Update Information
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                              onClick={() => {
                                logout();
                                setIsMenuOpen(false);
                              }}
                              className="flex items-center cursor-pointer text-red-600 focus:text-red-600 px-2 py-2"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                ) : (
                    <Link to="/signup" className="w-full block" onClick={() => setIsMenuOpen(false)}>
                      <Button
                          className="w-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold rounded-full py-3 text-base transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                      >
                        Try for Free
                      </Button>
                    </Link>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>
  );
}