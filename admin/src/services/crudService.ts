import api from '@/lib/axios';

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination?: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    message?: string;
}

/**
 * Generic CRUD API service
 * Provides reusable functions for Create, Read, Update, Delete operations
 */
export class CrudService<T> {
    private endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint;
    }

    /**
     * Get all records
     */
    async getAll(params?: Record<string, any>): Promise<ApiResponse<T[]>> {
        const response = await api.get<ApiResponse<T[]>>(this.endpoint, { params });
        return response.data;
    }

    /**
     * Get a single record by ID
     */
    async getById(id: string): Promise<ApiResponse<T>> {
        const response = await api.get<ApiResponse<T>>(`${this.endpoint}/${id}`);
        return response.data;
    }

    /**
     * Create a new record
     */
    async create(data: Partial<T>): Promise<ApiResponse<T>> {
        const response = await api.post<ApiResponse<T>>(this.endpoint, data);
        return response.data;
    }

    /**
     * Update an existing record
     */
    async update(id: string, data: Partial<T>): Promise<ApiResponse<T>> {
        const response = await api.put<ApiResponse<T>>(`${this.endpoint}/${id}`, data);
        return response.data;
    }

    /**
     * Delete a record
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        const response = await api.delete<ApiResponse<void>>(`${this.endpoint}/${id}`);
        return response.data;
    }

    /**
     * Custom GET request to a specific path
     */
    async customGet<R = any>(path: string, params?: Record<string, any>): Promise<ApiResponse<R>> {
        const response = await api.get<ApiResponse<R>>(`${this.endpoint}${path}`, { params });
        return response.data;
    }

    /**
     * Custom POST request to a specific path
     */
    async customPost<R = any>(path: string, data: any): Promise<ApiResponse<R>> {
        const response = await api.post<ApiResponse<R>>(`${this.endpoint}${path}`, data);
        return response.data;
    }
}

/**
 * Upload file to server
 */
const MAX_IMAGE_SIDE = 1600;

/**
 * Phone photos are often 3–8 MB. Large JPEG/PNG/WebP images are scaled to at most 1600px
 * and re-encoded as JPEG before upload: plenty for the app, and far below proxy body limits.
 */
const shrinkImage = async (file: File): Promise<File> => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= 1024 * 1024) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        // JPEG has no transparency: paint white behind PNGs first.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
};

export const uploadFile = async (file: File, endpoint: string = '/uploads'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', await shrinkImage(file));

    try {
        const response = await api.post<ApiResponse<{ url: string }>>(endpoint, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        const url = response.data?.data?.url;
        if (!url) throw new Error('The upload finished but no file address came back.');
        return url;
    } catch (error: any) {
        // nginx answers 413 itself (an HTML page), so there is no JSON message to show.
        if (error?.response?.status === 413) {
            throw new Error(`"${file.name}" is too large to upload. Try a smaller file.`);
        }
        throw error;
    }
};

/**
 * Handle API errors consistently
 */
export const handleApiError = (error: any): string => {
    if (error.response?.data?.message) {
        return error.response.data.message;
    }
    if (error.message) {
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
};
