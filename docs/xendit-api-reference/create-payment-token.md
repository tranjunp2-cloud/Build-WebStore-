> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create a new payment token

> Create payment token. Saves end user payment method for future transactions.


## OpenAPI

````json POST /v3/payment_tokens
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
    "/v3/payment_tokens": {
      "post": {
        "security": [
          {
            "Payments_API_BasicAuth": []
          }
        ],
        "operationId": "CreatePaymentToken",
        "summary": "Create a new payment token",
        "description": "Create payment token. Saves end user payment method for future transactions.\n",
        "tags": [
          "Payment Token"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payments_API_APIVersionHeaderExternal"
          },
          {
            "$ref": "#/components/parameters/Payments_API_ForUserIdHeaderParam"
          }
        ],
        "requestBody": {
          "required": "true",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Payments_API_CreatePaymentToken"
              },
              "examples": {
                "Create_Payment_Token_Cards": {
                  "value": {
                    "reference_id": "tokenize_card_user456",
                    "customer": {
                      "reference_id": "customer_456",
                      "type": "INDIVIDUAL",
                      "individual_detail": {
                        "given_names": "Jane",
                        "surname": "Doe"
                      },
                      "email": "jane.doe@example.com",
                      "mobile_number": "+6212345678903"
                    },
                    "country": "ID",
                    "currency": "IDR",
                    "channel_code": "CARDS",
                    "channel_properties": {
                      "card_details": {
                        "cvn": "321",
                        "card_number": "5200000000001005",
                        "expiry_year": "2028",
                        "expiry_month": "09",
                        "cardholder_first_name": "Jane",
                        "cardholder_last_name": "Doe",
                        "cardholder_email": "jane.doe@example.com",
                        "cardholder_phone_number": "+6212345678903"
                      },
                      "skip_three_ds": "false",
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Save card for future payments",
                    "metadata": {
                      "customer_id": "CUST456",
                      "card_usage": "subscription"
                    }
                  }
                },
                "Create_Payment_Token_Ewallet": {
                  "value": {
                    "reference_id": "tokenize_ovo_user789",
                    "country": "ID",
                    "currency": "IDR",
                    "channel_code": "OVO",
                    "channel_properties": {
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "customer_id": "cust-b98d6f63-d240-44ec-9bd5-aa42954c4f48",
                    "description": "Save OVO account for future payments",
                    "metadata": {
                      "customer_id": "CUST789",
                      "wallet_usage": "recurring"
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Payment Token Initiated",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Payments_API_PaymentTokenSchema"
                },
                "examples": {
                  "Create_Payment_Token_Ewallet": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "tokenize_ovo_user789",
                      "payment_token_id": "pt-90392f42-d98a-49ef-a7f3-abcezas123",
                      "customer_id": "cust-b98d6f63-d240-44ec-9bd5-aa42954c4f48",
                      "country": "ID",
                      "currency": "IDR",
                      "channel_code": "OVO",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "descriptor": "WEB_URL",
                          "value": "https://redirect.partner.com/authentication/ovo?token=ciqv4nkabidq0em86ofg"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "token_details": {
                        "account_name": "John Doe",
                        "account_balance": "1000001",
                        "account_point_balance": "50000"
                      },
                      "description": "Save OVO account for future payments",
                      "metadata": {
                        "customer_id": "CUST789",
                        "wallet_usage": "recurring"
                      },
                      "created": "2021-12-31T23:59:59Z",
                      "updated": "2021-12-31T23:59:59Z"
                    }
                  },
                  "Create_Payment_Token_Cards": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "tokenize_card_user456",
                      "payment_token_id": "pt-1402feb0-bb79-47ae-9d1e-e69394d3949c",
                      "customer_id": "cust-b98d6f63-d240-44ec-9bd5-aa42954c4f48",
                      "country": "ID",
                      "currency": "IDR",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "card_details": {
                          "type": "CREDIT",
                          "issuer": "PT BANK MANDIRI",
                          "country": "ID",
                          "network": "VISA",
                          "fingerprint": "61f632879e9e27001a8165b9",
                          "masked_card_number": "5200****1005",
                          "expiry_year": "2028",
                          "expiry_month": "09",
                          "cardholder_first_name": "Jane",
                          "cardholder_last_name": "Doe",
                          "cardholder_email": "jane.doe@example.com",
                          "cardholder_phone_number": "+6212345678903"
                        },
                        "skip_three_ds": "false",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "descriptor": "WEB_URL",
                          "value": "https://redirect.xendit.co/authentication/3ds?token=card_auth_token_xyz"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "token_details": {
                        "authentication_data": {
                          "flow": "FULL_AUTH",
                          "a_res": {
                            "eci": "05",
                            "message_version": "02",
                            "authentication_value": "AUTHVAR",
                            "ds_trans_id": "sample_trans_id"
                          }
                        },
                        "authorization_data": {
                          "authorization_code": "A1B2C3",
                          "cvn_verification_result": "M",
                          "address_verification_result": "M"
                        }
                      },
                      "description": "Save card for future payments",
                      "metadata": {
                        "customer_id": "CUST456",
                        "card_usage": "subscription"
                      },
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
                      "$ref": "#/components/schemas/Payments_API_Http400InvalidValueError"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400ApiValidationError"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400CardExpired"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400InvalidPaymentDetails"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http400InvalidToken"
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
                      "$ref": "#/components/schemas/Payments_API_Http403AccountAccessBlocked"
                    }
                  ]
                }
              }
            }
          },
          "409": {
            "description": "Conflict",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/Payments_API_Http409DuplicateError"
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http409AccountAlreadyLinked"
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
                    },
                    {
                      "$ref": "#/components/schemas/Payments_API_Http503IssuerUnavailable"
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
      "Payments_API_CreatePaymentToken": {
        "type": "object",
        "description": "Create payment token API request body",
        "required": [
          "reference_id",
          "country",
          "currency",
          "channel_code",
          "channel_properties"
        ],
        "properties": {
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_ReferenceId"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCodeSave"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelPropertiesWidgetSave"
          },
          "customer_id": {
            "$ref": "#/components/schemas/Payments_API_CustomerId"
          },
          "customer": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardCustomer"
          },
          "description": {
            "$ref": "#/components/schemas/Payments_API_Description"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          }
        }
      },
      "Payments_API_PaymentTokenSchema": {
        "type": "object",
        "description": "Payment Token object",
        "properties": {
          "payment_token_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentTokenId"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCode"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "business_id": {
            "$ref": "#/components/schemas/Payments_API_BusinessId"
          },
          "customer_id": {
            "$ref": "#/components/schemas/Payments_API_CustomerId"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_ReferenceId"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelProperties"
          },
          "actions": {
            "$ref": "#/components/schemas/Payments_API_ArrayOfActions"
          },
          "status": {
            "$ref": "#/components/schemas/Payments_API_PaymentTokenStatus"
          },
          "token_details": {
            "$ref": "#/components/schemas/Payments_API_TokenDetails"
          },
          "failure_code": {
            "$ref": "#/components/schemas/Payments_API_PaymentTokenFailureCodes"
          },
          "description": {
            "$ref": "#/components/schemas/Payments_API_Description"
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
      "Payments_API_Http400CardExpired": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "CARD_EXPIRED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Card expiry specified in the request should not be earlier than current month."
          }
        }
      },
      "Payments_API_Http400InvalidPaymentDetails": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "INVALID_PAYMENT_DETAILS"
            ]
          },
          "message": {
            "type": "string",
            "description": "The payment details entered by the end user is invalid. Check the specific error message for debugging."
          }
        }
      },
      "Payments_API_Http400InvalidToken": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "INVALID_TOKEN"
            ]
          },
          "message": {
            "type": "string",
            "description": "Payment token ID specified in the payment request has expired or has been cancelled. Please reinitiate linking before retrying."
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
      "Payments_API_Http403AccountAccessBlocked": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "ACCOUNT_ACCESS_BLOCKED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Payment token ID specified in the request was denied access by the payment method provider."
          }
        }
      },
      "Payments_API_Http409DuplicateError": {
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
            "description": "Duplication is not allowed. Check specific error message for debugging."
          }
        }
      },
      "Payments_API_Http409AccountAlreadyLinked": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "ACCOUNT_ALREADY_LINKED"
            ]
          },
          "message": {
            "type": "string",
            "description": "The end user has already linked their account previously."
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
      "Payments_API_Http503IssuerUnavailable": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "ISSUER_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "description": "The end user's payment method provider is currently experiencing unexpected issues. The provider will be notified to resolve this issue."
          }
        }
      },
      "Payments_API_ReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A Reference ID from merchants to identify their request."
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
      "Payments_API_ChannelCodeSave": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?type=save&iframe_id=save-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_ChannelPropertiesWidgetSave": {
        "type": "object",
        "description": "Data required to initiate transaction with payment method provider. Refer to the Channel Data Finder widget in the channel_code field above for the full list of required properties for each channel.\n"
      },
      "Payments_API_CustomerId": {
        "type": "string",
        "maxLength": "41",
        "description": "Xendit unique Capture ID generated as reference for the end user",
        "example": "cust-b98d6f63-d240-44ec-9bd5-aa42954c4f48"
      },
      "Payments_API_XenditStandardCustomer": {
        "type": "object",
        "required": [
          "type",
          "reference_id",
          "individual_detail"
        ],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "INDIVIDUAL"
            ],
            "description": "Type of customer"
          },
          "reference_id": {
            "type": "string",
            "description": "Merchant provided identifier for the customer. Must be unique. Alphanumeric no special characters allowed",
            "minLength": "1",
            "maxLength": "255"
          },
          "email": {
            "type": "string",
            "description": "E-mail address of customer. Maximum length 50 characters",
            "format": "email",
            "minLength": "4",
            "maxLength": "50"
          },
          "mobile_number": {
            "type": "string",
            "description": "Mobile number of customer in E.164 format +(country code)(subscriber number)",
            "minLength": "1",
            "maxLength": "50"
          },
          "individual_detail": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardIndividualDetail"
          }
        }
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
      "Payments_API_PaymentTokenId": {
        "type": "string",
        "description": "Xendit unique Payment Token ID generated as reference for reusable payment details of the end user.",
        "example": "pt-cc3938dc-c2a5-43c4-89d7-7570793348c2"
      },
      "Payments_API_ChannelCode": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?iframe_id=channel-code-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_BusinessId": {
        "type": "string",
        "description": "Xendit-generated identifier for the business that owns the transaction",
        "example": "5f27a14a9bf05c73dd040bc8"
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
      "Payments_API_PaymentTokenStatus": {
        "type": "string",
        "enum": [
          "REQUIRES_ACTION",
          "PENDING",
          "ACTIVE",
          "FAILED",
          "EXPIRED",
          "CANCELED"
        ],
        "description": "Status of the payment token.",
        "example": "ACTIVE"
      },
      "Payments_API_TokenDetails": {
        "type": "object",
        "description": "Account information provided by the payment method provider. Fields returned are dependent on what is made available by the provider.\n<iframe src=\"https://doc-widget.xendit.co/channel-details/token?type=pay-with-token,pay-and-save,save&iframe_id=channel-token-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n",
        "properties": {
          "authorization_data": {
            "$ref": "#/components/schemas/Payments_API_AuthorizationData"
          },
          "authentication_data": {
            "$ref": "#/components/schemas/Payments_API_AuthenticationData"
          },
          "account_name": {
            "type": "string",
            "description": "Name of the owner of the account bound to the token.\n"
          },
          "account_balance": {
            "type": "string",
            "description": "Balance of the account bound to the token.\n"
          },
          "account_point_balance": {
            "type": "string",
            "description": "Point balance of the account bound to the token.\n"
          },
          "account_number": {
            "type": "string",
            "description": "Account number bound to the token.\n"
          }
        }
      },
      "Payments_API_PaymentTokenFailureCodes": {
        "type": "string",
        "enum": [
          "ACCOUNT_ALREADY_LINKED",
          "INVALID_ACCOUNT_DETAILS",
          "AUTHENTICATION_FAILED",
          "CARD_DECLINED",
          "CAPTURE_AMOUNT_EXCEEDED ",
          "INSUFFICIENT_BALANCE",
          "ISSUER_UNAVAILABLE",
          "CHANNEL_UNAVAILABLE",
          "INVALID_MERCHANT_SETTINGS"
        ],
        "description": "Failure codes for payment tokens.",
        "example": "AUTHENTICATION_FAILED"
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
      "Payments_API_XenditStandardIndividualDetail": {
        "type": "object",
        "required": [
          "given_names"
        ],
        "properties": {
          "given_names": {
            "type": "string",
            "description": "Primary or first name/s of customer. Alphanumeric. No special characters is allowed.",
            "minLength": "1",
            "maxLength": "50"
          },
          "surname": {
            "type": "string",
            "description": "Last or family name of customer. Alphanumeric. No special characters is allowed.",
            "minLength": "1",
            "maxLength": "50"
          },
          "nationality": {
            "type": "string",
            "description": "Country code for customer nationality. ISO 3166-1 alpha-2 Country Code",
            "minLength": "2",
            "maxLength": "2"
          },
          "place_of_birth": {
            "type": "string",
            "description": "City or other relevant location for the customer birth place. Alphanumeric. No special characters is allowed.",
            "minLength": "1",
            "maxLength": "60"
          },
          "date_of_birth": {
            "type": "string",
            "description": "Date of birth of the customer. Format: YYYY-MM-DD",
            "minLength": "10",
            "maxLength": "10"
          },
          "gender": {
            "enum": [
              "MALE",
              "FEMALE",
              "OTHER"
            ],
            "description": "Gender of customer"
          }
        }
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
      }
    }
  }
}
````

