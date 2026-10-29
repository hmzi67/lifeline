import React, { useState, useEffect } from 'react';
import {
    Waves, Plus, Loader2, AlertCircle, Edit, Trash2,
    ArrowLeft, Volume2, Tag, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import { MediaUploadField } from '@/components/shared/MediaUploadField';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SleepSound {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    soundUrl: string;
    category: string | null;
    duration: number | null;
    isActive: boolean;
}

interface FormData {
    name: string;
    description: string;
    image: string;
    soundUrl: string;
    category: string;
    duration: string;
    isActive: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SOUND_CATEGORIES = [
    'Nature', 'Rain', 'Ocean', 'Forest', 'White Noise',
    'Pink Noise', 'Brown Noise', 'Fan', 'Binaural Beats', 'Other',
];

const EMPTY_FORM: FormData = {
    name: '',
    description: '',
    image: '',
    soundUrl: '',
    category: '',
    duration: '',
    isActive: true,
};

// ── Editor ────────────────────────────────────────────────────────────────────
interface EditorProps {
    soundId?: string;
    onSave: () => void;
    onCancel: () => void;
}

const SleepSoundEditor: React.FC<EditorProps> = ({ soundId, onSave, onCancel }) => {
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isEditing = Boolean(soundId);

    useEffect(() => {
        if (soundId) fetchSound();
    }, [soundId]);

    const fetchSound = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/sleep-sounds/${soundId}`);
            if (res.data.success && res.data.data) {
                const s: SleepSound = res.data.data;
                setFormData({
                    name: s.name ?? '',
                    description: s.description ?? '',
                    image: s.image ?? '',
                    soundUrl: s.soundUrl ?? '',
                    category: s.category ?? '',
                    duration: s.duration != null ? String(s.duration) : '',
                    isActive: s.isActive,
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Failed to load sleep sound');
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
        if (!formData.name.trim()) { setError('Name is required'); return; }
        if (!formData.soundUrl.trim()) { setError('Sound URL is required'); return; }

        try {
            setLoading(true);
            const payload = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                image: formData.image.trim() || null,
                soundUrl: formData.soundUrl.trim(),
                category: formData.category || null,
                duration: formData.duration ? Number(formData.duration) : null,
                isActive: formData.isActive,
            };

            if (isEditing && soundId) {
                await api.put(`/sleep-sounds/${soundId}`, payload);
            } else {
                await api.post('/sleep-sounds', payload);
            }
            onSave();
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Failed to save sleep sound');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading sound…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">
                    {isEditing ? 'Edit Sleep Sound' : 'Create New Sleep Sound'}
                </h2>
                <p className="text-gray-500 mt-1">
                    {isEditing ? 'Update sound details' : 'Add a new ambient sound to the library'}
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={e => handleChange('name', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., Gentle Rain"
                        required
                    />
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                        value={formData.category}
                        onChange={e => handleChange('category', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="">Select a category</option>
                        {SOUND_CATEGORIES.map(c => (
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., 60 (leave empty for looping sounds)"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={e => handleChange('description', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder="Short description of the sound…"
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
                    label="Sound"
                    value={formData.soundUrl}
                    onChange={(value) => handleChange('soundUrl', value)}
                    accept="audio/*"
                    mediaKind="audio"
                    required
                    placeholder="https://example.com/rain.mp3"
                />

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={e => handleChange('isActive', e.target.checked)}
                        className="w-5 h-5 accent-teal-600 rounded"
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
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-teal-600 hover:to-cyan-600"
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                        ) : (
                            isEditing ? 'Update Sound' : 'Create Sound'
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
};

// ── List ──────────────────────────────────────────────────────────────────────
const SleepSoundsComponent: React.FC = () => {
    const [showEditor, setShowEditor] = useState(false);
    const [editingId, setEditingId] = useState<string | undefined>(undefined);
    const [sounds, setSounds] = useState<SleepSound[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!showEditor) fetchSounds();
    }, [showEditor]);

    const fetchSounds = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/sleep-sounds');
            if (res.data.success && res.data.data) {
                setSounds(res.data.data);
            }
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Failed to fetch sleep sounds.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this sleep sound?')) return;
        try {
            await api.delete(`/sleep-sounds/${id}`);
            fetchSounds();
        } catch (err: any) {
            alert(err.response?.data?.message ?? 'Failed to delete sleep sound.');
        }
    };

    // ── Editor view ──
    if (showEditor) {
        return (
            <div className="space-y-4">
                <Button variant="outline" onClick={() => { setShowEditor(false); setEditingId(undefined); }} className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Sleep Sounds
                </Button>
                <SleepSoundEditor
                    soundId={editingId}
                    onSave={() => { setShowEditor(false); setEditingId(undefined); fetchSounds(); }}
                    onCancel={() => { setShowEditor(false); setEditingId(undefined); }}
                />
            </div>
        );
    }

    const activeCount = sounds.filter(s => s.isActive).length;
    const categories = [...new Set(sounds.map(s => s.category).filter(Boolean))];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-teal-500 mx-auto" />
                    <p className="text-gray-600">Loading sleep sounds…</p>
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
                        <div className="p-3 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-xl">
                            <Waves className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Sleep Sounds</h2>
                            <p className="text-gray-500">Manage ambient sleep sounds</p>
                        </div>
                    </div>
                    <Button
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={() => { setEditingId(undefined); setShowEditor(true); }}
                    >
                        <Plus className="w-5 h-5 mr-2" /> Add New Sound
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
                    <div className="bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Total Sounds</h3>
                        <p className="text-3xl font-bold text-gray-900">{sounds.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Active Sounds</h3>
                        <p className="text-3xl font-bold text-gray-900">{activeCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-100 to-sky-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Categories</h3>
                        <p className="text-3xl font-bold text-gray-900">{categories.length}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">All Sleep Sounds</h3>
                    {sounds.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full bg-white rounded-lg overflow-hidden">
                                <thead className="bg-gradient-to-r from-teal-100 to-cyan-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Sound</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Audio</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {sounds.map(sound => (
                                        <tr key={sound.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    {sound.image ? (
                                                        <img
                                                            src={sound.image}
                                                            alt={sound.name}
                                                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                                                            <Waves className="w-5 h-5 text-teal-600" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-gray-900">{sound.name}</p>
                                                        {sound.description && (
                                                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{sound.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {sound.category ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                                        <Tag className="w-3 h-3 mr-1" />{sound.category}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {sound.duration != null ? (
                                                    <div className="flex items-center gap-1 text-sm text-gray-700">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        {sound.duration} min
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Looping</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Volume2 className="w-4 h-4 text-gray-400" />
                                                    <a href={sound.soundUrl} target="_blank" rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                                                        Play
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {sound.isActive ? (
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
                                                        onClick={() => { setEditingId(sound.id); setShowEditor(true); }}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDelete(sound.id)}>
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
                            <Waves className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No sleep sounds available</p>
                            <p className="text-gray-400 text-sm mt-2">Create your first sleep sound to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SleepSoundsComponent;
