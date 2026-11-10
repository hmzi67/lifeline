import React from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFile, handleApiError } from '@/services/crudService';

export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'file' | 'checkbox' | 'date' | 'time';
    required?: boolean;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    accept?: string; // For file inputs
    rows?: number; // For textarea
    min?: number; // For number inputs
    max?: number; // For number inputs
    disabled?: boolean;
    hint?: string; // Help text shown under the input
}

export interface FormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Record<string, any>) => Promise<void>;
    title: string;
    fields: FormField[];
    initialData?: Record<string, any>;
    submitLabel?: string;
    cancelLabel?: string;
}

export const FormModal: React.FC<FormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    title,
    fields,
    initialData = {},
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
}) => {
    const [formData, setFormData] = React.useState<Record<string, any>>(initialData);
    // Search text of each multiselect field.
    const [multiSearch, setMultiSearch] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [previewUrls, setPreviewUrls] = React.useState<Record<string, string>>({});
    const [uploadingFields, setUploadingFields] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        if (isOpen) {
            setFormData(initialData);
            setErrors({});
            setSubmitError(null);
            // Set preview URLs for existing images
            const previews: Record<string, string> = {};
            fields.forEach((field) => {
                if (field.type === 'file' && initialData[field.name]) {
                    previews[field.name] = initialData[field.name];
                }
            });
            setPreviewUrls(previews);
        }
    }, [isOpen, initialData, fields]);

    const handleChange = (name: string, value: any) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Clear error for this field
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
        if (submitError) setSubmitError(null);
    };

    const handleFileChange = async (name: string, file: File | null) => {
        if (!file) {
            setFormData((prev) => {
                const newData = { ...prev };
                delete newData[name];
                return newData;
            });
            setPreviewUrls((prev) => {
                const newUrls = { ...prev };
                delete newUrls[name];
                return newUrls;
            });
            return;
        }

        setUploadingFields((prev) => ({ ...prev, [name]: true }));
        setSubmitError(null);

        try {
            const uploadedUrl = await uploadFile(file, '/uploads');
            setFormData((prev) => ({ ...prev, [name]: uploadedUrl }));
            setPreviewUrls((prev) => ({ ...prev, [name]: uploadedUrl }));
        } catch (error: any) {
            setSubmitError(handleApiError(error));
        } finally {
            setUploadingFields((prev) => ({ ...prev, [name]: false }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        fields.forEach((field) => {
            if (field.required && !formData[field.name]) {
                newErrors[field.name] = `${field.label} is required`;
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e?: React.SyntheticEvent) => {
        e?.preventDefault();

        if (!validate()) {
            return;
        }

        if (Object.values(uploadingFields).some(Boolean)) {
            setSubmitError('Please wait for file uploads to finish.');
            return;
        }

        setLoading(true);
        setSubmitError(null);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error: any) {
            console.error('Form submission error:', error);
            setSubmitError(error.message || 'An error occurred while saving.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div className="space-y-4">
                        {/* ... fields ... */}
                        {fields.map((field) => (
                            <div key={field.name}>
                                {/* ... field rendering ... */}
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                </label>

                                {field.type === 'text' && (
                                    <input
                                        type="text"
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                        placeholder={field.placeholder}
                                        disabled={field.disabled || loading}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                    />
                                )}

                                {field.type === 'textarea' && (
                                    <textarea
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                        placeholder={field.placeholder}
                                        rows={field.rows || 4}
                                        disabled={field.disabled || loading}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                    />
                                )}

                                {field.type === 'number' && (
                                    <input
                                        type="number"
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, parseFloat(e.target.value))}
                                        placeholder={field.placeholder}
                                        min={field.min}
                                        max={field.max}
                                        disabled={field.disabled || loading}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                    />
                                )}

                                {field.type === 'select' && (
                                    <select
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                        disabled={field.disabled || loading}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                    >
                                        <option value="">Select {field.label}</option>
                                        {field.options?.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {field.type === 'multiselect' && (() => {
                                    const selected: string[] = Array.isArray(formData[field.name]) ? formData[field.name] : [];
                                    const query = (multiSearch[field.name] || '').toLowerCase();
                                    const shown = (field.options || []).filter(o => !query || o.label.toLowerCase().includes(query));
                                    const toggle = (value: string) => handleChange(
                                        field.name,
                                        selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value],
                                    );
                                    return (
                                        <div className="border border-gray-300 rounded-lg">
                                            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                                                <input
                                                    type="text"
                                                    value={multiSearch[field.name] || ''}
                                                    onChange={(e) => setMultiSearch(prev => ({ ...prev, [field.name]: e.target.value }))}
                                                    placeholder={field.placeholder || 'Search...'}
                                                    disabled={field.disabled || loading}
                                                    className="flex-1 text-sm outline-none bg-transparent"
                                                />
                                                <span className="text-xs text-gray-500 whitespace-nowrap">{selected.length} selected</span>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto py-1">
                                                {shown.length === 0 ? (
                                                    <p className="px-3 py-2 text-sm text-gray-400">Nothing found</p>
                                                ) : shown.map(option => (
                                                    <label key={option.value} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.includes(option.value)}
                                                            onChange={() => toggle(option.value)}
                                                            disabled={field.disabled || loading}
                                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        />
                                                        {option.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {field.type === 'checkbox' && (
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData[field.name] || false}
                                            onChange={(e) => handleChange(field.name, e.target.checked)}
                                            disabled={field.disabled || loading}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-600">{field.placeholder}</span>
                                    </div>
                                )}

                                {field.type === 'date' && (
                                    <input
                                        type="date"
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                        disabled={field.disabled || loading}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                    />
                                )}

                                {field.type === 'time' && (
                                    <input
                                        type="time"
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                        disabled={field.disabled || loading}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                    />
                                )}

                                {field.type === 'file' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-4">
                                            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${(field.disabled || loading || uploadingFields[field.name]) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 cursor-pointer'}`}>
                                                {uploadingFields[field.name] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span className="text-sm">{uploadingFields[field.name] ? 'Uploading...' : 'Choose File'}</span>
                                                <input
                                                    type="file"
                                                    accept={field.accept}
                                                    onChange={(e) => {
                                                        void handleFileChange(field.name, e.target.files?.[0] || null);
                                                        e.currentTarget.value = '';
                                                    }}
                                                    disabled={field.disabled || loading || uploadingFields[field.name]}
                                                    className="hidden"
                                                />
                                            </label>
                                            {formData[field.name] && (
                                                <span className="text-sm text-gray-600">
                                                    {typeof formData[field.name] === 'string'
                                                        ? 'Upload complete'
                                                        : 'File selected'}
                                                </span>
                                            )}
                                        </div>
                                        {previewUrls[field.name] && (
                                            <div className="space-y-2">
                                                {(field.accept || '').includes('image') && (
                                                    <div className="relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
                                                        <img
                                                            src={previewUrls[field.name]}
                                                            alt="Preview"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}
                                                {(field.accept || '').includes('video') && (
                                                    <video controls src={previewUrls[field.name]} className="w-full max-w-sm rounded-lg border border-gray-300 bg-black" />
                                                )}
                                                {(field.accept || '').includes('audio') && (
                                                    <audio controls src={previewUrls[field.name]} className="w-full max-w-sm" />
                                                )}
                                                <p className="text-xs text-gray-500 break-all">{formData[field.name]}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {field.hint && (
                                    <p className="text-xs text-gray-500 mt-1">{field.hint}</p>
                                )}
                                {errors[field.name] && (
                                    <p className="text-sm text-red-600 mt-1">{errors[field.name]}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {submitError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{submitError}</p>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => { void handleSubmit(); }}
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            submitLabel
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
