> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create a Cross-Border Payout

> Our Create Cross-Border Payout API allows you to send third party payouts from your Xendit Account on behalf of a sender to your designated recipient.


## OpenAPI

````json POST /remittance_payouts
{
  "openapi": "3.0.3",
  "info": {
    "title": "Payouts",
    "version": "1.0",
    "description": "This Payouts API can be used to send money at scale to all bank accounts & E-Wallets in Indonesia, Philippines, Thailand, Malaysia and Vietnam by using just a single endpoint."
  },
  "servers": [
    {
      "url": "https://api.xendit.co",
      "description": "Xendit API"
    }
  ],
  "paths": {
    "/remittance_payouts": {
      "post": {
        "security": [
          {
            "Payouts_BasicAuth": []
          }
        ],
        "operationId": "createCrossborderPayout",
        "summary": "Create a Cross-Border Payout",
        "description": "Our Create Cross-Border Payout API allows you to send third party payouts from your Xendit Account on behalf of a sender to your designated recipient.\n",
        "tags": [
          "Cross-Border Payout"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payouts_IdempotencyKeyHeaderParam"
          }
        ],
        "requestBody": {
          "required": "true",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Payouts_CreateCrossBorderPayoutSchema"
              },
              "examples": {
                "createPayoutExample": {
                  "value": {
                    "reference_id": "myref-1482928194",
                    "destination_currency": "IDR",
                    "destination_amount": "1000000",
                    "sender_customer_id": "cust-1752fefb-358c-4043-a690-58036157d851",
                    "recipient_customer_id": "cust-b8476133-ec15-4f06-9dfb-562d8dca3f43",
                    "origin_currency": "EUR",
                    "origin_amount": "60",
                    "source_of_fund": "OTHER",
                    "purpose_code": "OTHER",
                    "relationship": "CUSTOMER",
                    "description": "This is a sample Cross-border Payout transaction"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Cross-Border Payout created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Payouts_StandardCrossBorderPayoutResponseSchema"
                },
                "examples": {
                  "createCrossBorderPayoutResponseExample": {
                    "value": {
                      "id": "rpo_288250b4-124b-4be5-93a1-1cd50dd4ad02",
                      "business_id": "665990ef233a8b8054549367",
                      "description": "This is a sample Cross-border Payout transaction",
                      "destination_amount": "1000000",
                      "destination_currency": "IDR",
                      "metadata": {},
                      "origin_amount": "60",
                      "origin_currency": "EUR",
                      "purpose_code": "OTHER",
                      "recipient_customer_id": "cust-b8476133-ec15-4f06-9dfb-562d8dca3f43",
                      "reference_id": "myref-1482928194",
                      "relationship": "CUSTOMER",
                      "sender_customer_id": "cust-1752fefb-358c-4043-a690-58036157d851",
                      "source_of_fund": "OTHER",
                      "status": "ACCEPTED",
                      "created": "2024-12-13T07:51:10.832Z",
                      "updated": "2024-12-13T07:51:10.832Z"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/Payouts_CreateCrossBorderPayout400Response"
          },
          "403": {
            "$ref": "#/components/responses/Payouts_ErrorStatusCode403Response"
          },
          "404": {
            "$ref": "#/components/responses/Payouts_CreateCrossBorderPayout404Response"
          },
          "409": {
            "$ref": "#/components/responses/Payouts_ErrorStatusCode409Response"
          },
          "500": {
            "$ref": "#/components/responses/Payouts_ErrorStatusCode500Response"
          }
        }
      }
    }
  },
  "components": {
    "parameters": {
      "Payouts_IdempotencyKeyHeaderParam": {
        "in": "header",
        "name": "Idempotency-key",
        "required": "true",
        "schema": {
          "example": "ef73608e-51d1-4770-8396-08a44dd4c9f0",
          "type": "string",
          "minLength": "1",
          "maxLength": "100"
        },
        "description": "A unique key to prevent processing duplicate requests. Can be your reference_id or any GUID.\n"
      }
    },
    "schemas": {
      "Payouts_CreateCrossBorderPayoutSchema": {
        "type": "object",
        "required": [
          "reference_id",
          "destination_currency",
          "destination_amount",
          "sender_customer_id",
          "recipient_customer_id",
          "origin_currency",
          "origin_amount",
          "description"
        ],
        "properties": {
          "reference_id": {
            "$ref": "#/components/schemas/Payouts_ReferenceId"
          },
          "destination_currency": {
            "$ref": "#/components/schemas/Payouts_Currency"
          },
          "destination_amount": {
            "$ref": "#/components/schemas/Payouts_Amount"
          },
          "sender_customer_id": {
            "$ref": "#/components/schemas/Payouts_SenderCustomerId"
          },
          "recipient_customer_id": {
            "$ref": "#/components/schemas/Payouts_RecipientCustomerId"
          },
          "origin_currency": {
            "$ref": "#/components/schemas/Payouts_Currency"
          },
          "origin_amount": {
            "$ref": "#/components/schemas/Payouts_OriginAmount"
          },
          "source_of_fund": {
            "$ref": "#/components/schemas/Payouts_SourceOfFund"
          },
          "purpose_code": {
            "$ref": "#/components/schemas/Payouts_PurposeCode"
          },
          "relationship": {
            "$ref": "#/components/schemas/Payouts_RelationShip"
          },
          "description": {
            "$ref": "#/components/schemas/Payouts_Description"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payouts_Metadata"
          }
        }
      },
      "Payouts_StandardCrossBorderPayoutResponseSchema": {
        "type": "object",
        "properties": {
          "id": {
            "$ref": "#/components/schemas/Payouts_CrossBorderPayoutId"
          },
          "created": {
            "$ref": "#/components/schemas/Payouts_CreatedTimestamp"
          },
          "updated": {
            "$ref": "#/components/schemas/Payouts_UpdatedTimestamp"
          },
          "business_id": {
            "$ref": "#/components/schemas/Payouts_XenditBusinessId"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payouts_ReferenceId"
          },
          "destination_currency": {
            "$ref": "#/components/schemas/Payouts_Currency"
          },
          "destination_amount": {
            "$ref": "#/components/schemas/Payouts_Amount"
          },
          "sender_customer_id": {
            "$ref": "#/components/schemas/Payouts_SenderCustomerId"
          },
          "recipient_customer_id": {
            "$ref": "#/components/schemas/Payouts_RecipientCustomerId"
          },
          "status": {
            "$ref": "#/components/schemas/Payouts_CrossBorderPayoutStatus"
          },
          "description": {
            "$ref": "#/components/schemas/Payouts_Description"
          },
          "source_of_fund": {
            "$ref": "#/components/schemas/Payouts_SourceOfFund"
          },
          "origin_currency": {
            "$ref": "#/components/schemas/Payouts_Currency"
          },
          "origin_amount": {
            "$ref": "#/components/schemas/Payouts_OriginAmount"
          },
          "purpose_code": {
            "$ref": "#/components/schemas/Payouts_PurposeCode"
          },
          "relationship": {
            "$ref": "#/components/schemas/Payouts_RelationShip"
          },
          "failure_code": {
            "$ref": "#/components/schemas/Payouts_FailureCode"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payouts_Metadata"
          }
        }
      },
      "Payouts_ReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A reference to uniquely identify the Payout.",
        "example": "myref-1482928194"
      },
      "Payouts_Currency": {
        "type": "string",
        "description": "ISO 4217 Currency Code."
      },
      "Payouts_Amount": {
        "type": "number",
        "minimum": "0",
        "description": "Amount to be sent to the destination account. \n\n* For `IDR` currency, number should be integer\n* For `PHP` currency, number can be up to 2 decimal places\n* For `VND` currency, number should be integer\n* For `MYR` currency, number can be up to 2 decimal places\n* For `THB` currency, number can be up to 2 decimal places\n",
        "example": "10000"
      },
      "Payouts_SenderCustomerId": {
        "type": "string",
        "description": "The Id of the sender customer (as returned by the Create Customer endpoint)\n\nThe following fields are required in the sender customer object: `customer_type` and `addresses`\n- For INDIVIDUAL `customer_type`, the following parameters are also required: `given_names`, `nationality`, and `date_of_birth` in `customer_type`.`individual_detail` object\n- For BUSINESS `customer_type`, then the following parameters are also required: `business_name` in `customer_type`.`business_detail` object.\n- For `addresses` object, the following fields are also required: `addresses`.`country`, `addresses`.`city`, `addresses`.`street_line1`\n\nReference: [Customer Object](https://developers.xendit.co/api-reference/#create-customer)\n"
      },
      "Payouts_RecipientCustomerId": {
        "type": "string",
        "description": "The Id of the recipient customer (as returned by the Create Customer endpoint)\n\nThe following fields are required in the sender customer object: `customer_type`, `addresses`, `identity_accounts`, and one of `phone_number` or `mobile_number`\n- For INDIVIDUAL `customer_type`, the following parameters are also required: `given_names`, `nationality`, and `date_of_birth` in `customer_type`.`individual_detail` object\n- For BUSINESS `customer_type`, then the following parameters are also required: `business_name` in `customer_type`.`business_detail` object.\n- For `addresses` object, the following fields are also required: `addresses`.`country`, `addresses`.`city`, `addresses`.`street_line1`\n- For `identity_accounts` object, the following fields are also required: `type`, `country`, `company` (with the channel code value), and `properties`\n\nReference: [Customer Object](https://developers.xendit.co/api-reference/#create-customer)\n"
      },
      "Payouts_OriginAmount": {
        "type": "number",
        "description": "The original amount as sent by the sender. \nThis field will not be used for processing the payout, but is required for monitoring purposes. \n\nXendit will deduct your balance and process the payout in the destination amount and currency.\n"
      },
      "Payouts_SourceOfFund": {
        "type": "string",
        "enum": [
          "INVESTMENT",
          "PERSONAL_SAVINGS",
          "BUSINESS_REVENUE",
          "LEGACY",
          "BUSINESS_ARRANGEMENT",
          "LOAN",
          "SALARY",
          "OTHER"
        ],
        "description": "Source of fund\n  * `INVESTMENT` - Bonds, fixed deposits, preference shares, business ownership/equity or property ownership\n  * `PERSONAL_SAVINGS` - Funds kept in an account in a bank or a similar organization\n  * `BUSINESS_REVENUE` - Income from a business or a company\n  * `LEGACY` - Inherited money from a will\n  * `BUSINESS_ARRANGEMENT` - Any understanding, procedure, course of dealing, or arrangement between a creditor and a seller\n  * `LOAN` - A sum of money that is borrowed\n  * `SALARY` - A fixed regular payment made by an employer\n  * `OTHER` - Other\n\nDefault: OTHER\n"
      },
      "Payouts_PurposeCode": {
        "type": "string",
        "enum": [
          "SELF",
          "FAMILY",
          "EDUCATION",
          "MEDICAL",
          "HOTEL",
          "TRAVEL",
          "UTILITIES",
          "LOAN_REPAYMENT",
          "TAX_PAYMENT",
          "RESIDENCE_PURCHASE",
          "RESIDENCE_RENT",
          "INSURANCE",
          "MUTUAL_FUND",
          "SHARES_INVESTMENT",
          "DONATIONS",
          "ADVERTISING",
          "ROYALTY_FEES",
          "BROKER_FEES",
          "ADVISORS",
          "OFFICE",
          "CONSTRUCTION",
          "SHIPMENT",
          "EXPORT",
          "DELIVERY",
          "TRADES",
          "SALARY",
          "REFUND",
          "OTHER"
        ],
        "description": "Purpose of the Cross-border Payout\n  * `SELF` - Transfer to own account\n  * `FAMILY` - Family Maintenance\n  * `EDUCATION` - Education-related student expenses\n  * `MEDICAL` - Medical Treatment\n  * `HOTEL` - Hotel Accomodation\n  * `TRAVEL` - Travel\n  * `UTILITIES` - Utility Bills\n  * `LOAN_REPAYMENT` - Repayment of Loans\n  * `TAX_PAYMENT` - Tax Payment\n  * `RESIDENCE_PURCHASE` - Purchase of Residential Property\n  * `RESIDENCE_RENT` - Payment of Property Rental\n  * `INSURANCE` - Insurance\n  * `MUTUAL_FUND` - Mutual Fund Investment\n  * `SHARES_INVESTMENT` - Investment in Shares\n  * `DONATIONS` - Donations\n  * `ADVERTISING` - Advertising & Public relations-related expenses\n  * `ROYALTY_FEES` - Royalty fees, trademark fees, patent fees, and copyright fees\n  * `BROKER_FEES` - Fees for brokers, front end fee, commitment fee, guarantee fee and custodian fee\n  * `ADVISORS` - Fees for advisors, technical assistance, and academic purpose, including remuneration for specialists\n  * `OFFICE` - Representative office expenses\n  * `CONSTRUCTION` - Construction costs / expenses\n  * `SHIPMENT` - Transportation fees for goods\n  * `EXPORT` - For payment of exported goods\n  * `DELIVERY` - Delivery fees for goods\n  * `TRADES` - General Goods Trades - Offline trade\n  * `SALARY` - Salary\n  * `REFUND` - Refund\n  * `OTHER` - Other\n\nDefault: OTHER\n"
      },
      "Payouts_RelationShip": {
        "type": "string",
        "enum": [
          "BRANCH_REPRESENTATIVE_OFFICE",
          "BUSINESS_PARTNER",
          "CHILDREN",
          "CREDITOR",
          "CUSTOMER",
          "DEBTOR",
          "EMPLOYEE",
          "EX_SPOUSE",
          "FRANCHISEE_FRANCHISOR",
          "GRANDPARENTS",
          "HOLDING_COMPANY",
          "MAID",
          "OWNSELF",
          "PARENTS",
          "RELATIVE",
          "SIBLING",
          "SPOUSE",
          "SUBSIDIARY_COMPANY",
          "SUPPLIER",
          "FRIEND",
          "GOVERNMENT_BODY",
          "EDUCATION_INSTITUTION",
          "NON_GOVERNMENT_BODY",
          "OTHER"
        ],
        "description": "Relationship between sender and recipient\n\nRequired for PH_GCASH\nDefault: OTHER\n"
      },
      "Payouts_Description": {
        "type": "string",
        "description": "Description to send with the payout. \nThe recipient may see this e.g. in their bank statement (if supported) or in email receipts we send on your behalf.\n",
        "minLength": "1",
        "maxLength": "100"
      },
      "Payouts_Metadata": {
        "type": "object",
        "nullable": "true",
        "description": "Key-value entries for your custom data.\nYou can specify up to 50 keys, with key names up to 40 characters and values up to 500 characters.\nThis is for your convenience. Xendit will not use this data for any processing.\n",
        "example": {
          "my_custom_id": "merchant-123",
          "my_custom_order_id": "order-123"
        }
      },
      "Payouts_CrossBorderPayoutId": {
        "type": "string",
        "description": "Xendit-generated unique payout link id in UUID format\n\nPrefix: rpo_\n",
        "minLength": "40",
        "maxLength": "40",
        "example": "rpo_cde3dcb8-37d7-4ea1-a275-8f54af81feb0"
      },
      "Payouts_CreatedTimestamp": {
        "type": "string",
        "description": "Timestamp when the payout request was made (in ISO 8601 format)\n\nTimezone UTC+0\n"
      },
      "Payouts_UpdatedTimestamp": {
        "type": "string",
        "description": "Timestamp when the payout request was updated (in ISO 8601 format)\n\nTimezone UTC+0\n"
      },
      "Payouts_XenditBusinessId": {
        "type": "string",
        "description": "Your Xendit Business ID",
        "example": "5785e6334d7b410667d355c4"
      },
      "Payouts_CrossBorderPayoutStatus": {
        "type": "string",
        "enum": [
          "ACCEPTED",
          "PENDING_COMPLIANCE_ASSESSMENT",
          "COMPLIANCE_REJECTED",
          "REQUESTED",
          "READY",
          "LOCKED",
          "EXPIRED",
          "FAILED",
          "SUCCEEDED",
          "CANCELLED",
          "REFUNDED"
        ],
        "description": "Status of the cross-border payout. Default is ACCEPTED.\n\n  * `ACCEPTED` - The payout request has been accepted and has not yet been sent on to a channel. A payout may remain in this status if the chosen channel is currently offline. Xendit will process this automatically when the channel comes back online\n  * `PENDING_COMPLIANCE_ASSESSMENT` - Request is considered medium or high risk, and is being reviewed by our compliance team. Our team will contact you via email for extra information for enhanced due diligence.\n  * `COMPLIANCE_REJECTED` - Request is rejected for compliance reasons.\n  * `REQUESTED` - The payout has been sent to the channel. Funds have been sent to the channel for processing.\n  * `READY` - For cash payout only. Cash is ready for pick-up.\n  * `LOCKED` - For cash payout only. Cash pick-up in progress.\n  * `EXPIRED` - For cash payout only. Cash payout has expired.\n  * `FAILED` - Payout failed. See possible reasons in Failed Reasons section.\n  * `SUCCEEDED` - Sender bank/channel has sent out the payout\n  * `CANCELLED` - Payout has been cancelled per your request\n  * `REFUNDED` - Only valid for SKN/RTGS and cash channel use case.\n"
      },
      "Payouts_FailureCode": {
        "type": "string",
        "enum": [
          "INSUFFICIENT_BALANCE",
          "INVALID_DESTINATION",
          "REJECTED_BY_CHANNEL",
          "TEMPORARY_TRANSFER_ERROR",
          "TRANSFER_ERROR",
          "UNKNOWN_BANK_NETWORK_ERROR",
          "DESTINATION_MAXIMUM_LIMIT"
        ],
        "description": "If the Payout failed, we include a failure code for more details on the failure.\n\n  * `INSUFFICIENT_BALANCE` - Client has insufficient balance for the payout amount\n  * `INVALID_DESTINATION` - The recipient account does not exist/is invalid.\n  * `REJECTED_BY_CHANNEL` - Payout failed due to an error from the destination channel. This is usually because of network issues associated with the destination bank or issues crediting funds into the destination bank account.\n  * `TEMPORARY_TRANSFER_ERROR` - The channel networks are experiencing a temporary error.\n  * `TRANSFER_ERROR` - We’ve encountered a fatal error while processing this payout. Normally, this means that certain API fields in your request are invalid.\n  * `UNKNOWN_BANK_NETWORK_ERROR` - The bank has delivered an error they have not documented. By definition, this means the bank does not know the issue.\n  * `DESTINATION_MAXIMUM_LIMIT` - The recipient is unable to receive the funds due to the payout amount exceeding the recipient’s ability to receive.\n"
      },
      "Payouts_400APIValidationError": {
        "type": "object",
        "title": "API Validation Error",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "API_VALIDATION_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "Inputs are failing validation. The errors field contains details about which fields are violating validation"
          }
        }
      },
      "Payouts_400InvalidJSONFormatError": {
        "type": "object",
        "title": "Invalid JSON Format",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "INVALID_JSON_FORMAT"
          },
          "error_message": {
            "type": "string",
            "example": "The request body is not a valid JSON format"
          }
        }
      },
      "Payouts_400DestinationCurrencyNotSupportedError": {
        "type": "object",
        "title": "Destination currency not supported",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "DESTINATION_CURRENCY_NOT_SUPPORTED"
          },
          "error_message": {
            "type": "string",
            "example": "Destination currency is not supported. Check that the currency is supported for your chosen channel before retrying"
          }
        }
      },
      "Payouts_400AmountFormatError": {
        "type": "object",
        "title": "Amount format error",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "AMOUNT_FORMAT_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "Incorrect number of decimal places for given amount"
          }
        }
      },
      "Payouts_400MinimumTransferLimitError": {
        "type": "object",
        "title": "Minimum transfer limit",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "MINIMUM_TRANSFER_LIMIT_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "\"amount” is under the minimum amount supported for the channel. See amount limitations at the URL below"
          }
        }
      },
      "Payouts_400MaximumTransferLimitError": {
        "type": "object",
        "title": "Maximum transfer limit",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "MAXIMUM_TRANSFER_LIMIT_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "“amount” is more than the maximum amount supported for the channel. See amount limitations at the URL below"
          }
        }
      },
      "Payouts_400AmountIncrementError": {
        "type": "object",
        "title": "Amount increment not supported",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "AMOUNT_INCREMENT_NOT_SUPPORTED"
          },
          "error_message": {
            "type": "string",
            "example": "“amount” needs to be a multiple of the minimum increment supported by the channel"
          }
        }
      },
      "Payouts_400AccountBlacklistedError": {
        "type": "object",
        "title": "Account blacklisted",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "ACCOUNT_BLACKLISTED_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "The provided recipient bank account is blacklisted"
          }
        }
      },
      "Payouts_400PaymentChannelDetailError": {
        "type": "object",
        "title": "Payment channel detail error",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "PAYMENT_CHANNEL_DETAIL_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "The provided recipient account type is invalid. Please use the valid values (BANK_ACCOUNT or EWALLET)"
          }
        }
      },
      "Payouts_400DuplicateError": {
        "type": "object",
        "title": "Duplicate error",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "DUPLICATE_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "A payout with this idempotency key already exists. If you meant to execute a different request, please use another idempotency key"
          }
        }
      },
      "Payouts_403RequestForbiddenError": {
        "type": "object",
        "title": "Request Forbidden",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "REQUEST_FORBIDDEN_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "The API key is forbidden to perform this request"
          }
        }
      },
      "Payouts_404CustomerDataNotFoundError": {
        "type": "object",
        "title": "Customer Data Not Found",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "CUSTOMER_DATA_NOT_FOUND"
          },
          "error_message": {
            "type": "string",
            "example": "Could not find any customer object with given sender_customer_id or recipient_customer_id. Try again using a valid Customer Id"
          }
        }
      },
      "Payouts_409IdempotencyError": {
        "type": "object",
        "title": "Idempotency error",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "IDEMPOTENCY_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "Keys for idempotent requests can only be used for the same endpoint they were first used for. Try using a key if you meant to execute a different request"
          }
        }
      },
      "Payouts_409StillProcessingError": {
        "type": "object",
        "title": "Still processing",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "STILL_PROCESSING_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "Similar request with similar idempotency key is still processing"
          }
        }
      },
      "Payouts_500ServerError": {
        "type": "object",
        "title": "Server error",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "SERVER_ERROR"
          },
          "error_message": {
            "type": "string",
            "example": "Error connecting to our server. Retry safely using Idempotency-key header when available"
          }
        }
      }
    },
    "responses": {
      "Payouts_CreateCrossBorderPayout400Response": {
        "description": "Bad Request",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_400APIValidationError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400InvalidJSONFormatError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400DestinationCurrencyNotSupportedError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400AmountFormatError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400MinimumTransferLimitError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400MaximumTransferLimitError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400AmountIncrementError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400AccountBlacklistedError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400PaymentChannelDetailError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_400DuplicateError"
                }
              ]
            }
          }
        }
      },
      "Payouts_ErrorStatusCode403Response": {
        "description": "Forbidden",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_403RequestForbiddenError"
                }
              ]
            }
          }
        }
      },
      "Payouts_CreateCrossBorderPayout404Response": {
        "description": "Not Found",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_404CustomerDataNotFoundError"
                }
              ]
            }
          }
        }
      },
      "Payouts_ErrorStatusCode409Response": {
        "description": "Conflict",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_409IdempotencyError"
                },
                {
                  "$ref": "#/components/schemas/Payouts_409StillProcessingError"
                }
              ]
            }
          }
        }
      },
      "Payouts_ErrorStatusCode500Response": {
        "description": "Internal Server Error",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_500ServerError"
                }
              ]
            }
          }
        }
      }
    }
  }
}
````

