import {User} from "lucide-react";
import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import api from "@/lib/axios";
import {useAuth} from "@/contexts/AuthContext";

interface BlogComment {
    id: string;
    content: string;
    createdAt: string;
    user: { username: string | null; displayName: string | null; profileImage: string | null } | null;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});

export const CommentSection = ({blogId}: { blogId: string }) => {
    const {isAuthenticated} = useAuth();
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState<BlogComment[]>([]);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get(`/blogs/${blogId}/comments`)
            .then((res) => setComments(res.data.data ?? []))
            .catch(() => setComments([]));
    }, [blogId]);

    const postComment = async () => {
        const content = comment.trim();
        if (!content) return;
        setPosting(true);
        setError(null);
        try {
            const res = await api.post(`/blogs/${blogId}/comments`, {content});
            setComments((prev) => [res.data.data, ...prev]);
            setComment('');
        } catch {
            setError('Could not post your comment. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Leave a Comment</h3>
            {isAuthenticated ? (
                <div>
                    <div className="mb-4">
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                            Message *
                        </label>
                        <textarea
                            id="message"
                            rows={6}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Write a message..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        ></textarea>
                    </div>
                    {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                    <button
                        onClick={postComment}
                        disabled={posting || !comment.trim()}
                        className="bg-primary-500 text-white px-6 py-2 rounded-md hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {posting ? 'Posting...' : 'Post Comment'}
                    </button>
                </div>
            ) : (
                <p className="text-gray-600">
                    <Link to="/login" className="text-primary-500 font-medium hover:underline">Log in</Link> to leave a comment.
                </p>
            )}

            {comments.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200 space-y-6">
                    {comments.map((c) => (
                        <div key={c.id} className="flex items-start space-x-4">
                            {c.user?.profileImage ? (
                                <img src={c.user.profileImage} alt="" className="w-12 h-12 rounded-full object-cover"/>
                            ) : (
                                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center shrink-0">
                                    <User className="w-6 h-6 text-gray-600"/>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="font-semibold text-gray-900">
                                        {c.user?.displayName || c.user?.username || 'Lifeline user'}
                                    </h4>
                                    <span className="text-sm text-gray-500">•</span>
                                    <span className="text-sm text-gray-500">{formatDate(c.createdAt)}</span>
                                </div>
                                <p className="text-gray-600 text-sm whitespace-pre-line break-words">{c.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
