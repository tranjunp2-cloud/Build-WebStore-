> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get the status of a payment request

> Get payment request status


## OpenAPI

````json GET /v3/payment_requests/{payment_request_id}
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
    "/v3/payment_requests/{payment_request_id}": {
      "get": {
        "security": [
          {
            "Payments_API_BasicAuth": []
          }
        ],
        "operationId": "GetPaymentRequest",
        "summary": "Get the status of a payment request",
        "description": "Get payment request status\n",
        "tags": [
          "Payment Request"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payments_API_APIVersionHeaderExternal"
          },
          {
            "$ref": "#/components/parameters/Payments_API_PaymentRequestIdPathParam"
          }
        ],
        "responses": {
          "200": {
            "description": "Fetch Payment Request Status",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Payments_API_PaymentRequestSchema"
                },
                "examples": {
                  "getPaymentResponseCards": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
                      "customer_id": "cust-90392f42-d98a-49ef-a7f3-abcezas123",
                      "type": "PAY_AND_SAVE",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "10000.01",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "mid_label": "CTV_TEST",
                        "card_details": {
                          "masked_card_number": "2222XXXXXXXX8888",
                          "expiry_year": "2027",
                          "expiry_month": "12",
                          "cardholder_first_name": "John",
                          "cardholder_last_name": "Doe",
                          "cardholder_email": "john.doe@example.com",
                          "cardholder_phone_number": "+6212345678902"
                        },
                        "skip_three_ds": "false",
                        "card_on_file_type": "CUSTOMER_UNSCHEDULED",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success",
                        "billing_information": {
                          "first_name": "John",
                          "last_name": "Doe",
                          "email": "john.doe@example.com",
                          "phone_number": "+6212345678904",
                          "city": "Singapore",
                          "country": "SG",
                          "postal_code": "644228",
                          "street_line1": "Merlion Bay Sands Suites",
                          "street_line2": "21-37",
                          "province_state": "Singapore"
                        },
                        "statement_descriptor": "Goods & Services",
                        "recurring_configuration": {
                          "recurring_expiry": "2025-12-31",
                          "recurring_frequency": "30"
                        }
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "value": "https://xendit.co/success",
                          "descriptor": "WEB_URL"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Payment for invoice #INV-2025-001",
                      "metadata": {
                        "invoice_id": "INV-2025-001",
                        "customer_type": "business"
                      },
                      "shipping_information": {
                        "city": "Singapore",
                        "country": "SG",
                        "postal_code": "644228",
                        "street_line1": "Merlion Bay Sands Suites",
                        "street_line2": "21-37",
                        "province_state": "Singapore"
                      },
                      "items": [
                        {
                          "reference_id": "item-123",
                          "type": "PHYSICAL_PRODUCT",
                          "name": "Vyson Dacuum Cleaner",
                          "net_unit_amount": "10000.01",
                          "quantity": "1",
                          "category": "HOME_APPLIANCES"
                        }
                      ],
                      "created": "2021-12-31T23:59:59Z",
                      "updated": "2021-12-31T23:59:59Z"
                    }
                  },
                  "getPaymentResponseRedirect": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
                      "customer_id": "cust-90392f42-d98a-49ef-a7f3-abcezas123",
                      "type": "PAY",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "10000.01",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "DANA",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "value": "https://xendit.co/success",
                          "descriptor": "WEB_URL"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Payment for invoice #INV-2025-001",
                      "metadata": {
                        "invoice_id": "INV-2025-001",
                        "customer_type": "business"
                      },
                      "shipping_information": {
                        "city": "Singapore",
                        "country": "SG",
                        "postal_code": "644228",
                        "street_line1": "Merlion Bay Sands Suites",
                        "street_line2": "21-37",
                        "province_state": "Singapore"
                      },
                      "items": [
                        {
                          "reference_id": "item-123",
                          "type": "PHYSICAL_PRODUCT",
                          "name": "Vyson Dacuum Cleaner",
                          "net_unit_amount": "10000.01",
                          "quantity": "1",
                          "category": "HOME_APPLIANCES"
                        }
                      ],
                      "created": "2021-12-31T23:59:59Z",
                      "updated": "2021-12-31T23:59:59Z"
                    }
                  },
                  "getPaymentResponsePresentToCustomer": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
                      "customer_id": "cust-90392f42-d98a-49ef-a7f3-abcezas123",
                      "type": "REUSABLE_PAYMENT_CODE",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "10000.01",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "BRI_VIRTUAL_ACCOUNT",
                      "channel_properties": {
                        "expires_at": "2024-12-31T23:59:59Z"
                      },
                      "actions": [
                        {
                          "type": "PRESENT_TO_CUSTOMER",
                          "descriptor": "VIRTUAL_ACCOUNT_NUMBER",
                          "value": "1251255"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Payment for invoice #INV-2025-001",
                      "metadata": {
                        "invoice_id": "INV-2025-001",
                        "customer_type": "business"
                      },
                      "shipping_information": {
                        "city": "Singapore",
                        "country": "SG",
                        "postal_code": "644228",
                        "street_line1": "Merlion Bay Sands Suites",
                        "street_line2": "21-37",
                        "province_state": "Singapore"
                      },
                      "items": [
                        {
                          "reference_id": "item-123",
                          "type": "PHYSICAL_PRODUCT",
                          "name": "Vyson Dacuum Cleaner",
                          "net_unit_amount": "10000.01",
                          "quantity": "1",
                          "category": "HOME_APPLIANCES"
                        }
                      ],
                      "created": "2021-12-31T23:59:59Z",
                      "updated": "2021-12-31T23:59:59Z"
                    }
                  }
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
                      "$ref": "#/components/schemas/Payments_API_Http400ApiValidationError"
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
          }
        }
      }
    }
  },
  "components": {
    "parameters": {
      "Payments_API_APIVersionHeaderExternal": {
        "in": "header",
        "name": "api-version",
        "schema": {
          "example": "2024-11-11",
          "type": "string",
          "enum": [
            "2024-11-11"
          ]
        }
      },
      "Payments_API_PaymentRequestIdPathParam": {
        "in": "path",
        "name": "payment_request_id",
        "required": "true",
        "schema": {
          "type": "string",
          "minLength": "39",
          "maxLength": "39"
        },
        "example": "pr-8877c08a-740d-4153-9816-3d744ed197a5"
      }
    },
    "schemas": {
      "Payments_API_PaymentRequestSchema": {
        "type": "object",
        "description": "Payment request object",
        "properties": {
          "business_id": {
            "$ref": "#/components/schemas/Payments_API_BusinessId"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestReferenceId"
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
          "latest_payment_id": {
            "$ref": "#/components/schemas/Payments_API_LatestPaymentId"
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
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelProperties"
          },
          "actions": {
            "$ref": "#/components/schemas/Payments_API_ArrayOfActions"
          },
          "status": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestStatus"
          },
          "failure_code": {
            "$ref": "#/components/schemas/Payments_API_PaymentFailureCodes"
          },
          "description": {
            "$ref": "#/components/schemas/Payments_API_Description"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          },
          "items": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardItemBasket"
          },
          "shipping_information": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardShippingInformation"
          },
          "created": {
            "$ref": "#/components/schemas/Payments_API_CreatedDateTime"
          },
          "updated": {
            "$ref": "#/components/schemas/Payments_API_UpdatedDateTime"
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
      "Payments_API_BusinessId": {
        "type": "string",
        "description": "Xendit-generated identifier for the business that owns the transaction",
        "example": "5f27a14a9bf05c73dd040bc8"
      },
      "Payments_API_PaymentRequestReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A reference ID from merchants to identify their request. For \"CARDS\" channel code, reference ID must be unique."
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
      "Payments_API_LatestPaymentId": {
        "type": "string",
        "description": "Latest Payment ID linked to the payment request.",
        "example": "py-1402feb0-bb79-47ae-9d1e-e69394d3949c"
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
      "Payments_API_ChannelProperties": {
        "type": "object",
        "description": "Data required to initiate transaction with payment method provider. Refer to the Channel Data Finder widget in the channel_code field above for the full list of required properties for each channel.\n"
      },
      "Payments_API_ArrayOfActions": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Payments_API_Actions"
        }
      },
      "Payments_API_PaymentRequestStatus": {
        "type": "string",
        "enum": [
          "ACCEPTING_PAYMENTS",
          "REQUIRES_ACTION",
          "AUTHORIZED",
          "CANCELED",
          "EXPIRED",
          "SUCCEEDED",
          "FAILED"
        ],
        "description": "Status of the payment request.",
        "example": "SUCCEEDED"
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
      "Payments_API_Description": {
        "type": "string",
        "minLength": "1",
        "maxLength": "1000",
        "description": "A custom description for the Payment Request.",
        "example": "Payment for your order #123"
      },
      "Payments_API_MerchantMetadata": {
        "type": "object",
        "description": "Key-value entries for your custom data.\nYou can specify up to 50 keys, with key names up to 40 characters and values up to 500 characters.\nThis is for your convenience. Xendit will not use this data for any processing.\n",
        "example": {
          "my_custom_id": "merchant-123",
          "my_custom_order_id": "order-123"
        }
      },
      "Payments_API_XenditStandardItemBasket": {
        "type": "array",
        "description": "Array of objects describing the item/s attached to the payment.\n",
        "items": {
          "$ref": "#/components/schemas/Payments_API_XenditStandardItem"
        }
      },
      "Payments_API_XenditStandardShippingInformation": {
        "type": "object",
        "required": [
          "country"
        ],
        "properties": {
          "country": {
            "enum": [
              "ID",
              "PH",
              "VN",
              "TH",
              "SG",
              "MY",
              "MX"
            ],
            "description": "2-letter ISO 3166-2 country code for the customer’s shipping country"
          },
          "street_line1": {
            "type": "string",
            "description": "Building name and apartment unit number",
            "minLength": "1",
            "maxLength": "255"
          },
          "street_line2": {
            "type": "string",
            "description": "Building street address",
            "minLength": "1",
            "maxLength": "255"
          },
          "city": {
            "type": "string",
            "description": "City, village or town as appropriate",
            "minLength": "1",
            "maxLength": "255"
          },
          "province_state": {
            "type": "string",
            "description": " Either one of (whichever is applicable): Geographic area, province, or region / Formal state designation within country",
            "minLength": "1",
            "maxLength": "255"
          },
          "postal_code": {
            "type": "string",
            "description": " Postal, zip or rural delivery code, if applicable",
            "minLength": "1",
            "maxLength": "255"
          }
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
      "Payments_API_Actions": {
        "description": "Actions object contains possible next steps merchants can take to proceed with payment collection from end user",
        "type": "object",
        "properties": {
          "type": {
            "enum": [
              "PRESENT_TO_CUSTOMER",
              "REDIRECT_CUSTOMER",
              "API_POST_REQUEST"
            ],
            "description": "The type of action that merchant system will need to handle to complete payment."
          },
          "descriptor": {
            "enum": [
              "CAPTURE_PAYMENT",
              "PAYMENT_CODE",
              "QR_STRING",
              "VIRTUAL_ACCOUNT_NUMBER",
              "WEB_URL",
              "DEEPLINK_URL",
              "VALIDATE_OTP",
              "RESEND_OTP"
            ],
            "description": "The type of action that merchant system will need to handle to complete payment."
          },
          "value": {
            "type": "string",
            "description": "The specific value that will be used by merchant to complete the action"
          }
        }
      },
      "Payments_API_XenditStandardItem": {
        "type": "object",
        "required": [
          "reference_id",
          "type",
          "name",
          "net_unit_amount",
          "quantity",
          "category"
        ],
        "properties": {
          "reference_id": {
            "type": "string",
            "description": "Merchant provided identifier for the item",
            "minLength": "1",
            "maxLength": "255"
          },
          "type": {
            "enum": [
              "DIGITAL_PRODUCT",
              "PHYSICAL_PRODUCT",
              "DIGITAL_SERVICE",
              "PHYSICAL_SERVICE",
              "FEE"
            ],
            "description": "Type of item"
          },
          "name": {
            "type": "string",
            "description": "Name of item",
            "minLength": "1",
            "maxLength": "255"
          },
          "net_unit_amount": {
            "type": "number",
            "description": "Net amount to be charged per unit"
          },
          "quantity": {
            "type": "integer",
            "description": "Number of units of this item in the basket",
            "minimum": "1"
          },
          "url": {
            "type": "string",
            "description": "URL of the item. Must be HTTPS or HTTP"
          },
          "image_url": {
            "type": "string",
            "description": "URL of the image of the item. Must be HTTPS or HTTP"
          },
          "category": {
            "type": "string",
            "description": "Category for item",
            "maxLength": "255"
          },
          "subcategory": {
            "type": "string",
            "description": "Sub-category for item",
            "maxLength": "255"
          },
          "description": {
            "type": "string",
            "description": "Description of item",
            "maxLength": "255"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          }
        }
      }
    }
  }
}
````

