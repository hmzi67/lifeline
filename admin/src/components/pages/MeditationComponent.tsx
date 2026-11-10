import React, { useState, useEffect } from 'react';
import { Music, Plus, Loader2, AlertCircle, Edit, Trash2, ArrowLeft, Volume2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import MeditationEditor from './MeditationEditor';

interface Meditation {
    id: string;
    name: string;
    type: string;
    description: string | null;
    image: string | null;
    soundUrl: string;
}

interface ApiResponse {
    success: boolean;
    data: Meditation[];
    message?: string;
}

const MeditationComponent: React.FC = () => {
    const [showEditor, setShowEditor] = useState(false);
    const [editingMeditationId, setEditingMeditationId] = useState<string | undefined>(undefined);
    const [meditations, setMeditations] = useState<Meditation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (!showEditor) {
            fetchMeditations();
        }
    }, [showEditor]);

    const fetchMeditations = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get<ApiResponse>('/meditations');
            if (response.data.success && response.data.data) {
                setMeditations(response.data.data);
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                'Failed to fetch meditations. Please try again later.'
            );
            console.error('Error fetching meditations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNew = () => {
        setEditingMeditationId(undefined);
        setShowEditor(true);
    };

    const handleEdit = (meditation: Meditation) => {
        setEditingMeditationId(meditation.id);
        setShowEditor(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this meditation?')) {
            return;
        }

        try {
            await api.delete(`/meditations/${id}`);
            fetchMeditations();
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to delete meditation. Please try again.';
            console.error('Error deleting meditation:', err);
            alert(errorMessage);
        }
    };

    const handleBackToList = () => {
        setShowEditor(false);
        setEditingMeditationId(undefined);
    };

    const handleSave = () => {
        setShowEditor(false);
        setEditingMeditationId(undefined);
        fetchMeditations();
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
                    Back to Meditations
                </Button>
                <MeditationEditor
                    meditationId={editingMeditationId}
                    onSave={handleSave}
                    onCancel={handleBackToList}
                />
            </div>
        );
    }

    // Group meditations by type
    const meditationsByType = meditations.reduce((acc, meditation) => {
        const type = meditation.type || 'Other';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(meditation);
        return acc;
    }, {} as Record<string, Meditation[]>);

    const typeCount = Object.keys(meditationsByType).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-gray-600">Loading meditations...</p>
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
                        <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                            <Music className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Meditation Management</h2>
                            <p className="text-gray-500">Manage all meditation sessions</p>
                        </div>
                    </div>

                    <Button
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={handleAddNew}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add New Meditation
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

                {/* Meditation Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Total Meditations</h3>
                        <p className="text-3xl font-bold text-gray-900">{meditations.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Meditation Types</h3>
                        <p className="text-3xl font-bold text-gray-900">{typeCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Most Common Type</h3>
                        <p className="text-3xl font-bold text-gray-900">
                            {typeCount > 0
                                ? Object.entries(meditationsByType).sort((a, b) => b[1].length - a[1].length)[0][0]
                                : '-'
                            }
                        </p>
                    </div>
                </div>

                {/* Meditations Table */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">All Meditations</h3>
                    {meditations.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full bg-white rounded-lg overflow-hidden">
                                <thead className="bg-gradient-to-r from-purple-100 to-pink-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Meditation
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Audio
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {meditations.map((meditation) => (
                                        <tr key={meditation.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    {meditation.image ? (
                                                        <img
                                                            src={meditation.image}
                                                            alt={meditation.name}
                                                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                                                            <Music className="w-6 h-6 text-purple-600" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {meditation.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    <Tag className="w-3 h-3 mr-1" />
                                                    {meditation.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {meditation.description ? (
                                                    <p className="text-sm text-gray-600 line-clamp-2 max-w-md">
                                                        {meditation.description}
                                                    </p>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Volume2 className="w-4 h-4 text-gray-400" />
                                                    <a
                                                        href={meditation.soundUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                                    >
                                                        Play
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => handleEdit(meditation)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDelete(meditation.id)}
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
                            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No meditations available</p>
                            <p className="text-gray-400 text-sm mt-2">Create your first meditation to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeditationComponent;
