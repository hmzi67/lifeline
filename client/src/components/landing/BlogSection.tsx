import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { ArrowRightIcon, Circle, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';

export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED" | string;
  authorId: string | null;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  author: Author | null;
  category: Category;
  _count: {
    comments: number;
  };
}

interface Author {
  id: string;
  email: string;
  username: string;
  googleId?: string | null;
  profileImage?: string | null;
  isEmailVerified: boolean;
  subject?: string | null;
  password: string;
  otp?: string | null;
  status: string;
  roleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export const BlogSection: React.FC = () => {
  const [blogsData, setBlogsData] = useState<Blog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBlogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get("/blogs?limit=3&status=PUBLISHED")
        setBlogsData(response.data.data);
      } catch (err: any) {
        // Properly extract the actual error message
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Unknown error";
        console.error("Failed to fetch blogs:", {
          status: err.response?.status,
          statusText: err.response?.statusText,
          error: errorMessage,
          data: err.response?.data
        });
        setError("Could not load recent articles. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchBlogs();
  }, []);

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
            Recent <span className="text-primary">Blogs</span> and Articles
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-4">
            Explore our blogs and articles for expert workout tips, fitness advice, and effective exercise routines.
            Stay updated with the latest trends to enhance your fitness journey.
          </p>
        </div>

        {loading && (
          <div className="text-center text-gray-500">
            <p>Loading articles...</p>
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && blogsData.length > 0 && (
          <>
            {/* Desktop Layout - 3 Column Grid */}
            <div className="hidden lg:block">
              <div className="grid lg:grid-cols-3 gap-6 xl:gap-8 max-w-7xl mx-auto mb-12">
                {blogsData.map((blog) => (
                  <Link to={`/blog/${blog.slug}`} key={blog.id}>
                    <article className="group cursor-pointer">
                      <div className="bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg">
                        <div className="relative overflow-hidden">
                          <img
                            src={blog.coverImage || "/sample.webp"}
                            alt={blog.title}
                            className="w-full h-48 xl:h-56 object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        <div className="p-6">
                          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                            <div className="flex items-center gap-2">
                              <>
                                <Circle size={8} className='fill-primary-400 text-primary-400' />
                                <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
                              </>
                              |
                              <>
                                <User className='w-3 fill-primary-400 text-primary-400' />
                                <span>{blog.author?.username}</span>
                              </>
                            </div>
                          </div>

                          <h3 className="text-xl xl:text-2xl font-semibold text-gray-900 leading-tight group-hover:text-primary transition-colors duration-200">
                            {blog.title}
                          </h3>
                          <div className="excerpt-container h-16 overflow-hidden mt-2">
                            <p className="text-gray-600 text-ellipsis overflow-hidden whitespace-nowrap">
                              {blog.excerpt}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile/Tablet Layout - Vertical List */}
            <div className="block lg:hidden">
              <div className="space-y-6 mb-12">
                {blogsData.map((blog) => (
                  <Link to={`/blog/${blog.slug}`} key={blog.id}>
                    <article className="group cursor-pointer">
                      <div className="flex gap-4 sm:gap-6 space-y-6">
                        <div className="flex-shrink-0">
                          <div className="relative overflow-hidden rounded-xl mt-6">
                            <img
                              src={blog.coverImage || "/sample.webp"}
                              alt={blog.title}
                              className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="mb-2 flex items-center gap-1">
                            <span className="text-sm text-gray-500">{new Date(blog.createdAt).toLocaleDateString()}</span>
                            <span className="text-sm text-gray-500">|</span>
                            <span className="text-sm text-gray-500">{blog.author?.username}</span>
                          </div>

                          <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight group-hover:text-primary transition-colors duration-200">
                            {blog.title}
                          </h3>
                          <div className="excerpt-container h-12 overflow-hidden mt-1">
                            <p className="text-gray-600 text-ellipsis overflow-hidden whitespace-nowrap">
                              {blog.excerpt}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Read More Button */}
        <div className="flex justify-end lg:justify-end">
          <Link to="/blog">
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-primary text-primary hover:bg-teal-400 hover:text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-full transition-all duration-300 flex items-center gap-2"
            >
              Read More
              <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
        </div>
      </div>

      <style>{`
                .excerpt-container:hover p {
                    animation: marquee 10s linear infinite;
                    display: inline-block;
                    padding-right: 20px;
                }

                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }

                .excerpt-container:hover p::after {
                    content: attr(data-text);
                    padding-left: 20px;
                }
            `}</style>
    </section>
  );
};