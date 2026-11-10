import React, { useState, useEffect } from 'react';
import {
    BookOpen, Plus, Loader2, AlertCircle, Edit, Trash2,
    ArrowLeft, Volume2, Tag, User, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import { MediaUploadField } from '@/components/shared/MediaUploadField';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SleepStory {
    id: string;
    title: string;
    author: string | null;
    description: string | null;
    image: string | null;
    audioUrl: string;
    category: string | null;
    duration: number | null;
    isActive: boolean;
}

interface FormData {
    title: string;
    author: string;
    description: string;
    image: string;
    audioUrl: string;
    category: string;
    duration: string;
    isActive: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORY_CATEGORIES = [
    'Nature', 'Fantasy', 'Adventure', 'Mindfulness',
    'Fairy Tale', 'Historical', 'Relaxation', 'Other',
];

const EMPTY_FORM: FormData = {
    title: '',
    author: '',
    description: '',
    image: '',
    audioUrl: '',
    category: '',
    duration: '',
    isActive: true,
};

// ── Editor ────────────────────────────────────────────────────────────────────
interface EditorProps {
    storyId?: string;
    onSave: () => void;
    onCancel: () => void;
}

const SleepStoryEditor: React.FC<EditorProps> = ({ storyId, onSave, onCancel }) => {
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isEditing = Boolean(storyId);

    useEffect(() => {
        if (storyId) fetchStory();
    }, [storyId]);

    const fetchStory = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/sleep-stories/${storyId}`);
            if (res.data.success && res.data.data) {
                const s: SleepStory = res.data.data;
                setFormData({
                    title: s.title ?? '',
                    author: s.author ?? '',
                    description: s.description ?? '',
                    image: s.image ?? '',
                    audioUrl: s.audioUrl ?? '',
                    category: s.category ?? '',
                    duration: s.duration != null ? String(s.duration) : '',
                    isActive: s.isActive,
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Failed to load sleep story');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof FormData, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.title.trim()) { setError('Title is required'); return; }
        if (!formData.audioUrl.trim()) { setError('Audio URL is required'); return; }

        try {
            setLoading(true);
            const payload = {
                title: formData.title.trim(),
                author: formData.author.trim() || null,
                description: formData.description.trim() || null,
                image: formData.image.trim() || null,
                audioUrl: formData.audioUrl.trim(),
                category: formData.category || null,
                duration: formData.duration ? Number(formData.duration) : null,
                isActive: formData.isActive,
            };

            if (isEditing && storyId) {
                await api.put(`/sleep-stories/${storyId}`, payload);
            } else {
                await api.post('/sleep-stories', payload);
            }
            onSave();
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Failed to save sleep story');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading story…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">
                    {isEditing ? 'Edit Sleep Story' : 'Create New Sleep Story'}
                </h2>
                <p className="text-gray-500 mt-1">
                    {isEditing ? 'Update story details' : 'Add a new sleep story to the library'}
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={e => handleChange('title', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., Enchanted Forest"
                        required
                    />
                </div>

                {/* Author */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                    <input
                        type="text"
                        value={formData.author}
                        onChange={e => handleChange('author', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., Jane Doe"
                    />
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                        value={formData.category}
                        onChange={e => handleChange('category', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="">Select a category</option>
                        {STORY_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {/* Duration */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                    <input
                        type="number"
                        min="1"
                        value={formData.duration}
                        onChange={e => handleChange('duration', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., 15"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={e => handleChange('description', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder="Short description of the story…"
                    />
                </div>

                <MediaUploadField
                    label="Cover Image"
                    value={formData.image}
                    onChange={(value) => handleChange('image', value)}
                    accept="image/*"
                    mediaKind="image"
                    placeholder="https://example.com/cover.jpg"
                />

                <MediaUploadField
                    label="Audio"
                    value={formData.audioUrl}
                    onChange={(value) => handleChange('audioUrl', value)}
                    accept="audio/*"
                    mediaKind="audio"
                    required
                    placeholder="https://example.com/story.mp3"
                />

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={e => handleChange('isActive', e.target.checked)}
                        className="w-5 h-5 accent-indigo-600 rounded"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                        Active (visible to users)
                    </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-indigo-600 hover:to-purple-600"
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                        ) : (
                            isEditing ? 'Update Story' : 'Create Story'
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
};

// ── List ──────────────────────────────────────────────────────────────────────
const SleepStoriesComponent: React.FC = () => {
    const [showEditor, setShowEditor] = useState(false);
    const [editingId, setEditingId] = useState<string | undefined>(undefined);
    const [stories, setStories] = useState<SleepStory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!showEditor) fetchStories();
    }, [showEditor]);

    const fetchStories = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/sleep-stories');
            if (res.data.success && res.data.data) {
                setStories(res.data.data);
            }
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Failed to fetch sleep stories.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this sleep story?')) return;
        try {
            await api.delete(`/sleep-stories/${id}`);
            fetchStories();
        } catch (err: any) {
            alert(err.response?.data?.message ?? 'Failed to delete sleep story.');
        }
    };

    // ── Editor view ──
    if (showEditor) {
        return (
            <div className="space-y-4">
                <Button variant="outline" onClick={() => { setShowEditor(false); setEditingId(undefined); }} className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Sleep Stories
                </Button>
                <SleepStoryEditor
                    storyId={editingId}
                    onSave={() => { setShowEditor(false); setEditingId(undefined); fetchStories(); }}
                    onCancel={() => { setShowEditor(false); setEditingId(undefined); }}
                />
            </div>
        );
    }

    // ── Stats ──
    const activeCount = stories.filter(s => s.isActive).length;
    const categories = [...new Set(stories.map(s => s.category).filter(Boolean))];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
                    <p className="text-gray-600">Loading sleep stories…</p>
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
                        <div className="p-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl">
                            <BookOpen className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Sleep Stories</h2>
                            <p className="text-gray-500">Manage bedtime audio stories</p>
                        </div>
                    </div>
                    <Button
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={() => { setEditingId(undefined); setShowEditor(true); }}
                    >
                        <Plus className="w-5 h-5 mr-2" /> Add New Story
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

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Total Stories</h3>
                        <p className="text-3xl font-bold text-gray-900">{stories.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Active Stories</h3>
                        <p className="text-3xl font-bold text-gray-900">{activeCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Categories</h3>
                        <p className="text-3xl font-bold text-gray-900">{categories.length}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">All Sleep Stories</h3>
                    {stories.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full bg-white rounded-lg overflow-hidden">
                                <thead className="bg-gradient-to-r from-indigo-100 to-purple-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Story</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Author</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Audio</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {stories.map(story => (
                                        <tr key={story.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    {story.image ? (
                                                        <img
                                                            src={story.image}
                                                            alt={story.title}
                                                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                                                            <BookOpen className="w-5 h-5 text-indigo-600" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-gray-900">{story.title}</p>
                                                        {story.description && (
                                                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{story.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {story.author ? (
                                                    <div className="flex items-center gap-1 text-sm text-gray-700">
                                                        <User className="w-3 h-3 text-gray-400" />
                                                        {story.author}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {story.category ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                        <Tag className="w-3 h-3 mr-1" />{story.category}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {story.duration != null ? (
                                                    <div className="flex items-center gap-1 text-sm text-gray-700">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        {story.duration} min
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Volume2 className="w-4 h-4 text-gray-400" />
                                                    <a href={story.audioUrl} target="_blank" rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                                                        Play
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {story.isActive ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <CheckCircle className="w-3 h-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                        <XCircle className="w-3 h-3" /> Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => { setEditingId(story.id); setShowEditor(true); }}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDelete(story.id)}>
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
                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No sleep stories available</p>
                            <p className="text-gray-400 text-sm mt-2">Create your first sleep story to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SleepStoriesComponent;
