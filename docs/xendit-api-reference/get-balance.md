---
title: "Get balance"
slug: "get-balance"
updated: 2025-11-04T09:17:47Z
published: 2025-11-26T06:31:12Z
---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.xendit.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get balance

Get/balance

Balance is like your wallet since it will tell you how much money is available to you on Xendit. You can retrieve it to see the current balance on your Xendit cash account. Your balance is debited on any money out transaction, e.g. when performing disbursements or Xendit fees are charged. Your balance is credited when money comes into your account.

SecurityHTTPType basic

API Key authentication using HTTPS Basic Auth. Use your API key as the username. The password field can be left empty. Note: In the API documentation "Try it" section, password is required, you may include any value.

Header parametersfor-user-idstring

The sub-account user-id that you want to make this transaction for.

This header is only used if you have access to xenPlatform. See xenPlatform for more information

Query parametersaccount_typestring

The selected balance type

Valid values[
  "CASH",
  "HOLDING"
]Default"CASH"
at_timestampstring (date-time) 

ISO 8601 date-time format (URI encoded)

Balance returned in the response will be based on the timestamp provided. The timestamp value must be URI encoded when passed as a query parameter.

Example2024-01-01T00:00:00Z
currencystring

Currency filter for customers with multi-currency accounts. Only the following currencies are supported for balance and balance history:

- IDR, PHP, USD, VND, THB, MYR, SGD, EUR, GBP, HKD, AUD

Valid values[
  "IDR",
  "PHP",
  "USD",
  "VND",
  "THB",
  "MYR",
  "SGD",
  "EUR",
  "GBP",
  "HKD",
  "AUD"
]

Responses200

Successful operation

<select class='api-response-data' aria-label='Media type'><option value='35fd3765-da13-4ad0-b2a9-7eb1b8bb4fe5'>application/json</option>
</select>object  balanceinteger  (float)    Example1241231

400

Inputs are failing validation. The errors field contains details about which fields are violating validation.

<select class='api-response-data' aria-label='Media type'><option value='e4766930-4b38-45f1-b54f-3ca091058727'>application/json</option>
</select>object  error_codestring    Valid values[
  "API_VALIDATION_ERROR",
  "FEATURE_NOT_AVAILABLE"
]
messagestring    
errors Array  OneOfstringstring
objectobject
