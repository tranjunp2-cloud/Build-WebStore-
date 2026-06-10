> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Payment webhook notification

> Webhook notification that will be sent to your defined webhook url for updates to payment status.


## OpenAPI

````json POST /your_payment_webhook_url
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
    "/your_payment_webhook_url": {
      "post": {
        "operationId": "PaymentWebhook",
        "summary": "Payment webhook notification",
        "description": "Webhook notification that will be sent to your defined webhook url for updates to payment status.\n",
        "parameters": [
          {
            "$ref": "#/components/parameters/Payments_API_XCallbackToken"
          }
        ],
        "tags": [
          "Payment Request"
        ],
        "requestBody": {
          "description": "Payment capture status callback",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "description": "Payment capture status callback for payment ",
                "properties": {
                  "event": {
                    "type": "string",
                    "enum": [
                      "payment.capture",
                      "payment.authorization",
                      "payment.failure"
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
                    "$ref": "#/components/schemas/Payments_API_PaymentSchema"
                  }
                }
              },
              "example": {
                "paymentCapture": {
                  "value": {
                    "event": "payment.capture",
                    "business_id": "6094fa76c2fd53701b8e079c",
                    "created": "2021-12-02T14:52:21.566Z",
                    "data": {
                      "payment_id": "py-1fdaf346-dd2e-4b6c-b938-124c7167a822",
                      "business_id": "6094fa76c2fd53701b8e079c",
                      "status": "SUCCEEDED",
                      "payment_request_id": "pr-1fdaf346-dd2e-4b6c-b938-124c7167a822",
                      "request_amount": "10000",
                      "customer_id": "cust-5ed61c4e-499f-49bd-9d90-f3f45028a7a3",
                      "channel_code": "BRI_VIRTUAL_ACCOUNT",
                      "country": "ID",
                      "currency": "IDR",
                      "reference_id": "example_reference_id",
                      "description": "Payment description",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "type": "SINGLE_PAYMENT",
                      "created": "2021-12-02T14:52:21.566Z",
                      "updated": "2021-12-02T14:52:21.566Z"
                    }
                  }
                },
                "paymentAuthorization": {
                  "value": {
                    "event": "payment.authorization",
                    "business_id": "6094fa76c2fd53701b8e079c",
                    "created": "2021-12-02T14:52:21.566Z",
                    "data": {
                      "payment_id": "py-1fdaf346-dd2e-4b6c-b938-124c7167a822",
                      "business_id": "6094fa76c2fd53701b8e079c",
                      "status": "AUTHORIZED",
                      "payment_request_id": "pr-1fdaf346-dd2e-4b6c-b938-124c7167a822",
                      "request_amount": "10000",
                      "customer_id": "cust-5ed61c4e-499f-49bd-9d90-f3f45028a7a3",
                      "channel_code": "CARDS",
                      "country": "PH",
                      "currency": "PHP",
                      "reference_id": "example_reference_id",
                      "description": "Payment description",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "type": "SINGLE_PAYMENT",
                      "created": "2021-12-02T14:52:21.566Z",
                      "updated": "2021-12-02T14:52:21.566Z"
                    }
                  }
                },
                "paymentFailure": {
                  "value": {
                    "event": "payment.failure",
                    "business_id": "6094fa76c2fd53701b8e079c",
                    "created": "2021-12-02T14:52:21.566Z",
                    "data": {
                      "payment_id": "py-1fdaf346-dd2e-4b6c-b938-124c7167a822",
                      "business_id": "6094fa76c2fd53701b8e079c",
                      "status": "FAILED",
                      "payment_request_id": "pr-1fdaf346-dd2e-4b6c-b938-124c7167a822",
                      "request_amount": "10000",
                      "customer_id": "cust-5ed61c4e-499f-49bd-9d90-f3f45028a7a3",
                      "channel_code": "CARDS",
                      "country": "TH",
                      "currency": "THB",
                      "reference_id": "example_reference_id",
                      "description": "Payment description",
                      "failure_code": "INSUFFICIENT_BALANCE",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "type": "SINGLE_PAYMENT",
                      "created": "2021-12-02T14:52:21.566Z",
                      "updated": "2021-12-02T14:52:21.566Z"
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
      "Payments_API_PaymentSchema": {
        "type": "object",
        "description": "Payment object",
        "properties": {
          "payment_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentId"
          },
          "business_id": {
            "$ref": "#/components/schemas/Payments_API_BusinessId"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_ReferenceId"
          },
          "payment_request_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestId"
          },
          "payment_token_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentTokenId"
          },
          "customer_id": {
            "$ref": "#/components/schemas/Payments_API_CustomerId"
          },
          "type": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestType"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "request_amount": {
            "$ref": "#/components/schemas/Payments_API_RequestAmount"
          },
          "capture_method": {
            "$ref": "#/components/schemas/Payments_API_CaptureMethod"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCode"
          },
          "captures": {
            "$ref": "#/components/schemas/Payments_API_ArrayOfCaptures"
          },
          "status": {
            "$ref": "#/components/schemas/Payments_API_PaymentStatus"
          },
          "payment_details": {
            "$ref": "#/components/schemas/Payments_API_PaymentDetails"
          },
          "failure_code": {
            "$ref": "#/components/schemas/Payments_API_PaymentFailureCodes"
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
      "Payments_API_PaymentId": {
        "type": "string",
        "description": "Xendit unique Payment ID generated as reference for a payment.",
        "example": "py-1402feb0-bb79-47ae-9d1e-e69394d3949c"
      },
      "Payments_API_ReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A Reference ID from merchants to identify their request."
      },
      "Payments_API_PaymentRequestId": {
        "type": "string",
        "description": "Xendit unique Payment Request ID generated as reference after creation of payment request.",
        "example": "pr-1102feb0-bb79-47ae-9d1e-e69394d3949c"
      },
      "Payments_API_PaymentTokenId": {
        "type": "string",
        "description": "Xendit unique Payment Token ID generated as reference for reusable payment details of the end user.",
        "example": "pt-cc3938dc-c2a5-43c4-89d7-7570793348c2"
      },
      "Payments_API_CustomerId": {
        "type": "string",
        "maxLength": "41",
        "description": "Xendit unique Capture ID generated as reference for the end user",
        "example": "cust-b98d6f63-d240-44ec-9bd5-aa42954c4f48"
      },
      "Payments_API_PaymentRequestType": {
        "type": "string",
        "enum": [
          "PAY",
          "PAY_AND_SAVE",
          "REUSABLE_PAYMENT_CODE"
        ],
        "description": "The payment collection intent type for the payment request.\n\nPAY: Create a payment request that is able to receive one payment.\n\nPAY_AND_SAVE: Create a payment request that is able to receive one payment. If the payment is successful, a reusable payment token will be returned for subsequent payment requests.\n\nREUSABLE_PAYMENT_CODE: Create a payment request that is able to receive multiple payments. This is only used for repeat use payment method like a static QR, a predefined OTC payment code or a predefined Virtual Account number.\n"
      },
      "Payments_API_Country": {
        "type": "string",
        "enum": [
          "ID",
          "PH",
          "VN",
          "TH",
          "SG",
          "MY",
          "HK",
          "MX"
        ],
        "description": "ISO 3166-1 alpha-2 two-letter country code for the country of transaction.",
        "example": "ID"
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
      "Payments_API_RequestAmount": {
        "type": "number",
        "minimum": "0",
        "description": "The intended payment amount to be collected from the end user.\n",
        "example": "10000"
      },
      "Payments_API_CaptureMethod": {
        "type": "string",
        "enum": [
          "AUTOMATIC",
          "MANUAL"
        ],
        "default": "AUTOMATIC",
        "description": "AUTOMATIC: payment capture will be processed immediately after payment request is created.\nMANUAL: payment capture requires merchant's trigger via payment capture endpoint before being processed\n",
        "example": "AUTOMATIC"
      },
      "Payments_API_ChannelCode": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?iframe_id=channel-code-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_ArrayOfCaptures": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Payments_API_Capture"
        }
      },
      "Payments_API_PaymentStatus": {
        "type": "string",
        "enum": [
          "AUTHORIZED",
          "CANCELED",
          "SUCCEEDED",
          "FAILED",
          "EXPIRED",
          "PENDING"
        ],
        "description": "Status of the payment.",
        "example": "SUCCEEDED"
      },
      "Payments_API_PaymentDetails": {
        "type": "object",
        "description": "Payment information provided by the payment method provider. Fields returned are dependent on what is made available by the provider.\n<iframe src=\"https://doc-widget.xendit.co/channel-details/payment?iframe_id=channel-payment-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n",
        "properties": {
          "authorization_data": {
            "$ref": "#/components/schemas/Payments_API_AuthorizationData"
          },
          "authentication_data": {
            "$ref": "#/components/schemas/Payments_API_AuthenticationData"
          },
          "issuer_name": {
            "type": "string",
            "description": "Name of the payment method provider used by the end user.\n"
          },
          "payer_account_number": {
            "type": "string",
            "description": "Account number of the end user making the payment from the payment method provider's records.\n"
          },
          "payer_name": {
            "type": "string",
            "description": "Name of the end user making the payment from the payment method provider's records.\n"
          },
          "receipt_id": {
            "type": "string",
            "description": "Receipt reference number communicated to the end user by their payment method provider for this specific payment. This a commonly used reference number for the end users to raise tickets.\n"
          },
          "remark": {
            "type": "string",
            "description": "Remarks about this specific payment from the payment method provider's records.\n"
          },
          "network": {
            "type": "string",
            "description": "Payment network which the payment was processed over.\n"
          },
          "fund_source": {
            "type": "string",
            "description": "Information about what was used by the end user to complete the payment. e.g. balance, installment, credit.\n"
          }
        }
      },
      "Payments_API_PaymentFailureCodes": {
        "type": "string",
        "enum": [
          "ACCOUNT_ACCESS_BLOCKED",
          "INVALID_MERCHANT_SETTINGS",
          "INVALID_ACCOUNT_DETAILS",
          "PAYMENT_ATTEMPT_COUNTS_EXCEEDED",
          "USER_DEVICE_UNREACHABLE",
          "CHANNEL_UNAVAILABLE",
          "INSUFFICIENT_BALANCE",
          "ACCOUNT_NOT_ACTIVATED",
          "INVALID_TOKEN",
          "SERVER_ERROR",
          "PARTNER_TIMEOUT_ERROR",
          "TIMEOUT_ERROR",
          "USER_DECLINED_PAYMENT",
          "USER_DID_NOT_AUTHORIZE",
          "PAYMENT_REQUEST_EXPIRED",
          "FAILURE_DETAILS_UNAVAILABLE",
          "EXPIRED_OTP",
          "INVALID_OTP",
          "PAYMENT_AMOUNT_LIMITS_EXCEEDED",
          "OTP_ATTEMPT_COUNTS_EXCEEDED",
          "CARD_DECLINED",
          "DECLINED_BY_ISSUER",
          "ISSUER_UNAVAILABLE",
          "INVALID_CVV",
          "DECLINED_BY_PROCESSOR",
          "CAPTURE_AMOUNT_EXCEEDED ",
          "AUTHENTICATION_FAILED",
          "PROCESSOR_ERROR",
          "EXPIRED_CARD",
          "STOLEN_CARD",
          "INACTIVE_OR_UNAUTHORIZED_CARD",
          "INVALID_MERCHANT_CREDENTIALS",
          "SUSPECTED_FRAUDULENT"
        ],
        "description": "Failure codes for payments.",
        "example": "CARD_DECLINED"
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
      },
      "Payments_API_Capture": {
        "description": "Capture object contains information about the capture that was performed",
        "type": "object",
        "properties": {
          "capture_timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 date-time format.\n",
            "example": "2021-12-31T23:59:59Z"
          },
          "capture_id": {
            "$ref": "#/components/schemas/Payments_API_CaptureId"
          },
          "capture_amount": {
            "$ref": "#/components/schemas/Payments_API_CaptureAmount"
          }
        }
      },
      "Payments_API_AuthorizationData": {
        "type": "object",
        "description": "Specific to cards transaction only. Details about the card authorization processing.\n",
        "properties": {
          "authorization_code": {
            "type": "string",
            "description": "Authorization approval code from the scheme. 6 alphanumeric characters."
          },
          "cvn_verification_result": {
            "type": "string",
            "enum": [
              "M",
              "N"
            ],
            "description": "Whether CVN input matches with the issuer's data."
          },
          "address_verification_result": {
            "type": "string",
            "enum": [
              "M",
              "N"
            ],
            "description": "Whether the end user's address input matches with the issuer's data."
          },
          "retrieval_reference_number": {
            "type": "string",
            "description": "Receipt reference number communicated to the end user by their card issuer for this specific payment. This a commonly used reference number for the end users to raise tickets."
          },
          "network_response_code": {
            "type": "string",
            "description": "The response code returned by the scheme (Visa, Mastercard, JCB, China Unionpay or Amex)."
          },
          "network_response_code_descriptor": {
            "type": "string",
            "description": "Description of the response code."
          },
          "network_transaction_id": {
            "type": "string",
            "description": "Transaction ID received from the card scheme. Only available for merchants on switcher model."
          },
          "acquirer_merchant_id": {
            "type": "string",
            "description": "Acquirer's record of the MID that was used to process this transaction. Only available for merchants on switcher model."
          },
          "reconciliation_id": {
            "type": "string",
            "description": "Acquirer's transaction record of the payment on their settlement statement. Only available for merchants on switcher model."
          }
        }
      },
      "Payments_API_AuthenticationData": {
        "type": "object",
        "description": "Specific to cards transaction only. Details about the card authentication.\n",
        "properties": {
          "flow": {
            "type": "string",
            "enum": [
              "FULL_AUTH",
              "FRICTIONLESS"
            ],
            "description": "Indicates the flow that was used for the 3DS authentication."
          },
          "a_res": {
            "type": "object",
            "description": "Details about the card authentication response from the 3DS server.\n",
            "properties": {
              "eci": {
                "type": "string",
                "description": "Payment system-specific value provided by the ACS or DS to indicate the results of the attempt to authenticate the Cardholder."
              },
              "message_version": {
                "type": "string",
                "description": "The 3DS protocol version which has been used to perform 3DS."
              },
              "authentication_value": {
                "type": "string",
                "description": "The result value from the 3DS transaction received from the ACS. This value is no longer present on responses after 45 days have passed after the authentication. Note that Mastercard and Visa use a different underlying format."
              },
              "ds_trans_id": {
                "type": "string",
                "description": "Universally unique transaction identifier assigned by the DS to identify a single transaction."
              }
            }
          }
        }
      },
      "Payments_API_CaptureId": {
        "type": "string",
        "description": "Xendit unique Capture ID generated as reference for a single capture.",
        "example": "cap-1502feb0-bb79-47ae-9d1e-e69394d3949c"
      },
      "Payments_API_CaptureAmount": {
        "type": "number",
        "minimum": "0",
        "description": "The payment amount captured for this payment. Maximum capture amount can only be equal or lesser than the authorized amount value.\n",
        "example": "10000"
      }
    }
  }
}
````

