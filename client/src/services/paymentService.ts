import { api } from "./api";

interface BackendResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface CreateSubscriptionRequest {
  pricingPlanId: string;
  couponCode?: string;
}

/** The server prices the plan (and coupon); a trial returns a SetupIntent instead of a PaymentIntent. */
export interface CreateSubscriptionResponse {
  intentType: "payment" | "setup";
  clientSecret: string;
  paymentIntentId: string;
  subscriptionId: string;
}

export interface CreateSubscriptionPaymentRequest {
  userId: string;
  planName: string;
  amount: number;
  method: string;
  status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
}

class PaymentService {
  /**
   * Start checkout for a pricing plan; the server sets the amount
   */
  async createSubscription(
    data: CreateSubscriptionRequest
  ): Promise<CreateSubscriptionResponse> {
    const response = await api.post<BackendResponse<CreateSubscriptionResponse>>(
      "/payments/subscriptions",
      data
    );
    return response.data.data;
  }

  /**
   * After Stripe confirms the card, ask the server to verify it and grant access
   */
  async confirmSubscription(subscriptionId: string) {
    const response = await api.post<BackendResponse<{ subscriptionPaymentId: string; status: string }>>(
      "/payments/subscriptions/confirm",
      { subscriptionId }
    );
    return response.data.data;
  }

  /**
   * Get the Stripe publishable key from the server
   */
  async getPublishableKey(): Promise<string> {
    const response = await api.get<BackendResponse<{ publishableKey: string }>>(
      "/payments/publishable-key"
    );
    return response.data.data.publishableKey;
  }

  /**
   * Create a subscription payment record
   */
  async createSubscriptionPayment(
    data: CreateSubscriptionPaymentRequest
  ) {
    try {
      const response = await api.post("/subscription-payments", data);
      return response.data;
    } catch (error) {
      console.error("Error creating subscription payment:", error);
      throw error;
    }
  }

  /**
   * Get payment history for the user
   */
  async getPaymentHistory(userId: string) {
    try {
      const response = await api.get(`/subscription-payments/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching payment history:", error);
      throw error;
    }
  }

  /**
   * Get all subscription payments with pagination
   */
  async getAllPayments(page = 1, limit = 10) {
    try {
      const response = await api.get("/subscription-payments", {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching payments:", error);
      throw error;
    }
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus() {
    try {
      const response = await api.get("/subscription/status");
      return response.data;
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
