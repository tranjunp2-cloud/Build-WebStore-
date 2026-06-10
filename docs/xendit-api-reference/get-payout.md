> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get payout by ID

> This endpoint queries the current status of a payout. 
This is often used for checking the status of a transaction using the id from the Payout Object.


## OpenAPI

````json GET /v2/payouts/{payout_id}
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
    "/v2/payouts/{payout_id}": {
      "get": {
        "security": [
          {
            "Payouts_BasicAuth": []
          }
        ],
        "operationId": "getPayoutById",
        "summary": "Get payout by ID",
        "description": "This endpoint queries the current status of a payout. \nThis is often used for checking the status of a transaction using the id from the Payout Object.\n",
        "tags": [
          "Payout"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payouts_ForUserIdHeaderParam"
          },
          {
            "$ref": "#/components/parameters/Payouts_PayoutIdPathParam"
          }
        ],
        "responses": {
          "200": {
            "description": "Payout Found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Payouts_StandardPayoutResponseSchema"
                },
                "examples": {
                  "getPayoutResponseExample": {
                    "value": {
                      "id": "disb-571f3644d2b4edf0745e9703",
                      "amount": "10000",
                      "channel_code": "ID_BCA",
                      "currency": "IDR",
                      "status": "ACCEPTED",
                      "description": "July payout",
                      "reference_id": "myref-1482928194",
                      "created": "2024-12-31T23:53:59Z",
                      "updated": "2024-12-31T23:53:59Z",
                      "estimated_arrival_time": "2024-12-31T23:59:59Z",
                      "business_id": "6018306aa16ad90cb3c43ba7",
                      "channel_properties": {
                        "account_number": "000000000099",
                        "account_holder_name": "Michael Chen"
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Payouts_ErrorStatusCode401Response"
          },
          "404": {
            "$ref": "#/components/responses/Payouts_ErrorStatusCode404Response"
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
      "Payouts_ForUserIdHeaderParam": {
        "in": "header",
        "name": "for-user-id",
        "required": "false",
        "schema": {
          "type": "string"
        },
        "description": "The XenPlatform subaccount user id that you want to make this transaction for.\nThis header is only used if you have access to xenPlatform. See [xenPlatform](https://developers.xendit.co/api-reference/#xenplatform) for more information.\n"
      },
      "Payouts_PayoutIdPathParam": {
        "in": "path",
        "name": "payout_id",
        "required": "true",
        "schema": {
          "$ref": "#/components/schemas/Payouts_PayoutId"
        }
      }
    },
    "schemas": {
      "Payouts_StandardPayoutResponseSchema": {
        "type": "object",
        "properties": {
          "id": {
            "$ref": "#/components/schemas/Payouts_PayoutId"
          },
          "amount": {
            "$ref": "#/components/schemas/Payouts_Amount"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payouts_ChannelCode"
          },
          "currency": {
            "$ref": "#/components/schemas/Payouts_Currency"
          },
          "reference_id": {
            "$ref": "#/components/schemas/Payouts_ReferenceId"
          },
          "status": {
            "$ref": "#/components/schemas/Payouts_PayoutStatus"
          },
          "created": {
            "$ref": "#/components/schemas/Payouts_CreatedTimestamp"
          },
          "updated": {
            "$ref": "#/components/schemas/Payouts_UpdatedTimestamp"
          },
          "estimated_arrival_time": {
            "$ref": "#/components/schemas/Payouts_EstimatedArrivalTime"
          },
          "failure_code": {
            "$ref": "#/components/schemas/Payouts_FailureCode"
          },
          "business_id": {
            "$ref": "#/components/schemas/Payouts_XenditBusinessId"
          },
          "channel_properties": {
            "$ref": "#/components/schemas/Payouts_ChannelProperties"
          },
          "receipt_notification": {
            "$ref": "#/components/schemas/Payouts_ReceiptNotification"
          },
          "metadata": {
            "$ref": "#/components/schemas/Payouts_Metadata"
          }
        }
      },
      "Payouts_PayoutId": {
        "type": "string",
        "description": "Xendit-generated unique identifier for each payout\n\nPrefix: disb_\n",
        "minLength": "29",
        "maxLength": "29",
        "example": "disb-571f3644d2b4edf0745e9703"
      },
      "Payouts_Amount": {
        "type": "number",
        "minimum": "0",
        "description": "Amount to be sent to the destination account. \n\n* For `IDR` currency, number should be integer\n* For `PHP` currency, number can be up to 2 decimal places\n* For `VND` currency, number should be integer\n* For `MYR` currency, number can be up to 2 decimal places\n* For `THB` currency, number can be up to 2 decimal places\n",
        "example": "10000"
      },
      "Payouts_ChannelCode": {
        "type": "string",
        "description": "Channel code of destination bank, E-Wallet or OTC channel. \nList of supported channels can be found [here](https://docs.xendit.co/xendisburse/channel-codes)\n",
        "example": "ID_BCA"
      },
      "Payouts_Currency": {
        "type": "string",
        "description": "ISO 4217 Currency Code."
      },
      "Payouts_ReferenceId": {
        "type": "string",
        "minLength": "1",
        "maxLength": "255",
        "description": "A reference to uniquely identify the Payout.",
        "example": "myref-1482928194"
      },
      "Payouts_PayoutStatus": {
        "type": "string",
        "enum": [
          "ACCEPTED",
          "REQUESTED",
          "FAILED",
          "SUCCEEDED",
          "CANCELLED",
          "REVERSED"
        ],
        "description": "Status of the payout.\n\nThe status in the response will always be ACCEPTED; meaning transfer is initiated but not yet completed by bank or E-Wallet.\nThe final status will be given in a callback.\n\n  * `ACCEPTED` - The payout request has been accepted and has not yet been sent on to a channel. A payout may remain in this status if the chosen channel is currently offline. Xendit will process this automatically when the channel comes back online\n  * `REQUESTED` - The payout has been sent to the channel. Funds have been sent to the channel for processing.\n  * `FAILED` - Payout failed. See possible reasons in Failed Reasons section.\n  * `SUCCEEDED` - Sender bank/channel has sent out the payout\n  * `CANCELLED` - Payout has been cancelled per your request\n  * `REVERSED` - Payout was rejected by the channel after the payout succeeded. Commonly due to invalid or dormant account.\n"
      },
      "Payouts_CreatedTimestamp": {
        "type": "string",
        "description": "Timestamp when the payout request was made (in ISO 8601 format)\n\nTimezone UTC+0\n"
      },
      "Payouts_UpdatedTimestamp": {
        "type": "string",
        "description": "Timestamp when the payout request was updated (in ISO 8601 format)\n\nTimezone UTC+0\n"
      },
      "Payouts_EstimatedArrivalTime": {
        "type": "string",
        "description": "Estimated time of arrival of funds in destination account (in ISO 8601 format)\nFor OTC payouts: Estimated time that funds will be available for pick-up\n\nTimezone UTC+0\n"
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
      "Payouts_XenditBusinessId": {
        "type": "string",
        "description": "Your Xendit Business ID",
        "example": "5785e6334d7b410667d355c4"
      },
      "Payouts_ChannelProperties": {
        "type": "object",
        "required": [
          "account_holder_name",
          "account_number"
        ],
        "properties": {
          "account_holder_name": {
            "type": "string",
            "description": "Name of account holder as per the bank or E-Wallet's records. Needs to match the registered account name exactly.",
            "minLength": "1",
            "maxLength": "100"
          },
          "account_number": {
            "type": "string",
            "description": "Account number of destination. Mobile numbers for E-Wallet accounts.\nFor E-Wallets, standard format should use prefix 0, e.g. 081234567890\n",
            "minLength": "1",
            "maxLength": "100"
          },
          "account_type": {
            "type": "string",
            "description": "Account type of the destination for currencies and channels that supports proxy transfers (ie: Using mobile number as account number)\nIf you do not specify a value for this field, the default value is BANK_ACCOUNT\n\nValues:\n\nFor channel_code == MY_DUITNOW:\nMOBILE_NO\nNATIONAL_ID\nPASSPORT\nBUSINESS_REGISTRATION\nBANK_ACCOUNT\n\nFor currency == THB:\nMOBILE_NO\nNATIONAL_ID\nBANK_ACCOUNT\n"
          }
        }
      },
      "Payouts_ReceiptNotification": {
        "type": "object",
        "description": "Object containing email addresses to receive payout details upon successful Payout.\nMaximum of three email addresses each.\n",
        "properties": {
          "email_to": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Direct email recipients"
          },
          "email_cc": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "CC-ed email recipients"
          },
          "email_bcc": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "BCC-ed email recipients"
          }
        }
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
      "Payouts_401InvalidAPIKeyError": {
        "type": "object",
        "title": "Invalid API Key",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "INVALID_API_KEY"
          },
          "error_message": {
            "type": "string",
            "example": "API key format is invalid"
          }
        }
      },
      "Payouts_404DataNotFoundError": {
        "type": "object",
        "title": "Data Not Found",
        "properties": {
          "error_code": {
            "type": "string",
            "example": "DATA_NOT_FOUND"
          },
          "error_message": {
            "type": "string",
            "example": "Could not find payout with the corresponding ID. Please try again with a valid Id"
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
      "Payouts_ErrorStatusCode401Response": {
        "description": "Unauthorized",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_401InvalidAPIKeyError"
                }
              ]
            }
          }
        }
      },
      "Payouts_ErrorStatusCode404Response": {
        "description": "Not Found",
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/Payouts_404DataNotFoundError"
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

