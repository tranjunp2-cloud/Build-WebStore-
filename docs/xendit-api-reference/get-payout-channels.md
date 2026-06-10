> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Payment Channels

> This API endpoint will provide you the current list of banks and E-Wallets we support for payouts


## OpenAPI

````json GET /payouts_channels
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
    "/payouts_channels": {
      "get": {
        "security": [
          {
            "Payouts_BasicAuth": []
          }
        ],
        "operationId": "getPaymentChannels",
        "summary": "Get Payment Channels",
        "description": "This API endpoint will provide you the current list of banks and E-Wallets we support for payouts\n",
        "tags": [
          "Payout"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Payouts_CurrencyQueryParams"
          },
          {
            "$ref": "#/components/parameters/Payouts_ChannelCategoryQueryParams"
          },
          {
            "$ref": "#/components/parameters/Payouts_ChannelCodeQueryParams"
          }
        ],
        "responses": {
          "200": {
            "description": "'Returns array of Payout Channel objects sorted by alphabetical order by channel_code with HTTP status code 200. \nReturn empty array when not found.\n\nIf query parameters are defined, returns a filtered list of Payout Channel objects matching the query parameter.\n",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Payouts_PayoutChannelResponseSchema"
                  }
                },
                "examples": {
                  "getPaymentChannelsResponseExample": {
                    "value": [
                      {
                        "channel_code": "ID_BSI",
                        "channel_category": "BANK",
                        "currency": "IDR",
                        "channel_name": "Bank Syariah Indonesia",
                        "amount_limits": {
                          "minimum": "10000",
                          "maximum": "1999999999999",
                          "minimum_increment": "1"
                        }
                      },
                      {
                        "channel_code": "PH_AUB",
                        "channel_category": "BANK",
                        "currency": "PHP",
                        "channel_name": "Asia United Bank",
                        "amount_limits": {
                          "minimum": "1",
                          "maximum": "100000000",
                          "minimum_increment": "1"
                        }
                      }
                    ]
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
      "Payouts_CurrencyQueryParams": {
        "in": "query",
        "name": "currency",
        "schema": {
          "$ref": "#/components/schemas/Payouts_Currency"
        }
      },
      "Payouts_ChannelCategoryQueryParams": {
        "in": "query",
        "name": "currency",
        "schema": {
          "$ref": "#/components/schemas/Payouts_ChannelCategory"
        }
      },
      "Payouts_ChannelCodeQueryParams": {
        "in": "query",
        "name": "currency",
        "schema": {
          "$ref": "#/components/schemas/Payouts_ChannelCode"
        }
      }
    },
    "schemas": {
      "Payouts_PayoutChannelResponseSchema": {
        "type": "object",
        "properties": {
          "channel_name": {
            "type": "string",
            "description": "Name of payout channel"
          },
          "channel_category": {
            "$ref": "#/components/schemas/Payouts_ChannelCategory"
          },
          "channel_code": {
            "$ref": "#/components/schemas/Payouts_ChannelCode"
          },
          "currency": {
            "$ref": "#/components/schemas/Payouts_Currency"
          },
          "amount_limits": {
            "type": "object",
            "description": "Object containing amount limitations imposed by the channel.",
            "properties": {
              "minimum": {
                "type": "number",
                "description": "Minimum amount that can be paid out to this channel"
              },
              "maximum": {
                "type": "number",
                "description": "Maximum amount that can be paid out to this channel"
              },
              "minimum_increment": {
                "type": "number",
                "description": "Smallest amount increment allowed by the channel"
              }
            }
          }
        }
      },
      "Payouts_Currency": {
        "type": "string",
        "description": "ISO 4217 Currency Code."
      },
      "Payouts_ChannelCategory": {
        "type": "string",
        "enum": [
          "BANK",
          "EWALLET",
          "OTC"
        ]
      },
      "Payouts_ChannelCode": {
        "type": "string",
        "description": "Channel code of destination bank, E-Wallet or OTC channel. \nList of supported channels can be found [here](https://docs.xendit.co/xendisburse/channel-codes)\n",
        "example": "ID_BCA"
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

