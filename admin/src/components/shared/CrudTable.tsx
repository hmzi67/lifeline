import React from 'react';
import { Loader2, AlertCircle, Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Column<T> {
    key: keyof T | string;
    label: string;
    render?: (value: any, row: T) => React.ReactNode;
    sortable?: boolean;
    width?: string;
}

export interface CrudTableProps<T> {
    data: T[];
    columns: Column<T>[];
    loading?: boolean;
    error?: string;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    onAdd?: () => void;
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    searchable?: boolean;
    searchPlaceholder?: string;
    emptyMessage?: string;
    stats?: Array<{
        label: string;
        value: number | string;
        gradient?: string;
    }>;
}

export function CrudTable<T extends { id: string }>({
    data,
    columns,
    loading = false,
    error,
    onEdit,
    onDelete,
    onAdd,
    title,
    description,
    icon: Icon,
    searchable = true,
    searchPlaceholder = 'Search...',
    emptyMessage = 'No data available',
    stats,
}: CrudTableProps<T>) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 10;

    // Filter data based on search
    const filteredData = React.useMemo(() => {
        if (!searchTerm) return data;

        return data.filter((row) => {
            return columns.some((col) => {
                const value = row[col.key as keyof T];
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchTerm.toLowerCase());
            });
        });
    }, [data, searchTerm, columns]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to page 1 when search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        {Icon && (
                            <div className="p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-xl">
                                <Icon className="w-6 h-6 text-blue-600" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
                            {description && <p className="text-gray-500">{description}</p>}
                        </div>
                    </div>

                    {onAdd && (
                        <Button
                            type="button"
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            onClick={onAdd}
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Add New
                        </Button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-sm font-medium text-red-600">{error}</p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {stats && stats.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                className={`rounded-xl p-6 ${stat.gradient || 'bg-gradient-to-br from-blue-100 to-cyan-100'
                                    }`}
                            >
                                <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.label}</h3>
                                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search */}
                {searchable && (
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6">
                    {paginatedData.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full bg-white rounded-lg overflow-hidden">
                                    <thead className="bg-gradient-to-r from-blue-100 to-cyan-100">
                                        <tr>
                                            {columns.map((col, index) => (
                                                <th
                                                    key={index}
                                                    className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                                                    style={{ width: col.width }}
                                                >
                                                    {col.label}
                                                </th>
                                            ))}
                                            {(onEdit || onDelete) && (
                                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {paginatedData.map((row) => (
                                            <tr key={row.id} className="hover:bg-gray-50 transition-colors duration-200">
                                                {columns.map((col, colIndex) => (
                                                    <td key={colIndex} className="px-6 py-4">
                                                        {col.render
                                                            ? col.render(row[col.key as keyof T], row)
                                                            : String(row[col.key as keyof T] ?? '-')}
                                                    </td>
                                                ))}
                                                {(onEdit || onDelete) && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex justify-end gap-2">
                                                            {onEdit && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                    onClick={() => onEdit(row)}
                                                                    aria-label="Edit"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {onDelete && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => onDelete(row)}
                                                                    aria-label="Delete"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6">
                                    <p className="text-sm text-gray-600">
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                                        {Math.min(currentPage * itemsPerPage, filteredData.length)} of{' '}
                                        {filteredData.length} results
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="px-4 py-2 text-sm font-medium text-gray-700">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-white rounded-lg p-12 text-center">
                            {Icon && <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />}
                            <p className="text-gray-500 text-lg">{emptyMessage}</p>
                            {searchTerm && (
                                <p className="text-gray-400 text-sm mt-2">
                                    No results found for &ldquo;{searchTerm}&rdquo;
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
