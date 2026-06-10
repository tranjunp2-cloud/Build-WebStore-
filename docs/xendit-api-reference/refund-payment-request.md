> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Refund a payment request

> Initiate a refund for a given successful payment request.


## OpenAPI

````json POST /refunds
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
    "/refunds": {
      "post": {
        "security": [
          {
            "Payments_API_BasicAuth": []
          }
        ],
        "operationId": "Refund",
        "summary": "Refund a payment request",
        "description": "Initiate a refund for a given successful payment request.\n",
        "tags": [
          "Refund"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payments_API_ForUserIdHeaderParam"
          }
        ],
        "requestBody": {
          "required": "true",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Payments_API_Refund"
              },
              "examples": {
                "Refund_With_Amount": {
                  "value": {
                    "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
                    "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
                    "currency": "IDR",
                    "amount": "10000",
                    "reason": "REQUESTED_BY_CUSTOMER"
                  }
                },
                "Refund_Without_Amount": {
                  "value": {
                    "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
                    "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
                    "reason": "REQUESTED_BY_CUSTOMER"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Refund is pending. Check the final status of the refund via webhook.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Payments_API_RefundSchema"
                }
              }
            }
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400InvalidValueError"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400ApiValidationError"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400RefundAmountExceeded"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400TemporarilyUnavailable"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400RefundInProgress"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400IneligibleTransactionStatus"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400InsufficientBalance"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400PartialRefundCountsExceeded"
                    }
                  ]
                }
              }
            }
          },
          "403": {
            "description": "Forbidden",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/Payments_API_Http403Skip3dsForbidden"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http403InvalidMerchantSettings"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http403RefundNotSupported"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http403PartialRefundNotSupported"
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "description": "Not found",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/Payments_API_Http404DataNotFound"
                    }
                  ]
                }
              }
            }
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/Payments_API_Http500ServerError"
                    }
                  ]
                }
              }
            }
          },
          "503": {
            "description": "Service unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/Payments_API_Http503ChannelUnavailable"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "parameters": {
      "Payments_API_ForUserIdHeaderParam": {
        "in": "header",
        "name": "for-user-id",
        "required": "false",
        "schema": {
          "type": "string"
        },
        "description": "The XenPlatform subaccount user id that will perform this transaction."
      }
    },
    "schemas": {
      "Payments_API_Refund": {
        "type": "object",
        "description": "Create refund API request body",
        "required": [
          "payment_request_id",
          "reason"
        ],
        "properties": {
          "payment_request_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestId"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_ReferenceId"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "amount": {
            "$ref": "#/components/schemas/Payments_API_RefundAmount"
          },
          "reason": {
            "$ref": "#/components/schemas/Payments_API_Reason"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          }
        }
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
      "Payments_API_Http400InvalidValueError": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "INVALID_VALUE_ERROR"
            ]
          },
          "message": {
            "type": "string",
            "description": "Values in the payment request is not within expected range or expected configurations. Check the specific error message for debugging."
          }
        }
      },
      "Payments_API_Http400ApiValidationError": {
        "description": "Api Validation Error",
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "API_VALIDATION_ERROR"
            ]
          },
          "message": {
            "type": "string",
            "description": "Fields or values in the payment request does not comply with our API specification. Check the specific error message for debugging."
          }
        }
      },
      "Payments_API_Http400RefundAmountExceeded": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "REFUND_AMOUNT_EXCEEDED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Refund amount specified in refund request must be less than or equal to unrefunded capture amount."
          }
        }
      },
      "Payments_API_Http400TemporarilyUnavailable": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "TEMPORARILY_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "description": "Requested feature is unavailable during this timing."
          }
        }
      },
      "Payments_API_Http400RefundInProgress": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "REFUND_IN_PROGRESS"
            ]
          },
          "message": {
            "type": "string",
            "description": "Please wait for the pending refund request to be completed before initiating a new one."
          }
        }
      },
      "Payments_API_Http400IneligibleTransactionStatus": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "INELIGIBLE_TRANSACTION_STATUS"
            ]
          },
          "message": {
            "type": "string",
            "description": "Feature is not allowed for the payment request because of its current status. Check the specific error message for debugging."
          }
        }
      },
      "Payments_API_Http400InsufficientBalance": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "INSUFFICIENT_BALANCE"
            ]
          },
          "message": {
            "type": "string",
            "description": "There is insufficient balance in your account to perform a refund. Please top up your balance with a sufficient amount before retrying the refund."
          }
        }
      },
      "Payments_API_Http400PartialRefundCountsExceeded": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "PARTIAL_REFUND_COUNTS_EXCEEDED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Number of partial refunds for this payment request has exceeded what is allowed by payment channel. Please check our documentations for refund limitations."
          }
        }
      },
      "Payments_API_Http403Skip3dsForbidden": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "SKIP_3DS_FORBIDDEN"
            ]
          },
          "message": {
            "type": "string",
            "description": "Non 3DS payment request for cards is not allowed. Please activate the feature on Xendit dashboard before proceeding."
          }
        }
      },
      "Payments_API_Http403InvalidMerchantSettings": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "INVALID_MERCHANT_SETTINGS"
            ]
          },
          "message": {
            "type": "string",
            "description": "Merchant credentials met with an error with the provider. Please contact Xendit customer support to resolve this issue."
          }
        }
      },
      "Payments_API_Http403RefundNotSupported": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "REFUND_NOT_SUPPORTED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Refund feature is not available for this payment channel."
          }
        }
      },
      "Payments_API_Http403PartialRefundNotSupported": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "PARTIAL_REFUND_NOT_SUPPORTED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Partial Refund feature is not available for this payment channel."
          }
        }
      },
      "Payments_API_Http404DataNotFound": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "DATA_NOT_FOUND"
            ]
          },
          "message": {
            "type": "string",
            "description": "ID specified in request cannot be found."
          }
        }
      },
      "Payments_API_Http500ServerError": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "SERVER_ERROR"
            ]
          },
          "message": {
            "type": "string",
            "description": "An unexpected error occured, our team has been notified and will troubleshoot the issue"
          }
        }
      },
      "Payments_API_Http503ChannelUnavailable": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "CHANNEL_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "description": "The channel requested is currently experiencing unexpected issues. The provider will be notified to resolve this issue."
          }
        }
      },
      "Payments_API_PaymentRequestId": {
        "type": "string",
        "description": "Xendit unique Payment Request ID generated as reference after creation of payment request.",
        "example": "pr-1102feb0-bb79-47ae-9d1e-e69394d3949c"
      },
      "Payments_API_ReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A Reference ID from merchants to identify their request."
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
      "Payments_API_MerchantMetadata": {
        "type": "object",
        "description": "Key-value entries for your custom data.\nYou can specify up to 50 keys, with key names up to 40 characters and values up to 500 characters.\nThis is for your convenience. Xendit will not use this data for any processing.\n",
        "example": {
          "my_custom_id": "merchant-123",
          "my_custom_order_id": "order-123"
        }
      },
      "Payments_API_RefundId": {
        "type": "string",
        "description": "Xendit unique Refund ID generated as reference after creation of refund.",
        "example": "rfd-69e77490-d2cc-4bf3-8319-e064e121db93"
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
      "Payments_API_ChannelCode": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?iframe_id=channel-code-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
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

