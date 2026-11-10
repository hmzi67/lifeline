import React, { useState, useEffect } from 'react';
import { FileText, Plus, Loader2, AlertCircle, Edit, Trash2, Eye, Calendar, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import BlogEditor from './BlogEditor';

interface Blog {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    coverImage: string | null;
    status: string;
    authorId: string | null;
    categoryId: string | null;
    createdAt: string;
    updatedAt: string;
    author?: {
        id: string;
        email: string;
        username: string | null;
    };
    category?: {
        id: string;
        name: string;
        slug: string;
    };
}

interface ApiResponse {
    success: boolean;
    data: Blog[];
    message: string;
}

const BlogComponent: React.FC = () => {
    const [showEditor, setShowEditor] = useState(false);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (!showEditor) {
            fetchBlogs();
        }
    }, [showEditor]);

    const fetchBlogs = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get<ApiResponse>('/blogs');
            if (response.data.success && response.data.data) {
                setBlogs(response.data.data);
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                "Failed to fetch blogs. Please try again later."
            );
            console.error('Error fetching blogs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNew = () => {
        setShowEditor(true);
    };

    const handleEdit = (blog: Blog) => {
        // Note: BlogEditor doesn't currently support editing existing blogs
        // For now, just open the editor. Future enhancement: pass blog data to editor
        console.log('Edit blog:', blog);
        setShowEditor(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this blog?')) {
            return;
        }

        try {
            await api.delete(`/blogs/${id}`);
            fetchBlogs();
        } catch (err: any) {
            console.error('Error deleting blog:', err);
            alert('Failed to delete blog. Please try again.');
        }
    };

    const handleBackToList = () => {
        setShowEditor(false);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // If editor is open, show full-page editor with back button
    if (showEditor) {
        return (
            <div className="space-y-4">
                <Button
                    variant="outline"
                    onClick={handleBackToList}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Blogs
                </Button>
                <BlogEditor />
            </div>
        );
    }

    const publishedBlogs = blogs.filter(blog => blog.status.toUpperCase() === 'PUBLISHED');
    const draftBlogs = blogs.filter(blog => blog.status.toUpperCase() === 'DRAFT');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-gray-600">Loading blogs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-xl">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Blog Management</h2>
                            <p className="text-gray-500">Manage all blog posts</p>
                        </div>
                    </div>

                    <Button
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={handleAddNew}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add New Blog
                    </Button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-sm font-medium text-red-600">{error}</p>
                        </div>
                    </div>
                )}

                {/* Blog Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Total Blogs</h3>
                        <p className="text-3xl font-bold text-gray-900">{blogs.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Published</h3>
                        <p className="text-3xl font-bold text-gray-900">{publishedBlogs.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Drafts</h3>
                        <p className="text-3xl font-bold text-gray-900">{draftBlogs.length}</p>
                    </div>
                </div>

                {/* Blogs Table */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">All Blogs</h3>
                    {blogs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full bg-white rounded-lg overflow-hidden">
                                <thead className="bg-gradient-to-r from-blue-100 to-cyan-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Title
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Category
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Author
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {blogs.map((blog) => (
                                        <tr key={blog.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    {blog.coverImage ? (
                                                        <img
                                                            src={blog.coverImage}
                                                            alt={blog.title}
                                                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                            <FileText className="w-6 h-6 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-gray-900 truncate">
                                                            {blog.title}
                                                        </div>
                                                        {blog.excerpt && (
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                                {blog.excerpt}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${blog.status.toUpperCase() === 'PUBLISHED'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    {blog.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {blog.category ? (
                                                    <span className="text-sm text-gray-900">{blog.category.name}</span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {blog.author ? (
                                                    <div className="flex items-center gap-1">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm text-gray-900">
                                                            {blog.author.username || blog.author.email}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-900">
                                                        {formatDate(blog.createdAt)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => handleEdit(blog)}
                                                        aria-label="Edit"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDelete(blog.id)}
                                                        aria-label="Delete"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg p-12 text-center">
                            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No blogs available</p>
                            <p className="text-gray-400 text-sm mt-2">Create your first blog to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlogComponent;
