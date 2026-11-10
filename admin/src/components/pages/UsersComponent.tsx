import React, { useEffect, useState, useMemo } from 'react';
import {
    Users,
    Plus,
    User,
    Mail,
    Calendar,
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Eye,
    Trash2,
    UserCheck,
    UserX,
    ArrowUpDown,
    Lock,
    UserPlus,
    Shield,
} from 'lucide-react';
import api from '@/lib/axios';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    createColumnHelper,
    type SortingState,
    type ColumnFiltersState,
} from '@tanstack/react-table';
import { useUserStore } from '@/store/useUserStore';
import type { CreateUserData } from '@/services/userService';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { UserProfile } from '@/types/user.types';

const columnHelper = createColumnHelper<UserProfile>();

const UsersComponent: React.FC = () => {
    const { users, loading, error, fetchUsers, createUser, updateUser, deleteUser } = useUserStore();
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);
    const [isDeletingUser, setIsDeletingUser] = useState(false);

    // Roles for the role dropdown
    const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);

    // Form state for adding user
    const [newUser, setNewUser] = useState<CreateUserData>({
        email: '',
        username: '',
        password: '',
        roleId: '',
    });

    // Form state for editing user
    const [editUser, setEditUser] = useState<Partial<CreateUserData>>({
        email: '',
        username: ''
    }); useEffect(() => {
        fetchUsers();
        api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/roles')
            .then(res => {
                if (res.data.success) {
                    setRoles(
                        res.data.data.filter(r =>
                            ['admin', 'user'].includes(r.name.toLowerCase())
                        ).sort((a, b) => {
                            const order = ['user', 'admin'];
                            return order.indexOf(a.name.toLowerCase()) - order.indexOf(b.name.toLowerCase());
                        })
                    );
                }
            })
            .catch(() => { });
    }, []);

    const handleUserClick = (user: UserProfile) => {
        setSelectedUser(user);
        setIsDialogOpen(true);
    };

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.username || newUser.password.length < 12) {
            return; // Basic validation; the API also requires 12+ character passwords
        }

        setIsCreatingUser(true);
        try {
            await createUser(newUser);
            setIsAddDialogOpen(false);
            setNewUser({
                email: '',
                username: '',
                password: '',
                roleId: '',
            });
        } catch (error) {
            console.error('Failed to create user:', error);
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleEditUser = (user: UserProfile) => {
        setSelectedUser(user);
        setEditUser({
            email: user.email || '',
            username: user.username || ''
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!selectedUser || !editUser.email || !editUser.username) {
            return; // Basic validation
        }

        setIsUpdatingUser(true);
        try {
            await updateUser(selectedUser.id!, editUser);
            setIsEditDialogOpen(false);
            setEditUser({ email: '', username: '' });
            setSelectedUser(null);
        } catch (error) {
            console.error('Failed to update user:', error);
        } finally {
            setIsUpdatingUser(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        setIsDeletingUser(true);
        try {
            await deleteUser(userId);
        } catch (error) {
            console.error('Failed to delete user:', error);
        } finally {
            setIsDeletingUser(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setNewUser(prev => ({ ...prev, [field]: value }));
    };

    const handleEditInputChange = (field: string, value: string) => {
        setEditUser(prev => ({ ...prev, [field]: value }));
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const getStatusBadge = (_selectedUser: UserProfile) => {
        // Mock status - you can implement real logic based on your data
        const isActive = Math.random() > 0.3;
        return isActive ? (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                <UserCheck className="w-3 h-3 mr-1" />
                Active
            </Badge>
        ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                <UserX className="w-3 h-3 mr-1" />
                Inactive
            </Badge>
        );
    };

    const columns = useMemo(
        () => [
            columnHelper.accessor('username', {
                id: 'user',
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="h-auto p-0 font-semibold hover:bg-transparent flex items-center"
                        >
                            User
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const user = row.original;
                    return (
                        <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                                <AvatarImage src={user.profileImage} alt={user.username} />
                                <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-sm">
                                    {user.username?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-900 truncate">
                                    {user.username}
                                </div>
                                <div className="text-sm text-gray-500 truncate">
                                    ID: {user.id}
                                </div>
                            </div>
                        </div>
                    );
                },
                size: 300,
            }),
            columnHelper.accessor('email', {
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="h-auto p-0 font-semibold hover:bg-transparent flex items-center"
                        >
                            Email
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ getValue }) => (
                    <div className="text-gray-600">{getValue()}</div>
                ),
            }),
            columnHelper.display({
                id: 'status',
                header: () => <span className="font-semibold text-gray-900">Status</span>,
                cell: ({ row }) => getStatusBadge(row.original),
                size: 120,
            }),
            columnHelper.accessor('createdAt', {
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="h-auto p-0 font-semibold hover:bg-transparent flex items-center"
                        >
                            Last Active
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ getValue }) => (
                    <div className="text-gray-600">{formatDate(getValue() ?? '')}</div>
                ),
                size: 150,
            }),
            columnHelper.display({
                id: 'actions',
                header: () => <span className="font-semibold text-gray-900">Actions</span>,
                cell: ({ row }) => {
                    const user = row.original;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 w-8 p-0"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleUserClick(user);
                                }}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditUser(user);
                                }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteUser(user.id!);
                                    }}
                                    className="text-red-600 focus:text-red-600"
                                    disabled={isDeletingUser}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete User
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
                size: 80,
            }),
        ],
        []
    );

    const table = useReactTable({
        data: users || [],
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            globalFilter,
        },
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
    });

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div className="ml-3 text-lg text-gray-600">Loading users...</div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-600">Error: {error}</div>
        </div>
    );

    return (
        <div className="space-y-6 sm:p-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl sm:text-3xl">Users Management</CardTitle>
                                <CardDescription className="text-base sm:text-lg">
                                    Manage and monitor user activities ({table.getFilteredRowModel().rows.length} users)
                                </CardDescription>
                            </div>
                        </div>
                        <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600" onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add User
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search and Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Search all columns..."
                                    value={globalFilter ?? ''}
                                    onChange={(e) => setGlobalFilter(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button variant="outline" size="sm">
                                <Filter className="w-4 h-4 mr-2" />
                                Filter
                            </Button>
                        </div>

                        {/* Pagination Info */}
                        <div className="text-sm text-gray-500">
                            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border bg-white overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id} className="bg-gray-50/50 border-b">
                                        {headerGroup.headers.map((header) => (
                                            <th
                                                key={header.id}
                                                className="px-6 py-4 text-left"
                                                style={{ width: header.getSize() }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            onClick={() => handleUserClick(row.original)}
                                            data-state={row.getIsSelected() && "selected"}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <td key={cell.id} className="px-6 py-4">
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext()
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columns.length} className="px-6 py-8 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="w-8 h-8 text-gray-400" />
                                                <p className="text-gray-500">No users found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between px-2 py-4">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                {"<<"}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                {"<"}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                {">"}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                {">>"}
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Rows per page:</span>
                            <select
                                className="h-8 w-16 rounded border border-gray-300 px-2 text-sm"
                                value={table.getState().pagination.pageSize}
                                onChange={(e) => {
                                    table.setPageSize(Number(e.target.value));
                                }}
                            >
                                {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                                    <option key={pageSize} value={pageSize}>
                                        {pageSize}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User Details Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <Avatar className="w-12 h-12">
                                <AvatarImage src={selectedUser?.profileImage} alt={selectedUser?.username} />
                                <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                                    {selectedUser?.username?.charAt(0)?.toUpperCase() || <User className="w-6 h-6" />}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="text-xl font-semibold">{selectedUser?.username}</div>
                                <div className="text-sm text-gray-500 font-normal">User Details</div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-gray-500" />
                                <div>
                                    <div className="text-sm font-medium">Email</div>
                                    <div className="text-sm text-gray-600">{selectedUser?.email}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <div>
                                    <div className="text-sm font-medium">Last Active</div>
                                    <div className="text-sm text-gray-600">{formatDate(selectedUser?.createdAt || '')}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-gray-500" />
                                <div>
                                    <div className="text-sm font-medium">User ID</div>
                                    <div className="text-sm text-gray-600 font-mono">{selectedUser?.id}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 flex items-center justify-center">
                                    {selectedUser && getStatusBadge(selectedUser)}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                    setIsDialogOpen(false);
                                    if (selectedUser) {
                                        handleEditUser(selectedUser);
                                    }
                                }}
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit User
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1">
                                <Eye className="w-4 h-4 mr-2" />
                                View Activity
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add User Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
                                <UserPlus className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold">Add New User</div>
                                <div className="text-sm text-gray-500 font-normal">Create a new user account</div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Separator />

                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    <Mail className="w-4 h-4" />
                                    Email *
                                </Label>
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={newUser.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    <User className="w-4 h-4" />
                                    Username *
                                </Label>
                                <Input
                                    type="text"
                                    placeholder="Enter username"
                                    value={newUser.username}
                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    <Lock className="w-4 h-4" />
                                    Password *
                                </Label>
                                <Input
                                    type="password"
                                    placeholder="At least 12 characters"
                                    value={newUser.password}
                                    onChange={(e) => handleInputChange('password', e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <Shield className="w-4 h-4" />
                                    Role
                                </Label>
                                <select
                                    value={newUser.roleId || ''}
                                    onChange={(e) => handleInputChange('roleId', e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">No Role</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>
                                            {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setIsAddDialogOpen(false)}
                                disabled={isCreatingUser}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                                onClick={handleCreateUser}
                                disabled={isCreatingUser || !newUser.email || !newUser.username || newUser.password.length < 12}
                            >
                                {isCreatingUser ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Creating...
                                    </div>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create User
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg">
                                <Edit className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold">Edit User</div>
                                <div className="text-sm text-gray-500 font-normal">Update user information</div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Separator />

                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    <Mail className="w-4 h-4" />
                                    Email *
                                </Label>
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={editUser.email || ''}
                                    onChange={(e) => handleEditInputChange('email', e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    <User className="w-4 h-4" />
                                    Username *
                                </Label>
                                <Input
                                    type="text"
                                    placeholder="Enter username"
                                    value={editUser.username || ''}
                                    onChange={(e) => handleEditInputChange('username', e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div className="text-sm text-gray-500 italic">
                                Note: Password cannot be changed through this form for security reasons.
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setIsEditDialogOpen(false)}
                                disabled={isUpdatingUser}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                                onClick={handleUpdateUser}
                                disabled={isUpdatingUser || !editUser.email || !editUser.username}
                            >
                                {isUpdatingUser ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Updating...
                                    </div>
                                ) : (
                                    <>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Update User
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UsersComponent;