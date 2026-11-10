import api from "@/lib/axios";
import type { UserProfile } from "@/types/user.types";

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  roleId?: string;
  status?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface UserListResponse {
  users: UserProfile[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const userService = {
  // Get all users with pagination and filtering
  getAllUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) => {
    const response = await api.get<ApiResponse<UserListResponse>>(
      "/user/admin/users",
      {
        params,
      }
    );
    return response.data;
  },

  // Create a new user
  createUser: async (userData: CreateUserData) => {
    const response = await api.post<ApiResponse<{ user: UserProfile }>>(
      "/user/admin/users",
      userData
    );
    return response.data;
  },

  // Get user by ID with all relations
  getUserById: async (id: string) => {
    const response = await api.get<ApiResponse<{ user: UserProfile }>>(
      `/user/admin/users/${id}`
    );
    return response.data;
  },

  // Update user
  updateUser: async (id: string, userData: Partial<CreateUserData>) => {
    const response = await api.put<ApiResponse<{ user: UserProfile }>>(
      `/user/admin/users/${id}`,
      userData
    );
    return response.data;
  },

  // Delete user
  deleteUser: async (id: string) => {
    const response = await api.delete<ApiResponse<{ user: UserProfile }>>(
      `/user/admin/users/${id}`
    );
    return response.data;
  },

  // Get user statistics
  getUserStats: async () => {
    const response = await api.get<
      ApiResponse<{
        totalUsers: number;
        usersByStatus: Array<{ status: string; _count: { status: number } }>;
        usersByRole: Array<{ roleId: string; _count: { roleId: number } }>;
        recentUsers: number;
        verifiedUsers: number;
        verificationRate: string;
      }>
    >("/user/admin/stats");
    return response.data;
  },

  // Get current user profile
  getCurrentUser: async () => {
    const response =
      await api.get<ApiResponse<{ user: UserProfile }>>("/user/profile");
    return response.data;
  },
};
