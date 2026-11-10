import { Calendar, User } from 'lucide-react';
import { BlogCard } from "@/components/content/BlogCard";
import { SocialLinks } from "@/components/content/SocialLinks.tsx";
import { CommentSection } from "@/components/content/CommentSection.tsx";
import { AppDownload } from "@/components/content/AppDownload.tsx";
import { TestimonialsSection } from "@/components/landing";
import { useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from "react";
import api from '@/lib/axios';
import { marked } from "marked";
import DOMPurify from "dompurify";

interface Blog {
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

export const BlogReading = () => {
  const [blogData, setBlogData] = useState<Blog>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    const fetchBlogDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/blogs/slug/${id}`);
        setBlogData(response.data.data);
      } catch (err) {
        console.error("Failed to fetch blog:", err);
        setError("Could not load the blog. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchBlogDetails();
    }
  }, [id]);

  const sanitizedContent = useMemo(() => {
    if (!blogData?.content) return "";
    const rawHtml = marked.parse(blogData.content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [blogData?.content]);

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!blogData) return <div className="text-center py-12">Blog not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-gray-800 to-gray-600 text-white">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div
          className="relative bg-cover bg-center h-96"
          style={{
            backgroundImage: `url(${blogData?.coverImage || 'https://via.placeholder.com/800x400?text=No+Cover+Image'})`
          }}
        >
          <div className="absolute inset-0 bg-black opacity-60"></div>
          <div className="relative container mx-auto px-4 h-full flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {blogData?.title}
              </h1>
              <div className="flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{blogData?.author?.username || "Unknown Author"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(blogData?.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Article */}
          <div className="lg:col-span-2">
            <article className="bg-white rounded-lg shadow-sm p-8 mb-8">
              {/* Render sanitized Markdown content here */}
              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </article>

            {/* Comment Section */}
            <CommentSection blogId={blogData.id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Related Blogs */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 text-lg mb-4">RELATED BLOGS</h3>
              <div className="space-y-6">
                <BlogCard
                  title="The 15 Secrets That You Should Know About Running Club"
                  excerpt="How to avoid the most common beginner running mistakes..."
                  imageUrl="https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                  readMoreLink="#"
                  size="small"
                />
                <BlogCard
                  title="The 15 Secrets That You Should Know About Running Club"
                  excerpt="Tips for getting out there and improving technique..."
                  imageUrl="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                  readMoreLink="#"
                  size="small"
                />
                <BlogCard
                  title="The 15 Secrets That You Should Know About Running Club"
                  excerpt="Learn about the best gear to get you started running..."
                  imageUrl="https://images.unsplash.com/photo-1486739985386-d4fae04ca6f7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
                  readMoreLink="#"
                  size="small"
                />
              </div>
            </div>

            {/* Social Links */}
            <SocialLinks />
          </div>
        </div>
      </div>

      <AppDownload />
      <TestimonialsSection />

      <style>{`
        /* Ensure typography if Tailwind plugin isn't present */
        .prose h1 { font-size: 1.875rem; line-height: 2.25rem; margin-top: 1rem; margin-bottom: .75rem; font-weight: 800; }
        .prose h2 { font-size: 1.5rem; line-height: 2rem; margin-top: 1rem; margin-bottom: .5rem; font-weight: 700; }
        .prose p { margin: .75rem 0; }
        .prose img { border-radius: .75rem; }
        .dark .prose :where(a){ color: #a3e635; }
      `}</style>
    </div>
  );
};

export default BlogReading;