import React, { useState, useEffect } from 'react';
import { Save, X, Music, Image as ImageIcon, FileText, Tag, Volume2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import { MediaUploadField } from '@/components/shared/MediaUploadField';

interface MeditationFormData {
    name: string;
    type: string;
    description: string;
    image: string;
    soundUrl: string;
    /** Minutes; shown in the app and used for its sessions. */
    durationMinutes: string;
}

interface MeditationEditorProps {
    meditationId?: string;
    onSave?: () => void;
    onCancel?: () => void;
}

const MEDITATION_TYPES = [
    'Guided',
    'Breathing',
    'Mindfulness',
    'Sleep',
    'Body Scan',
    'Visualization',
    'Mantra',
    'Walking',
    'Loving-Kindness',
    'Yoga Nidra',
    'Chakra',
    'Zen',
    'Transcendental',
    'Progressive Relaxation',
    'Sound Bath',
    'Gratitude',
    'Focus & Productivity',
    'Anxiety Relief',
    'Morning Energy',
    'Other'
];

const MeditationEditor: React.FC<MeditationEditorProps> = ({ meditationId, onSave, onCancel }) => {
    const [formData, setFormData] = useState<MeditationFormData>({
        name: '',
        type: '',
        description: '',
        image: '',
        soundUrl: '',
        durationMinutes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (meditationId) {
            setIsEditing(true);
            fetchMeditation();
        }
    }, [meditationId]);

    const fetchMeditation = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/meditations/${meditationId}`);
            if (response.data.success && response.data.data) {
                const meditation = response.data.data;
                setFormData({
                    name: meditation.name || '',
                    type: meditation.type || '',
                    description: meditation.description || '',
                    image: meditation.image || '',
                    soundUrl: meditation.soundUrl || '',
                    durationMinutes: meditation.duration != null ? String(meditation.duration) : ''
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch meditation');
            console.error('Error fetching meditation:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }
        if (!formData.type) {
            setError('Type is required');
            return;
        }
        if (!formData.soundUrl.trim()) {
            setError('Sound URL is required');
            return;
        }
        const minutes = formData.durationMinutes.trim() ? Number(formData.durationMinutes) : null;
        if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
            setError('Duration must be a whole number of minutes between 1 and 600');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                name: formData.name.trim(),
                type: formData.type,
                description: formData.description.trim(),
                image: formData.image.trim(),
                soundUrl: formData.soundUrl.trim(),
                durationMinutes: minutes
            };

            if (isEditing && meditationId) {
                await api.put(`/meditations/${meditationId}`, payload);
            } else {
                await api.post('/meditations', payload);
            }

            if (onSave) {
                onSave();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save meditation');
            console.error('Error saving meditation:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof MeditationFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (loading && isEditing) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading meditation...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">
                    {isEditing ? 'Edit Meditation' : 'Create New Meditation'}
                </h2>
                <p className="text-gray-500 mt-1">
                    {isEditing ? 'Update meditation details' : 'Add a new meditation to the library'}
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Name <span className="text-red-500">*</span>
                        </div>
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., Morning Calm"
                        required
                    />
                </div>

                {/* Type Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            Type <span className="text-red-500">*</span>
                        </div>
                    </label>
                    <select
                        value={formData.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        required
                    >
                        <option value="">Select a type</option>
                        {MEDITATION_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Duration Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Duration (minutes)
                        </div>
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={600}
                        step={1}
                        value={formData.durationMinutes}
                        onChange={(e) => handleChange('durationMinutes', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., 10"
                    />
                    <p className="text-xs text-gray-400 mt-1">Shown on the meditation in the app.</p>
                </div>

                {/* Description Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Description
                        </div>
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[120px] resize-y"
                        placeholder="Describe the meditation practice..."
                    />
                </div>

                <MediaUploadField
                    label="Meditation Image"
                    value={formData.image}
                    onChange={(value) => handleChange('image', value)}
                    accept="image/*"
                    mediaKind="image"
                    placeholder="https://example.com/image.jpg"
                />

                <MediaUploadField
                    label="Meditation Audio"
                    value={formData.soundUrl}
                    onChange={(value) => handleChange('soundUrl', value)}
                    accept="audio/*"
                    mediaKind="audio"
                    required
                    placeholder="https://example.com/audio.mp3"
                />

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5 mr-2" />
                                {isEditing ? 'Update Meditation' : 'Create Meditation'}
                            </>
                        )}
                    </Button>
                    {onCancel && (
                        <Button
                            type="button"
                            onClick={onCancel}
                            variant="outline"
                            className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 hover:bg-gray-50 transition-all duration-300"
                        >
                            <X className="w-5 h-5 mr-2" />
                            Cancel
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default MeditationEditor;
