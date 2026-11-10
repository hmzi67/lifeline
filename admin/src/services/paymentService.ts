import api from "@/lib/axios";

export interface CreateSubscriptionPaymentRequest {
  userId: string;
  planName: string;
  amount: number;
  method: string;
  status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
}

class PaymentService {
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
      const response = await api.get("/subscriptions/status");
      return response.data;
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string) {
    try {
      const response = await api.post("/subscriptions/cancel", {
        subscriptionId,
      });
      return response.data;
    } catch (error) {
      console.error("Error canceling subscription:", error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
