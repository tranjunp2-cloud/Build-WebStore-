import { describe, expect, it } from "vitest";
import { normalizeStripeEvent, verifyStripeWebhook } from "@/lib/payment/stripe-webhook-utils";
import type Stripe from "stripe";

// ── TC-RES-01: Payment & Webhook Idempotency & Signature Security ──
describe("[TC-RES-01] Payment & Webhook Idempotency & Event Normalization", () => {
  it("TC-RES-01.01: normalizes checkout.session.completed event into unified payment_success type", () => {
    // Arrange
    const mockStripeEvent: Stripe.Event = {
      id: "evt_123456789",
      object: "event",
      type: "checkout.session.completed",
      created: 1718000000,
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          amount_total: 5000,
          metadata: { orderId: "order-101", tenantId: "tenant-alpha" },
        } as any,
      },
      account: "acct_connected_123",
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: "idem_key_abc" },
      api_version: "2024-06-20",
    };

    // Act: Normalize event
    const normalized = normalizeStripeEvent(mockStripeEvent);

    // Assert
    expect(normalized).not.toBeNull();
    expect(normalized?.provider).toBe("stripe");
    expect(normalized?.type).toBe("payment_success");
    expect(normalized?.data.id).toBe("cs_test_123");
    expect(normalized?.connectedAccountId).toBe("acct_connected_123");
  });

  it("TC-RES-01.02: normalizes charge.refunded into refund_completed", () => {
    // Arrange
    const mockRefundEvent: Stripe.Event = {
      id: "evt_refund_123",
      object: "event",
      type: "charge.refunded",
      created: 1718000000,
      data: {
        object: {
          id: "ch_test_refund",
          amount_refunded: 5000,
        } as any,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: "2024-06-20",
    };

    // Act
    const normalized = normalizeStripeEvent(mockRefundEvent);

    // Assert
    expect(normalized).not.toBeNull();
    expect(normalized?.type).toBe("refund_completed");
    expect(normalized?.data.id).toBe("ch_test_refund");
  });

  it("TC-RES-01.03: returns null for unhandled event types to safely return 200 and prevent gateway retry storms", () => {
    // Arrange: Unhandled Stripe event type
    const unhandledEvent: Stripe.Event = {
      id: "evt_unhandled_001",
      object: "event",
      type: "customer.source.created" as any,
      created: 1718000000,
      data: { object: {} as any },
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: "2024-06-20",
    };

    // Act
    const result = normalizeStripeEvent(unhandledEvent);

    // Assert: Must return null so HTTP route responds 200 OK without triggering unneeded retry
    expect(result).toBeNull();
  });

  it("TC-RES-01.04: rejects verifyStripeWebhook when secret is not configured", () => {
    // Arrange
    const originalSecretKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_123";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const envRecord = process.env as Record<string, string | undefined>;
    const originalConnectSecret = envRecord["STRIPE_CONNECT_WEBHOOK_SECRET"];
    delete envRecord["STRIPE_CONNECT_WEBHOOK_SECRET"];

    // Act & Assert
    try {
      expect(() => verifyStripeWebhook("payload_body", "sig_123", false)).toThrow(
        "STRIPE_WEBHOOK_SECRET is not set",
      );
    } finally {
      if (originalSecretKey) process.env.STRIPE_SECRET_KEY = originalSecretKey;
      else delete process.env.STRIPE_SECRET_KEY;
      if (originalWebhookSecret) process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
      if (originalConnectSecret) envRecord["STRIPE_CONNECT_WEBHOOK_SECRET"] = originalConnectSecret;
    }
  });
});