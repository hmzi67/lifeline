

export const RecentPosts = () => {
    const recentPosts = [
        {
            title: "The 15 Secrets That You Should Know About Running Club",
            imageUrl: "/sample.webp"
        },
        {
            title: "The 15 Secrets That You Should Know About Running Club",
            imageUrl: "/sample.webp"
        },
        {
            title: "The 15 Secrets That You Should Know About Running Club",
            imageUrl: "/sample.webp"
        },
        {
            title: "The 15 Secrets That You Should Know About Running Club",
            imageUrl: "/sample.webp"
        },
        {
            title: "The 15 Secrets That You Should Know About Running Club",
            imageUrl: "/sample.webp"
        }
    ];

    return (
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h3 className="font-bold text-gray-900 text-lg mb-4">Recent Posts</h3>
            <div className="space-y-4">
                {recentPosts.map((post, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="w-16 h-12 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-800 leading-tight hover:text-primary-500 cursor-pointer transition-colors">
                                {post.title}
                            </h4>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
