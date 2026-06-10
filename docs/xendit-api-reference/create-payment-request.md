> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create a payment request

> Create payment request. Initiates payment collection from end user.


## OpenAPI

````json POST /v3/payment_requests
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
    "/v3/payment_requests": {
      "post": {
        "security": [
          {
            "Payments_API_BasicAuth": []
          }
        ],
        "operationId": "CreatePaymentRequest",
        "summary": "Create a payment request",
        "description": "Create payment request. Initiates payment collection from end user.\n",
        "tags": [
          "Payment Request"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payments_API_APIVersionHeaderExternal"
          },
          {
            "$ref": "#/components/parameters/Payments_API_ForUserIdHeaderParam"
          },
          {
            "$ref": "#/components/parameters/Payments_API_WithSplitRuleHeaderParam"
          }
        ],
        "requestBody": {
          "required": "true",
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "$ref": "#/components/schemas/Payments_API_Pay"
                  },
                  {
                    "$ref": "#/components/schemas/Payments_API_PayAndSave"
                  },
                  {
                    "$ref": "#/components/schemas/Payments_API_PayWithToken"
                  },
                  {
                    "$ref": "#/components/schemas/Payments_API_ReusablePaymentCode"
                  }
                ]
              },
              "examples": {
                "PAY_Cards_3DS_Auth": {
                  "value": {
                    "reference_id": "order_123456_3ds",
                    "type": "PAY",
                    "country": "ID",
                    "currency": "IDR",
                    "request_amount": "100000",
                    "capture_method": "AUTOMATIC",
                    "channel_code": "CARDS",
                    "channel_properties": {
                      "mid_label": "CTV_TEST",
                      "card_details": {
                        "cvn": "123",
                        "card_number": "4000000000001091",
                        "expiry_year": "2025",
                        "expiry_month": "12",
                        "cardholder_first_name": "John",
                        "cardholder_last_name": "Doe",
                        "cardholder_email": "john.doe@example.com",
                        "cardholder_phone_number": "+628123456789"
                      },
                      "skip_three_ds": "false",
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Payment for Order #123456",
                    "metadata": {
                      "order_id": "123456",
                      "customer_type": "premium"
                    }
                  }
                },
                "PAY_Cards_No_3DS": {
                  "value": {
                    "reference_id": "order_123457_no3ds",
                    "type": "PAY",
                    "country": "ID",
                    "currency": "IDR",
                    "request_amount": "50000",
                    "capture_method": "AUTOMATIC",
                    "channel_code": "CARDS",
                    "channel_properties": {
                      "mid_label": "CTV_TEST",
                      "card_details": {
                        "cvn": "456",
                        "card_number": "5200000000001096",
                        "expiry_year": "2026",
                        "expiry_month": "06",
                        "cardholder_first_name": "Jane",
                        "cardholder_last_name": "Doe",
                        "cardholder_email": "jane.doe@example.com",
                        "cardholder_phone_number": "+6312345678901"
                      },
                      "skip_three_ds": "true",
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Quick checkout for Order #123457",
                    "metadata": {
                      "order_id": "123457",
                      "checkout_type": "express"
                    }
                  }
                },
                "PAY_Cards_Manual_Capture": {
                  "value": {
                    "reference_id": "booking_123458",
                    "type": "PAY",
                    "country": "ID",
                    "currency": "IDR",
                    "request_amount": "250000",
                    "capture_method": "MANUAL",
                    "channel_code": "CARDS",
                    "channel_properties": {
                      "mid_label": "CTV_TEST",
                      "card_details": {
                        "cvn": "789",
                        "card_number": "4000000000000002",
                        "expiry_year": "2027",
                        "expiry_month": "03",
                        "cardholder_first_name": "John",
                        "cardholder_last_name": "Doe",
                        "cardholder_email": "john.doe@example.com",
                        "cardholder_phone_number": "+6212345678902"
                      },
                      "skip_three_ds": "false",
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Hotel booking pre-authorization #123458",
                    "metadata": {
                      "booking_id": "123458",
                      "booking_type": "hotel"
                    }
                  }
                },
                "PAY_AND_SAVE_Cards": {
                  "value": {
                    "reference_id": "order_123459_save",
                    "customer": {
                      "reference_id": "customer_789",
                      "type": "INDIVIDUAL",
                      "individual_detail": {
                        "given_names": "John",
                        "surname": "Doe"
                      },
                      "email": "john.doe@example.com",
                      "mobile_number": "+6212345678901"
                    },
                    "type": "PAY_AND_SAVE",
                    "country": "ID",
                    "currency": "IDR",
                    "request_amount": "500000",
                    "capture_method": "AUTOMATIC",
                    "channel_code": "CARDS",
                    "channel_properties": {
                      "mid_label": "CTV_TEST",
                      "card_details": {
                        "cvn": "654",
                        "card_number": "4000000000001109",
                        "expiry_year": "2026",
                        "expiry_month": "11",
                        "cardholder_first_name": "John",
                        "cardholder_last_name": "Doe",
                        "cardholder_email": "john.doe@example.com",
                        "cardholder_phone_number": "+6212345678901"
                      },
                      "skip_three_ds": "false",
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Initial subscription payment - Premium Plan",
                    "metadata": {
                      "order_id": "123459",
                      "subscription_plan": "premium_monthly"
                    }
                  }
                },
                "PAY_WithToken_Cards": {
                  "value": {
                    "reference_id": "recurring_payment_123460",
                    "payment_token_id": "pt-90392f42-d98a-49ef-a7f3-abcezas123",
                    "type": "PAY",
                    "country": "ID",
                    "currency": "IDR",
                    "request_amount": "500000",
                    "capture_method": "AUTOMATIC",
                    "channel_properties": {
                      "mid_label": "CTV_TEST",
                      "skip_three_ds": "true",
                      "card_on_file_type": "RECURRING",
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Monthly subscription - Month 2",
                    "metadata": {
                      "subscription_id": "sub_789",
                      "billing_cycle": "2"
                    }
                  }
                },
                "PAY_WithToken_TOUCHNGO": {
                  "value": {
                    "reference_id": "recurring_touchngo_123461",
                    "payment_token_id": "pt-tng-90392f42-d98a-49ef-a7f3",
                    "type": "PAY",
                    "country": "MY",
                    "currency": "MYR",
                    "request_amount": "150",
                    "capture_method": "AUTOMATIC",
                    "channel_properties": {
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Monthly toll payment - Touch n Go",
                    "metadata": {
                      "account_id": "tng_123461",
                      "payment_type": "toll_recurring"
                    }
                  }
                },
                "PAY_Ewallet_Shopeepay": {
                  "value": {
                    "reference_id": "order_ph_987654",
                    "type": "PAY",
                    "country": "PH",
                    "currency": "PHP",
                    "request_amount": "1250",
                    "capture_method": "AUTOMATIC",
                    "channel_code": "SHOPEEPAY",
                    "channel_properties": {
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Online purchase - Order #987654",
                    "metadata": {
                      "order_id": "987654",
                      "store_location": "manila_mall"
                    }
                  }
                },
                "PAY_QR_PromptPay": {
                  "value": {
                    "reference_id": "qr_th_321654",
                    "type": "PAY",
                    "country": "TH",
                    "currency": "THB",
                    "request_amount": "1500",
                    "capture_method": "AUTOMATIC",
                    "channel_code": "QRPROMPTPAY",
                    "channel_properties": {
                      "expires_at": "2025-01-15T23:59:59Z",
                      "qr_string_type": "DYNAMIC"
                    },
                    "description": "Restaurant bill - Table 15",
                    "metadata": {
                      "order_id": "321654",
                      "table_number": "15",
                      "branch": "bangkok_central",
                      "service_type": "dine_in"
                    }
                  }
                },
                "PAY_DirectDebit_BPI": {
                  "value": {
                    "reference_id": "dd_ph_456789_with_cust",
                    "type": "PAY",
                    "country": "PH",
                    "currency": "PHP",
                    "request_amount": "2500",
                    "capture_method": "AUTOMATIC",
                    "customer": {
                      "type": "INDIVIDUAL",
                      "reference_id": "customer_bpi_456789",
                      "individual_detail": {
                        "given_names": "Juan",
                        "surname": "Dela Cruz"
                      },
                      "email": "juan.delacruz@example.com",
                      "mobile_number": "+639123456789"
                    },
                    "channel_code": "BPI_DIRECT_DEBIT",
                    "channel_properties": {
                      "failure_return_url": "https://xendit.co/failure",
                      "success_return_url": "https://xendit.co/success"
                    },
                    "description": "Bill payment - Account #456789",
                    "metadata": {
                      "bill_id": "456789",
                      "customer_account": "ACC456789"
                    }
                  }
                },
                "REUSABLE_PAYMENT_CODE_VA_VietCapital": {
                  "value": {
                    "reference_id": "rpc_vn_123456",
                    "type": "REUSABLE_PAYMENT_CODE",
                    "country": "VN",
                    "currency": "VND",
                    "request_amount": "10000",
                    "channel_code": "VIETCAPITAL_VIRTUAL_ACCOUNT",
                    "channel_properties": {
                      "display_name": "xenCommerce Shop"
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Payment Request Created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Payments_API_PaymentRequestSchema"
                },
                "examples": {
                  "PAY_Cards_3DS_Auth": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "order_123456_3ds",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
                      "type": "PAY",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "100000",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "mid_label": "CTV_TEST",
                        "card_details": {
                          "masked_card_number": "4000****1091",
                          "cardholder_first_name": "John",
                          "cardholder_last_name": "Doe",
                          "cardholder_email": "john.doe@example.com",
                          "cardholder_phone_number": "+628123456789",
                          "expiry_month": "12",
                          "expiry_year": "2025",
                          "fingerprint": "62397498595752001b9fdeba",
                          "type": "DEBIT",
                          "network": "VISA",
                          "country": "ID",
                          "issuer": "PT BANK MANDIRI"
                        },
                        "skip_three_ds": "false",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "value": "https://redirect.partner.com/3ds-auth-xyz",
                          "descriptor": "WEB_URL"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Payment for Order #123456",
                      "metadata": {
                        "order_id": "123456",
                        "customer_type": "premium"
                      },
                      "created": "2025-01-15T12:30:45Z",
                      "updated": "2025-01-15T12:30:45Z"
                    }
                  },
                  "PAY_Cards_No_3DS": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "order_123457_no3ds",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas124",
                      "type": "PAY",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "50000",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "mid_label": "CTV_TEST",
                        "card_details": {
                          "masked_card_number": "5200****1096",
                          "cardholder_first_name": "Jane",
                          "cardholder_last_name": "Doe",
                          "cardholder_email": "jane.doe@example.com",
                          "cardholder_phone_number": "+6312345678901",
                          "expiry_month": "06",
                          "expiry_year": "2026",
                          "fingerprint": "62397498595752001b9fdebc",
                          "type": "CREDIT",
                          "network": "MASTERCARD",
                          "country": "ID",
                          "issuer": "PT BANK BCA"
                        },
                        "skip_three_ds": "true",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [],
                      "status": "SUCCEEDED",
                      "description": "Quick checkout for Order #123457",
                      "metadata": {
                        "order_id": "123457",
                        "checkout_type": "express"
                      },
                      "created": "2025-01-15T12:31:22Z",
                      "updated": "2025-01-15T12:31:25Z"
                    }
                  },
                  "PAY_Cards_Manual_Capture": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "booking_123458",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas125",
                      "type": "PAY",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "250000",
                      "capture_method": "MANUAL",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "mid_label": "CTV_TEST",
                        "card_details": {
                          "masked_card_number": "4000****0002",
                          "cardholder_first_name": "John",
                          "cardholder_last_name": "Doe",
                          "cardholder_email": "john.doe@example.com",
                          "cardholder_phone_number": "+6212345678902",
                          "expiry_month": "03",
                          "expiry_year": "2027",
                          "fingerprint": "62397498595752001b9fdebd",
                          "type": "CREDIT",
                          "network": "VISA",
                          "country": "ID",
                          "issuer": "PT BANK BNI"
                        },
                        "skip_three_ds": "false",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [],
                      "status": "AUTHORIZED",
                      "description": "Hotel booking pre-authorization #123458",
                      "metadata": {
                        "booking_id": "123458",
                        "booking_type": "hotel"
                      },
                      "created": "2025-01-15T12:32:10Z",
                      "updated": "2025-01-15T12:32:12Z"
                    }
                  },
                  "PAY_AND_SAVE_Cards": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "order_123459_save",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas126",
                      "customer_id": "cust-90392f42-d98a-49ef-a7f3-abcezas789",
                      "type": "PAY_AND_SAVE",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "500000",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "mid_label": "CTV_TEST",
                        "card_details": {
                          "masked_card_number": "4000****1109",
                          "cardholder_first_name": "John",
                          "cardholder_last_name": "Doe",
                          "cardholder_email": "john.doe@example.com",
                          "cardholder_phone_number": "+6212345678901",
                          "expiry_month": "11",
                          "expiry_year": "2026",
                          "fingerprint": "62397498595752001b9fdebe",
                          "type": "CREDIT",
                          "network": "VISA",
                          "country": "ID",
                          "issuer": "PT BANK MANDIRI"
                        },
                        "skip_three_ds": "false",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "value": "https://redirect.partner.com/3ds-auth-abc",
                          "descriptor": "WEB_URL"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Initial subscription payment - Premium Plan",
                      "metadata": {
                        "order_id": "123459",
                        "subscription_plan": "premium_monthly"
                      },
                      "created": "2025-01-15T12:33:15Z",
                      "updated": "2025-01-15T12:33:15Z"
                    }
                  },
                  "PAY_WithToken_Cards": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "recurring_payment_123460",
                      "payment_token_id": "pt-90392f42-d98a-49ef-a7f3-abcezas123",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas127",
                      "type": "PAY",
                      "country": "ID",
                      "currency": "IDR",
                      "request_amount": "500000",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "CARDS",
                      "channel_properties": {
                        "mid_label": "CTV_TEST",
                        "skip_three_ds": "true",
                        "card_on_file_type": "RECURRING",
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [],
                      "status": "SUCCEEDED",
                      "description": "Monthly subscription - Month 2",
                      "metadata": {
                        "subscription_id": "sub_789",
                        "billing_cycle": "2"
                      },
                      "created": "2025-01-15T12:34:20Z",
                      "updated": "2025-01-15T12:34:22Z"
                    }
                  },
                  "PAY_WithToken_TOUCHNGO": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "recurring_touchngo_123461",
                      "payment_token_id": "pt-tng-90392f42-d98a-49ef-a7f3",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas128",
                      "type": "PAY",
                      "country": "MY",
                      "currency": "MYR",
                      "request_amount": "150",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "TOUCHNGO",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "value": "https://redirect.partner.com/touchngo-auth-xyz",
                          "descriptor": "WEB_URL"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Monthly toll payment - Touch n Go",
                      "metadata": {
                        "account_id": "tng_123461",
                        "payment_type": "toll_recurring"
                      },
                      "created": "2025-01-15T12:35:30Z",
                      "updated": "2025-01-15T12:35:30Z"
                    }
                  },
                  "PAY_Ewallet_Shopeepay": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "order_ph_987654",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas129",
                      "type": "PAY",
                      "country": "PH",
                      "currency": "PHP",
                      "request_amount": "1250",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "SHOPEEPAY",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "REDIRECT_CUSTOMER",
                          "value": "https://redirect.partner.com/shopeepay-auth-xyz",
                          "descriptor": "WEB_URL"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Online purchase - Order #987654",
                      "metadata": {
                        "order_id": "987654",
                        "store_location": "manila_mall"
                      },
                      "created": "2025-01-15T12:36:45Z",
                      "updated": "2025-01-15T12:36:45Z"
                    }
                  },
                  "PAY_QR_PromptPay": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "qr_th_321654",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas130",
                      "type": "PAY",
                      "country": "TH",
                      "currency": "THB",
                      "request_amount": "1500",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "QRPROMPTPAY",
                      "channel_properties": {
                        "expires_at": "2025-01-15T23:59:59Z",
                        "qr_string_type": "DYNAMIC"
                      },
                      "actions": [
                        {
                          "type": "PRESENT_TO_CUSTOMER",
                          "descriptor": "QR_STRING",
                          "value": "00020101021153037643011A0000000677010111013202120000000000000000052048405303764540415005802TH5925THAI QR PAYMENT (EXAMPLE)6007Bangkok62070703001"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Restaurant bill - Table 15",
                      "metadata": {
                        "order_id": "321654",
                        "table_number": "15",
                        "branch": "bangkok_central",
                        "service_type": "dine_in"
                      },
                      "created": "2025-01-15T12:37:50Z",
                      "updated": "2025-01-15T12:37:50Z"
                    }
                  },
                  "PAY_DirectDebit_BPI": {
                    "value": {
                      "business_id": "5f27a14a9bf05c73dd040bc8",
                      "reference_id": "dd_ph_456789_with_cust",
                      "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas132",
                      "customer_id": "cust-e60078dd-494c-483c-a1e2-4f7bc34ff728",
                      "type": "PAY",
                      "country": "PH",
                      "currency": "PHP",
                      "request_amount": "2500",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "BPI_DIRECT_DEBIT",
                      "channel_properties": {
                        "failure_return_url": "https://xendit.co/failure",
                        "success_return_url": "https://xendit.co/success"
                      },
                      "actions": [
                        {
                          "type": "API_POST_REQUEST",
                          "descriptor": "DEBIT_ACCOUNT",
                          "value": "https://api.xendit.co/v1/direct_debits/authorize"
                        }
                      ],
                      "status": "REQUIRES_ACTION",
                      "description": "Bill payment - Account #456789",
                      "metadata": {
                        "bill_id": "456789",
                        "customer_account": "ACC456789"
                      },
                      "created": "2025-01-15T12:39:10Z",
                      "updated": "2025-01-15T12:39:10Z"
                    }
                  },
                  "REUSABLE_PAYMENT_CODE_VA_VietCapital": {
                    "value": {
                      "created": "2025-10-21T09:14:48.966Z",
                      "updated": "2025-10-21T09:14:48.966Z",
                      "channel_properties": {
                        "display_name": "xenCommerce Shop",
                        "expires_at": "2025-10-23T09:14:48.966Z"
                      },
                      "business_id": "6577c85379425b82e415c673",
                      "reference_id": "rpc_vn_123456",
                      "payment_request_id": "pr-73762759-0c9b-8178-b48f-0480d694b643",
                      "type": "REUSABLE_PAYMENT_CODE",
                      "country": "VN",
                      "currency": "VND",
                      "request_amount": "10000",
                      "capture_method": "AUTOMATIC",
                      "channel_code": "VIETCAPITAL_VIRTUAL_ACCOUNT",
                      "actions": [
                        {
                          "type": "PRESENT_TO_CUSTOMER",
                          "descriptor": "VIRTUAL_ACCOUNT_NUMBER",
                          "value": "8881761038089006"
                        },
                        {
                          "type": "PRESENT_TO_CUSTOMER",
                          "descriptor": "QR_STRING",
                          "value": "00020101021238600010A00000072701300006970454011688817610380890060208QRIBFTTA53037045802VN5405100006304C696"
                        }
                      ],
                      "status": "REQUIRES_ACTION"
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
                      "$ref": "#/components/schemas/Payments_API_Http400PaymentRequestRateLimited"
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
      },
      "Payments_API_WithSplitRuleHeaderParam": {
        "in": "header",
        "name": "with-split-rule",
        "required": "false",
        "schema": {
          "type": "string"
        },
        "description": "The XenPlatform split rule id that will be applied to this transaction."
      }
    },
    "schemas": {
      "Payments_API_Pay": {
        "type": "object",
        "description": "Create payment request API request body for a payment request that is able to receive one payment.",
        "required": [
          "reference_id",
          "type",
          "country",
          "currency",
          "request_amount",
          "channel_code",
          "channel_properties"
        ],
        "properties": {
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestReferenceId"
          },
          "type": {
            "type": "string",
            "enum": [
              "PAY"
            ],
            "description": "PAY: Create a payment request that is able to receive one payment.\n"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCode"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelPropertiesWidgetPay"
          },
          "request_amount": {
            "$ref": "#/components/schemas/Payments_API_RequestAmount"
          },
          "capture_method": {
            "$ref": "#/components/schemas/Payments_API_CaptureMethod"
          },
          "description": {
            "$ref": "#/components/schemas/Payments_API_Description"
          },
          "customer_id": {
            "$ref": "#/components/schemas/Payments_API_CustomerId"
          },
          "customer": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardCustomer"
          },
          "items": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardItemBasket"
          },
          "shipping_information": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardShippingInformation"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          }
        }
      },
      "Payments_API_PayAndSave": {
        "type": "object",
        "description": "Create payment request API request body for a payment request that is able to receive one payment. If the payment is successful, a reusable payment token will be returned in the callback as saved payment information for subsequent payment requests.",
        "required": [
          "reference_id",
          "type",
          "country",
          "currency",
          "request_amount",
          "channel_code",
          "channel_properties"
        ],
        "properties": {
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestReferenceId"
          },
          "type": {
            "type": "string",
            "enum": [
              "PAY_AND_SAVE"
            ],
            "description": "PAY_AND_SAVE: Create a payment request that is able to receive one payment. If the payment is successful, a reusable payment token will be returned in the callback as saved payment information for subsequent payment requests.\n"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCodePayAndSave"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelPropertiesWidgetPayAndSave"
          },
          "request_amount": {
            "$ref": "#/components/schemas/Payments_API_RequestAmount"
          },
          "capture_method": {
            "$ref": "#/components/schemas/Payments_API_CaptureMethod"
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
          "items": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardItemBasket"
          },
          "shipping_information": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardShippingInformation"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          }
        }
      },
      "Payments_API_PayWithToken": {
        "type": "object",
        "description": "Create payment request API request body for a payment request that is able to receive one payment. This request uses previously saved payment information in the form of a payment token to make the payment flow more frictionless for your end user.",
        "required": [
          "reference_id",
          "type",
          "country",
          "currency",
          "request_amount",
          "payment_token_id",
          "channel_code"
        ],
        "properties": {
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestReferenceId"
          },
          "type": {
            "type": "string",
            "enum": [
              "PAY"
            ],
            "description": "PAY: Create a payment request that is able to receive one payment.\n"
          },
          "payment_token_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentTokenId"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCodePayWithToken"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelPropertiesWidgetPayWithToken"
          },
          "request_amount": {
            "$ref": "#/components/schemas/Payments_API_RequestAmount"
          },
          "capture_method": {
            "$ref": "#/components/schemas/Payments_API_CaptureMethod"
          },
          "description": {
            "$ref": "#/components/schemas/Payments_API_Description"
          },
          "customer_id": {
            "$ref": "#/components/schemas/Payments_API_CustomerId"
          },
          "customer": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardCustomer"
          },
          "items": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardItemBasket"
          },
          "shipping_information": {
            "$ref": "#/components/schemas/Payments_API_XenditStandardShippingInformation"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payments_API_MerchantMetadata"
          }
        }
      },
      "Payments_API_ReusablePaymentCode": {
        "type": "object",
        "description": "Create payment request API request body for a payment request that is able to receive multiple payments. This is only used for repeat use payment method like static QR, static OTC payment code or a predefined Virtual Account number.",
        "required": [
          "reference_id",
          "type",
          "country",
          "currency",
          "channel_code",
          "channel_properties"
        ],
        "properties": {
          "reference_id": {
            "$ref": "#/components/schemas/Payments_API_PaymentRequestReferenceId"
          },
          "type": {
            "type": "string",
            "enum": [
              "REUSABLE_PAYMENT_CODE"
            ],
            "description": "REUSABLE_PAYMENT_CODE: Create one payment request that is able to receive multiple payments. This is only used for repeat use payment method like static QR, static OTC payment code or a predefined Virtual Account number.\n"
          },
          "country": {
            "$ref": "#/components/schemas/Payments_API_Country"
          },
          "currency": {
            "$ref": "#/components/schemas/Payments_API_Currency"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payments_API_ChannelCodeReusablePaymentCode"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payments_API_ChannelPropertiesWidgetReusablePaymentCode"
          },
          "request_amount": {
            "$ref": "#/components/schemas/Payments_API_RequestAmount"
          },
          "capture_method": {
            "$ref": "#/components/schemas/Payments_API_CaptureMethod"
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
          }
        }
      },
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
      "Payments_API_Http400PaymentRequestRateLimited": {
        "type": "object",
        "required": [
          "error_code",
          "message"
        ],
        "properties": {
          "error_code": {
            "type": "string",
            "enum": [
              "PAYMENT_REQUEST_RATE_LIMITED"
            ]
          },
          "message": {
            "type": "string",
            "description": "Maximum number of requests to this payment channel has been exceeded in a given time frame."
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
      "Payments_API_PaymentRequestReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A reference ID from merchants to identify their request. For \"CARDS\" channel code, reference ID must be unique."
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
      "Payments_API_ChannelCode": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?iframe_id=channel-code-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_ChannelPropertiesWidgetPay": {
        "type": "object",
        "description": "Data required to initiate transaction with payment method provider. Refer to the Channel Data Finder widget in the channel_code field above for the full list of required properties for each channel.\n"
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
      "Payments_API_Description": {
        "type": "string",
        "minLength": "1",
        "maxLength": "1000",
        "description": "A custom description for the Payment Request.",
        "example": "Payment for your order #123"
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
      "Payments_API_MerchantMetadata": {
        "type": "object",
        "description": "Key-value entries for your custom data.\nYou can specify up to 50 keys, with key names up to 40 characters and values up to 500 characters.\nThis is for your convenience. Xendit will not use this data for any processing.\n",
        "example": {
          "my_custom_id": "merchant-123",
          "my_custom_order_id": "order-123"
        }
      },
      "Payments_API_ChannelCodePayAndSave": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?type=pay-and-save&iframe_id=pay-and-save-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_ChannelPropertiesWidgetPayAndSave": {
        "type": "object",
        "description": "Data required to initiate transaction with payment method provider. Refer to the Channel Data Finder widget in the channel_code field above for the full list of required properties for each channel.\n"
      },
      "Payments_API_PaymentTokenId": {
        "type": "string",
        "description": "Xendit unique Payment Token ID generated as reference for reusable payment details of the end user.",
        "example": "pt-cc3938dc-c2a5-43c4-89d7-7570793348c2"
      },
      "Payments_API_ChannelCodePayWithToken": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?type=pay-with-token&iframe_id=pay-with-token-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_ChannelPropertiesWidgetPayWithToken": {
        "type": "object",
        "description": "Data required to initiate transaction with payment method provider. Refer to the Channel Data Finder widget in the channel_code field above for the full list of required properties for each channel.\n"
      },
      "Payments_API_ChannelCodeReusablePaymentCode": {
        "type": "string",
        "description": "Channel code used to select the payment method provider.\n\n<iframe src=\"https://doc-widget.xendit.co/channel-data-finder/?type=reusable-payment-code&iframe_id=reusable-payment-code-iframe\" frameborder=\"0\" allowfullscreen=\"\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" title=\"\" style=\"border:1px solid #ccc;width:100%;display:flex;margin-right:auto;max-height:800px;\" width=\"100%\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>\n"
      },
      "Payments_API_ChannelPropertiesWidgetReusablePaymentCode": {
        "type": "object",
        "description": "Data required to initiate transaction with payment method provider. Refer to the Channel Data Finder widget in the channel_code field above for the full list of required properties for each channel.\n"
      },
      "Payments_API_BusinessId": {
        "type": "string",
        "description": "Xendit-generated identifier for the business that owns the transaction",
        "example": "5f27a14a9bf05c73dd040bc8"
      },
      "Payments_API_PaymentRequestId": {
        "type": "string",
        "description": "Xendit unique Payment Request ID generated as reference after creation of payment request.",
        "example": "pr-1102feb0-bb79-47ae-9d1e-e69394d3949c"
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
      }
    }
  }
}
````

