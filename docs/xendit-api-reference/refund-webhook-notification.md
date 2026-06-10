> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Refund webhook notification

> Webhook notification that will be sent to your defined webhook url for updates to refund status.


## OpenAPI

````json POST /your_refund_webhook_url
{
  "openapi": "3.0.0",
  "info": {
    "title": "Payments",
    "version": "3.0.0",
    "description": "Payments API enables businesses to integrate seamless and secure payment processing into their platforms, \nsupporting key features like a customizable checkout page for user-friendly payment experiences, \ndirect payments through API for tailored and flexible transaction flows, \nand recurring subscriptions to automate billing for memberships or SaaS. \nThese APIs streamline payment processing by supporting multiple payment channels, \nensuring PCI compliance, and offering features like tokenization, real-time transactions, \nand automated retries for subscription payments, making them essential for modern, scalable businesses.\n"
  },
  "servers": [
    {
      "url": "https://api.xendit.co",
      "description": "Xendit API"
    }
  ],
  "paths": {
    "/your_refund_webhook_url": {
      "post": {
        "operationId": "RefundWebhook",
        "summary": "Refund webhook notification",
        "description": "Webhook notification that will be sent to your defined webhook url for updates to refund status.\n",
        "parameters": [
          {
            "$ref": "#/components/parameters/Payments_API_XCallbackToken"
          }
        ],
        "tags": [
          "Refund"
        ],
        "requestBody": {
          "description": "Refund status callback",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "description": "Refund status callback for refund",
                "properties": {
                  "event": {
                    "type": "string",
                    "enum": [
                      "refund.succeeded",
                      "refund.failed"
                    ],
                    "description": "Webhook event names for payment capture status updates.\n"
                  },
                  "business_id": {
                    "$ref": "#/components/schemas/Payments_API_BusinessId"
                  },
                  "created": {
                    "type": "string",
                    "format": "date-time",
                    "description": "Timestamp of webhook delivery attempt in ISO 8601 date-time format.\n",
                    "example": "2021-12-31T23:59:59Z"
                  },
                  "data": {
                    "$ref": "#/components/schemas/Payments_API_RefundSchema"
                  }
                }
              },
              "example": {
                "refundSucceeded": {
                  "value": {
                    "event": "refund.succeeded",
                    "business_id": "6094fa76c2fd53701b8e079c",
                    "created": "2021-12-02T14:52:21.566Z",
                    "data": {
                      "event": "refund.succeeded",
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "created": "2020-08-29T09:12:33.001Z",
                      "data": {
                        "id": "rfd-6f4a377d-a201-437f-9119-f8b00cbbe857",
                        "payment_id": "ddpy-3cd658ae-25b9-4659-aa36-596ae41a809f",
                        "invoice_id": null,
                        "amount": "10000",
                        "payment_method_type": "DIRECT_DEBIT",
                        "channel_code": "BPI",
                        "currency": "PHP",
                        "status": "SUCCEEDED",
                        "reason": "CANCELLATION",
                        "reference_id": "b2756a1e-e6cd-4352-9a68-0483aa2b6a2",
                        "failure_code": null,
                        "refund_fee_amount": null,
                        "created": "2020-08-30T09:12:33.001Z",
                        "updated": "2020-08-30T09:12:33.001Z",
                        "metadata": null
                      }
                    }
                  }
                },
                "refundFailed": {
                  "value": {
                    "event": "refund.failed",
                    "business_id": "6094fa76c2fd53701b8e079c",
                    "created": "2021-12-02T14:52:21.566Z",
                    "data": {
                      "event": "refund.failed",
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "created": "2020-08-29T09:12:33.001Z",
                      "data": {
                        "id": "rfd-fca8d8bc-497c-42a5-b16f-97825323502a",
                        "payment_id": "ddpy-3cd658ae-25b9-4659-aa36-596ae41a809f",
                        "invoice_id": null,
                        "amount": "10000",
                        "payment_method_type": "DIRECT_DEBIT",
                        "channel_code": "BPI",
                        "currency": "PHP",
                        "status": "FAILED",
                        "reason": "CANCELLATION",
                        "reference_id": "b2756a1e-e6cd-4352-9a68-0483aa2b6a2",
                        "failure_code": "DUPLICATE_ERROR",
                        "refund_fee_amount": null,
                        "created": "2020-08-30T09:12:33.001Z",
                        "updated": "2020-08-30T09:12:33.001Z",
                        "metadata": null
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "parameters": {
      "Payments_API_XCallbackToken": {
        "in": "header",
        "name": "x-callback-token",
        "required": "false",
        "schema": {
          "type": "string"
        },
        "description": "Your Xendit unique webhook token to verify the origin of the webhook. It is highly recommended for your integration to verify this value."
      }
    },
    "schemas": {
      "Payments_API_BusinessId": {
        "type": "string",
        "description": "Xendit-generated identifier for the business that owns the transaction",
        "example": "5f27a14a9bf05c73dd040bc8"
      },
      "Payments_API_RefundSchema": {
        "type": "object",
        "description": "Refund object",
        "properties": {
          "id": {
            "$ref": "#/components/schemas/Payments_API_RefundId"
          },
          "payment_request_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestId"
          },
          "payment_id": {
            "$ref": "#/components/schemas/Payments_API_RefundPaymentId"
          },
          "invoice_id": {
            "$ref": "#/components/schemas/Payments_API_RefundInvoiceId"
          },
          "payment_method_type": {
            "$ref": "#/components/schemas/Payments_API_RefundPaymentMethodType"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_ReferenceId"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCode"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "amount": {
            "$ref": "#/components/schemas/Payments_API_RefundAmount"
          },
          "status": {
            "$ref": "#/components/schemas/Payments_API_RefundStatus"
          },
          "reason": {
            "$ref": "#/components/schemas/Payments_API_Reason"
          },
          "failure_code": {
            "$ref": "#/components/schemas/Payments_API_RefundFailureCode"
          },
          "refund_fee_amount": {
            "$ref": "#/components/schemas/Payments_API_RefundFeeAmount"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          },
          "created": {
            "$ref": "#/components/schemas/Payments_API_CreatedDateTime"
          },
          "updated": {
            "$ref": "#/components/schemas/Payments_API_UpdatedDateTime"
          }
        }
      },
      "Payments_API_RefundId": {
        "type": "string",
        "description": "Xendit unique Refund ID generated as reference after creation of refund.",
        "example": "rfd-69e77490-d2cc-4bf3-8319-e064e121db93"
      },
      "Payments_API_PaymentRequestId": {
        "type": "string",
        "description": "Xendit unique Payment Request ID generated as reference after creation of payment request.",
        "example": "pr-1102feb0-bb79-47ae-9d1e-e69394d3949c"
      },
      "Payments_API_RefundPaymentId": {
        "type": "string",
        "description": "To be deprecated. Xendit unique Payment ID generated as reference for a payment.",
        "example": "py-1402feb0-bb79-47ae-9d1e-e69394d3949c"
      },
      "Payments_API_RefundInvoiceId": {
        "type": "string",
        "description": "To be deprecated. Xendit unique Invoice ID generated as reference after creation of an invoice or payment link.",
        "example": "65fc7522ff846905c2fc1c8d"
      },
      "Payments_API_RefundPaymentMethodType": {
        "type": "string",
        "enum": [
          "CARD",
          "EWALLET",
          "DIRECT_DEBIT"
        ],
        "description": "To be deprecated. Type of the payment method used in the original payment.'"
      },
      "Payments_API_ReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A Reference ID from merchants to identify their request."
      },
      "Payments_API_ChannelCode": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?iframe_id=channel-code-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_Currency": {
        "type": "string",
        "enum": [
          "IDR",
          "PHP",
          "VND",
          "THB",
          "SGD",
          "MYR",
          "USD",
          "HKD",
          "AUD",
          "GBP",
          "EUR",
          "JPY",
          "MXN"
        ],
        "description": "ISO 4217 three-letter currency code for the payment.",
        "example": "IDR"
      },
      "Payments_API_RefundAmount": {
        "type": "number",
        "minimum": "0",
        "description": "The intended payment amount to be refunded to the end user.\n",
        "example": "10000"
      },
      "Payments_API_RefundStatus": {
        "type": "string",
        "enum": [
          "SUCCEEDED",
          "FAILED",
          "PENDING",
          "CANCELLED"
        ],
        "description": "Status of the refund."
      },
      "Payments_API_Reason": {
        "type": "string",
        "enum": [
          "FRAUDULENT",
          "DUPLICATE",
          "REQUESTED_BY_CUSTOMER",
          "CANCELLATION",
          "OTHERS"
        ],
        "description": "Status of the refund."
      },
      "Payments_API_RefundFailureCode": {
        "type": "string",
        "enum": [
          "ACCOUNT_ACCESS_BLOCKED",
          "ACCOUNT_NOT_FOUND",
          "DUPLICATE_ERROR",
          "INSUFFICIENT_BALANCE",
          "REFUND_FAILED"
        ],
        "description": "Reasons of the refund failure."
      },
      "Payments_API_RefundFeeAmount": {
        "type": "number",
        "description": "Fee for processing the refund"
      },
      "Payments_API_MerchantMetadata": {
        "type": "object",
        "description": "Key-value entries for your custom data.\nYou can specify up to 50 keys, with key names up to 40 characters and values up to 500 characters.\nThis is for your convenience. Xendit will not use this data for any processing.\n",
        "example": {
          "my_custom_id": "merchant-123",
          "my_custom_order_id": "order-123"
        }
      },
      "Payments_API_CreatedDateTime": {
        "type": "string",
        "format": "date-time",
        "description": "ISO 8601 date-time format.\n",
        "example": "2021-12-31T23:59:59Z"
      },
      "Payments_API_UpdatedDateTime": {
        "type": "string",
        "format": "date-time",
        "description": "ISO 8601 date-time format.\n",
        "example": "2021-12-31T23:59:59Z"
      }
    }
  }
}
````

