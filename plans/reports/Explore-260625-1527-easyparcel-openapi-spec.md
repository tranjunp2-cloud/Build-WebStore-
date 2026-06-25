# EasyParcel OpenAPI 2026-03 Specification — Complete API Contract

**Report Date:** 2026-06-25  
**Source:** https://github.com/easyparcel/OpenAPI (main branch, 2026-03 release)  
**Documentation Site:** https://easyparcel.github.io/OpenAPI/  
**Raw Spec Files:** https://raw.githubusercontent.com/easyparcel/OpenAPI/main/source/includes/2026-03/

---

## 1. OAuth 2.0 Authentication (REQUIRED)

### Authorization Flow
- **Type:** Authorization Code Grant
- **Grant Types:** Authorization Code only
- **Authorization Endpoint:** `https://api.easyparcel.com/oauth/login`
- **Token Endpoint:** `https://api.easyparcel.com/oauth/token`

### OAuth Flow Steps
1. Client redirects to authorization endpoint with `client_id`, `redirect_uri`, optional `state`
2. User logs in to EasyParcel and selects account (Demo or Live)
3. User grants access, browser redirects to `redirect_uri?code={auth_code}&state={state}`
4. Client POSTs to token endpoint with:
   - `grant_type` = `authorization_code`
   - `code` (from redirect)
   - `redirect_uri`
   - `state` (optional)
   - Header: `Authorization: Basic {base64(client_id:client_secret)}`

### Token Response
```json
{
  "token_type": "Bearer",
  "expires_in": 36000,
  "expires_at": "2024-12-12T13:03:23.013Z",
  "access_token": "string",
  "refresh_token": "string",
  "refresh_token_expires_in": 31557600,
  "refresh_token_expires_at": "2025-12-12T09:03:23.013Z",
  "app": {
    "client_id": "string",
    "callbackUrls": [],
    "redirectUris": ["string"]
  }
}
```

**Token Lifetimes:**
- Access token: 36,000 seconds (10 hours)
- Refresh token: 31,557,600 seconds (1 year)

### Using Access Token
All API requests require header:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Refresh Token Flow
POST to token endpoint with:
- `grant_type` = `refresh_token`
- `refresh_token` (from previous response)
- Same Basic auth header

---

## 2. Base URLs

| Environment | Base URL |
|---|---|
| **Production** | `https://api.easyparcel.com/open_api/2026-03` |
| **Sandbox** | Same endpoint with sandbox OAuth credentials |

All examples use production base URL; swap OAuth tokens for sandbox testing.

---

## 3. Core Endpoints — Standard Shipping

### 3.1 POST /shipment/quotations
**Get shipping rates from all available couriers.**

**Request Body:**
```json
{
  "shipment": [
    {
      "sender": {
        "postcode": "10150",
        "subdivision_code": "MY-07",
        "country": "MY"
      },
      "receiver": {
        "postcode": "11950",
        "subdivision_code": "MY-07",
        "country": "MY"
      },
      "weight": 1.5,
      "width": 5,
      "length": 5,
      "height": 5,
      "parcel_value": 50
    }
  ]
}
```

**Request Parameters:**

| Field | Type | Required | Notes |
|---|---|---|---|
| shipment | array | Yes | Array of shipment quotation requests |
| sender.postcode | string(10) | Yes | Sender postcode |
| sender.subdivision_code | string(35) | Yes | ISO 3166-2 code (e.g., "MY-07") |
| sender.country | string(2) | Yes | ISO 3166-1 alpha-2 code (e.g., "MY") |
| receiver.postcode | string(10) | Yes | Receiver postcode |
| receiver.subdivision_code | string(35) | Yes | ISO 3166-2 code |
| receiver.country | string(2) | Yes | ISO 3166-1 alpha-2 code |
| weight | double(8,2) | Yes | Weight in KG |
| width | double(8,2) | No | Width in CM |
| length | double(8,2) | No | Length in CM |
| height | double(8,2) | No | Height in CM |
| parcel_value | double(8,2) | No | Parcel value (account currency) |

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "request_id": "unique-id",
  "message": "1 request success, 0 request error.",
  "data": [
    {
      "status": "success",
      "input": { /* echo of request */ },
      "quotations": [
        {
          "courier": {
            "service_id": "EP-CS096",
            "service_name": "Aramex (Pick Up)",
            "courier_id": "EP-CR0AP",
            "courier_name": "Aramex",
            "courier_logo": "url",
            "delivery_duration": null,
            "service_tag": [
              {
                "name": "Service Destinations",
                "value": "Domestic"
              }
            ],
            "is_pickup": true,
            "is_dropoff": false
          },
          "pricing": {
            "currency": "MYR",
            "total_amount": "10.84",
            "shipment_price": "9.80",
            "shipment_tax": "0.59",
            "total_features_price": "0.45",
            "total_features_tax": "0.00"
          },
          "features": [
            {
              "cod": {
                "available": true,
                "min_cod_amount": "MYR10.00",
                "max_cod_amount": "MYR1000.00",
                "min_cod_charges": "MYR10.00",
                "cod_charging_rate": "4.00%",
                "charges_description": "4.00% of the parcel value or MYR10.00, whichever is higher"
              }
            },
            {
              "sms_tracking": {
                "sms_price": "0.20",
                "custom_sms_price": "0.05",
                "remove_ep_branding_price": "0.05",
                "sms_tax": "0.00"
              }
            },
            {
              "email_tracking": {
                "email_price": "0.05",
                "custom_email_price": "0.05"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Key Response Fields:**
- `courier.service_id`: Use in submit_orders request
- `courier.courier_id`: Unique courier identifier
- `pricing`: Breakdown of shipment cost + taxes
- `features`: COD, SMS, Email, WhatsApp tracking options with pricing
- **COD Details:** min/max amounts, charging rates (percentage or fixed, whichever higher)

---

### 3.2 POST /shipment/submit_orders
**Create shipment orders with selected courier and features.**

**Request Body:**
```json
{
  "coupon_codes": ["77f39c22-427a-44f1-8bff-e4f3752ba165"],
  "shipment": [
    {
      "reference": "order-1190",
      "service_id": "EP-CS096",
      "collection_date": "2025-05-19",
      "weight": 1.5,
      "height": 5,
      "length": 5,
      "width": 5,
      "item": [
        {
          "content": "Electronics",
          "weight": 0.5,
          "height": 5,
          "length": 5,
          "width": 5,
          "currency_code": "MYR",
          "value": 50,
          "quantity": 1
        }
      ],
      "sender": {
        "name": "John Doe",
        "company": "ABC Corp",
        "phone_number_country_code": "MY",
        "phone_number": "1126760658",
        "email": "test@easyparcel.com",
        "address_1": "123 Main St",
        "address_2": "Apt 4B",
        "postcode": "10150",
        "city": "Lunas",
        "subdivision_code": "MY-07",
        "country_code": "MY"
      },
      "receiver": {
        "name": "Jane Smith",
        "company": "XYZ Inc",
        "phone_number_country_code": "MY",
        "phone_number": "1163042981",
        "email": "test@easyparcel.com",
        "address_1": "456 High St",
        "address_2": "Floor 2",
        "postcode": "11950",
        "city": "Bayan Lepas",
        "subdivision_code": "MY-07",
        "country_code": "MY"
      },
      "feature": {
        "sms_tracking": true,
        "email_tracking": true,
        "whatsapp_tracking": true,
        "awb_branding": false
      }
    }
  ]
}
```

**Request Parameters:**

| Field | Type | Required | Notes |
|---|---|---|---|
| coupon_codes | array | No | Array of coupon UUIDs to apply |
| shipment | array | Yes | Array of shipment objects |
| shipment[].reference | string | No | Custom order reference |
| shipment[].service_id | string(10) | Yes | From quotation response |
| shipment[].collection_date | date | Yes | Format: YYYY-MM-DD |
| shipment[].weight | double(8,2) | Yes | Weight in KG |
| shipment[].width/length/height | double(8,2) | Yes | Dimensions in CM |
| shipment[].item | array | Yes | Array of parcel items |
| shipment[].item[].content | string | Yes | Item description |
| shipment[].item[].weight | double(8,2) | Yes | Item weight in KG |
| shipment[].item[].width/length/height | double(8,2) | Yes | Item dimensions in CM |
| shipment[].item[].currency_code | string | Yes | "MYR" or other currency |
| shipment[].item[].value | double(8,2) | Yes | Item value |
| shipment[].item[].quantity | int | Yes | Item quantity |
| shipment[].sender.name | string | Yes | Sender name |
| shipment[].sender.company | string | No | Company name |
| shipment[].sender.phone_number_country_code | string | Yes | ISO country code |
| shipment[].sender.phone_number | string | Yes | Phone without country prefix |
| shipment[].sender.email | string | No | Email address |
| shipment[].sender.address_1 | string | Yes | Primary address |
| shipment[].sender.address_2 | string | No | Secondary address |
| shipment[].sender.postcode | string | Yes | Postcode |
| shipment[].sender.city | string | Yes | City name |
| shipment[].sender.subdivision_code | string | No | ISO 3166-2 code |
| shipment[].sender.country_code | string(2) | Yes | ISO 3166-1 alpha-2 |
| shipment[].sender.point_code | string | No | Drop-off point identifier |
| shipment[].receiver.* | object | Yes | Same structure as sender |
| shipment[].feature.sms_tracking | bool | Yes | Enable SMS tracking |
| shipment[].feature.email_tracking | bool | Yes | Enable email tracking |
| shipment[].feature.whatsapp_tracking | bool | Yes | Enable WhatsApp tracking |
| shipment[].feature.awb_branding | bool | Yes | Custom AWB branding |

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "Orders submitted successfully",
  "data": [
    {
      "shipment_number": "ES-2601-K8S32",
      "order_number": "EI-2601-U8FZW",
      "status": "success",
      "awb_number": "960301021838937",
      "tracking_url": "https://app.easyparcel.com/tools/easytrack/details?courier=..."
    }
  ]
}
```

**Response Fields:**
- `shipment_number`: EasyParcel tracking reference (format: ES-YYMM-XXXXX)
- `order_number`: Internal order identifier
- `awb_number`: Courier airway bill number
- `tracking_url`: Customer-facing tracking URL

---

### 3.3 POST /shipment/list
**Retrieve list of shipments with filtering and pagination.**

**Request Body:**
```json
{
  "limit": 10,
  "before_shipment_number": "ES-2601-K8S32",
  "shipment_status_code": "7",
  "date_from": "2025-04-01",
  "date_to": "2025-04-23"
}
```

**Request Parameters:**

| Field | Type | Required | Notes |
|---|---|---|---|
| limit | int | No | 1-250 (default: 10) |
| before_shipment_number | string | No | For pagination cursor |
| shipment_status_code | string | No | Filter by status (see status codes) |
| date_from | date | No | Start date (YYYY-MM-DD) |
| date_to | date | No | End date (YYYY-MM-DD) |

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "success",
  "data": [
    {
      "shipment_number": "ES-2504-X2KV5",
      "awb_number": "960301021838937",
      "awb_url": "https://s3.../consignment_note.pdf",
      "tracking_url": "https://app.easyparcel.com/...",
      "shipment_status_code": 7,
      "shipment_status": "Schedule In Arrangement",
      "coll_date": "2025-04-30 00:00:00",
      "courier": {
        "service_type": "City-Link Express (Drop-Off)",
        "courier_id": "EP-CR0D9",
        "service_id": "EP-CS0D9",
        "courier_name": "City-Link Express (M) Sdn. Bhd.",
        "courier_short_name": "City-Link Express",
        "courier_logo": "url"
      },
      "sender_details": {
        "name": "Afiq",
        "email": "afiq@easyparcel.com",
        "contact": "MY124651303",
        "alternative_contact": 0,
        "address1": "No 4",
        "subdivision_code": "MY-02",
        "postal_code": "06000",
        "country": "MY"
      },
      "receiver_details": {
        "name": "Afiq Receiver",
        "email": "afiq@easyparcel.com",
        "contact": "MY124651303",
        "alternative_contact": 0,
        "subdivision_code": "MY-07",
        "postal_code": "11900",
        "country": "MY"
      },
      "pricing": {
        "currency_code": "MYR",
        "price": 5.65
      }
    }
  ],
  "pagination": {
    "next_page_token": "...",
    "next_shipment_number": "ES-2504-QBURU",
    "has_more": true,
    "limit": 10
  }
}
```

**Pagination:** Use `next_shipment_number` as `before_shipment_number` for next page (cursor-based, sorted newest first).

---

### 3.4 POST /shipment/details
**Get detailed information for a specific shipment.**

**Request Body:**
```json
{
  "shipment_number": "ES-2601-K8S32"
}
```

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "success",
  "data": [
    {
      "shipment_number": "ES-2601-K8S32",
      "order_number": "EI-2601-U8FZW",
      "shipment_details": {
        "weight": 1.5,
        "height": 5,
        "length": 5,
        "width": 5,
        "shipment_status_code": 7,
        "shipment_status": "Schedule In Arrangement",
        "parcels_value": "100",
        "insurance_label": "basic",
        "awb_number": null,
        "awb_url": null,
        "tracking_url": null,
        "coll_date": "2025-05-19 00:00:00",
        "reference": null
      },
      "parcel_content": [
        {
          "content": "Electronics",
          "weight": "0.50000",
          "height": 5,
          "length": 5,
          "width": 5,
          "value": 50,
          "currency_code": "MYR"
        }
      ],
      "courier": {
        "courier_name": "Aramex",
        "service_id": "EP-CS0AP",
        "courier_id": "EP-CR0AP",
        "courier_logo": "url",
        "service_types": "Aramex (Pick Up)"
      },
      "sender": {
        "name": "John Doe",
        "company_name": "ABC Corp",
        "email": "test@easyparcel.com",
        "contact": "+601126760658",
        "alternative_contact": null,
        "subdivision_code": "MY-07",
        "postal_code": "10150",
        "country": "MY",
        "address1": "123 Main St",
        "address2": "Apt 4B",
        "city": "Lunas"
      },
      "receiver": { /* similar structure */ },
      "pricing": {
        "currency_code": "MYR",
        "total_price": "0.00",
        "shipment_price": "9.80",
        "tax_price": "0.00",
        "sms_notification": "0.00",
        "email_notification": "0.00",
        "whatsapp_notification": "0.00"
      }
    }
  ]
}
```

---

### 3.5 POST /shipment/cancel
**Cancel one or more shipments.**

**Request Body:**
```json
{
  "cancel_list": [
    {
      "shipment_number": "ES-2601-K8S32",
      "remark": "Customer request"
    }
  ]
}
```

**Request Parameters:**

| Field | Type | Required | Notes |
|---|---|---|---|
| cancel_list | array | Yes | Array of cancellations |
| cancel_list[].shipment_number | string | Yes | Format: ES-YYMM-XXXXX |
| cancel_list[].remark | string | Yes | Cancellation reason |

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "2 requests success, 0 request error.",
  "data": [
    {
      "status": "success",
      "message": "Shipment Cancelled",
      "shipment_number": "ES-2602-4VW9E"
    },
    {
      "status": "error",
      "message": "The shipment cancellation period is over (7 days from collection date)",
      "shipment_number": "ES-2602-VC4KV"
    }
  ]
}
```

**Constraints:**
- Only cancellable within 7 days of collection date
- Cannot cancel already-processed shipments
- Each shipment processed independently; check individual `status` field

---

### 3.6 POST /shipment/tracking_status
**Get tracking status for multiple shipments.**

**Request Body:**
```json
{
  "awb_numbers": ["7028021894371796", "960301021838937"]
}
```

**Request Parameters:**

| Field | Type | Required | Notes |
|---|---|---|---|
| awb_numbers | array | Yes | Max 100 AWB numbers per request |

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "3 requests success, 0 request error.",
  "data": {
    "results": [
      {
        "status": "success",
        "awb_number": "7028021894371796",
        "shipment_number": "ES-2602-VC4KV",
        "order_number": "EI-2602-4P2SK",
        "latest_shipment_status_code": 7,
        "latest_tracking_status": "Schedule In Arrangement",
        "latest_event_date": "2026-01-23T04:28:52.494Z",
        "status_log": [
          {
            "event_date": "2026-01-23 12:29:47",
            "shipment_status_code": 7,
            "tracking_status": "Shipment data received - Awaiting Parcel Handover to DHL",
            "location": "Kuala Lumpur Hub, Kuala Lumpur, MY"
          },
          {
            "event_date": "2026-01-23 12:28:52",
            "shipment_status_code": 7,
            "tracking_status": "Data Submitted - Awaiting Parcel Handover to DHL",
            "location": "BAYAN BARU, PENANG, PIN, MY"
          }
        ]
      },
      {
        "status": "not_found",
        "awb_number": "invalid_awb",
        "message": "AWB number not found"
      }
    ]
  }
}
```

**Response Fields:**
- `status`: "success" or "not_found"
- `latest_shipment_status_code`: Numeric status code (see codes below)
- `status_log`: Chronological history of all tracking events
- Date format: "YYYY-MM-DD HH:MM:SS" (UTC)

---

## 4. Shipment Status Codes

| Code | Description |
|---|---|
| 0 | Cancel |
| 2 | To Be Collected |
| 3 | Collected |
| 4 | Delivery In Transit |
| 5 | Delivered |
| 6 | Returned |
| 7 | Schedule In Arrangement |
| 8 | On Hold |
| 11 | Drop Off |

---

## 5. Courier & Location Endpoints

### 5.1 GET /courier/list
**Get available couriers by country.**

**Query Parameters:**
```
country_code=MY
```

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "success",
  "data": [
    {
      "courier_id": "EP-CR0AP",
      "uuid": "01e1cad9-d20a-411f-8c71-a1b3ed722b3f",
      "courier_name": "Aramex",
      "short_name": "Aramex",
      "courier_logo": "url",
      "country": "Malaysia"
    },
    {
      "courier_id": "EP-CR0AW",
      "uuid": "db129869-d2cd-474a-b3bf-9995a436ef85",
      "courier_name": "DHL eCommerce",
      "short_name": "DHLeC",
      "courier_logo": "url",
      "country": "Malaysia"
    }
  ]
}
```

**Supported Countries:**
- MY (Malaysia)
- SG (Singapore)

---

### 5.2 POST /courier/get_courier_dropoff_points
**Find drop-off locations for a courier.**

**Request Body:**
```json
{
  "courier_id": "EP-CR0AP",
  "country_code": "MY",
  "postcode": "10150",
  "city": "Lunas",
  "state_code": "MY-07"
}
```

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "Success",
  "data": [
    {
      "point_id": "EP-CB0FF",
      "name": "Pejabat Pos Besar Pulau Pinang",
      "address_1": "Tingkat Bawah, Bangunan Tuanku Syed Putra",
      "address_2": "Leboh Downing",
      "address_3": "",
      "address_4": "",
      "postcode": "10670",
      "city": "Pulau Pinang",
      "state": "png",
      "phone_number": "04-2619222",
      "info": "",
      "image": "",
      "start_time": "08:00:00",
      "end_time": "13:00:00"
    }
  ]
}
```

**Key Fields:**
- `point_id`: Use as `point_code` in submit_orders (sender/receiver)
- `start_time`, `end_time`: Operating hours (24-hour format, HH:MM:SS)
- Results sorted by proximity to provided postcode

---

## 6. Account & Wallet Endpoints

### 6.1 GET /wallet
**Check account wallet balance and free credits.**

**Request:** No body required  
**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "Success",
  "data": {
    "wallet": [
      {
        "balance": 9999999123.88,
        "currency": "MYR"
      }
    ],
    "free_credit_wallet": [
      {
        "balance": 0,
        "currency": "MYR"
      }
    ]
  }
}
```

**Note:** Balance is deducted upon shipment submission, not quotation.

---

### 6.2 POST /account/get_account_information
**Retrieve account details and default addresses.**

**Request:** No body required  
**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "request_id": "unique-id",
  "message": "Success",
  "data": {
    "account": {
      "name": "Test User",
      "account_type": "Personal"
    },
    "address": {
      "pickup_address": {
        "name": "Ahmad Firdaus",
        "phone_number": "123456789",
        "alternate_phone_number": null,
        "email": "user@example.com",
        "company_name": null,
        "address1": "No. 25, Jalan SS15/8A",
        "address2": null,
        "postcode": "47500",
        "city": "Subang Jaya",
        "province_code": "MY-10",
        "country_code": "MY"
      },
      "billing_address": { /* similar */ },
      "delivery_address": { /* similar */ }
    }
  }
}
```

**Account Types:** Personal, Business

---

## 7. Coupon Endpoints

### 7.1 GET /shipment/get_coupon_list
**Retrieve available coupons for a shipment.**

**Request Body:**
Same structure as submit_orders shipment array (to validate eligibility)

**Response (HTTP 200):**
```json
{
  "status_code": 200,
  "message": "4 coupon(s) available",
  "data": {
    "account_id": 438368,
    "currency_code": "MYR",
    "coupons": [
      {
        "coupon_code": "77f39c22-427a-44f1-8bff-e4f3752ba165",
        "title": "Test Coupon 1",
        "description": "Test discount",
        "discounted_amount": "5.01",
        "discount_rate": "20.00%",
        "valid_from_date": "2025-05-12 18:04:33",
        "valid_to_date": "2025-12-14 18:04:33"
      }
    ]
  }
}
```

**Usage:** Pass `coupon_code` in `coupon_codes` array when submitting orders.

---

## 8. On-Demand Shipping Endpoints

**Available endpoints (documented but not detailed here):**
- POST `/ondemand/quotation` — Same-day delivery pricing
- POST `/ondemand/shipment/submit` — Book on-demand pickup
- GET `/ondemand/coupon/list` — On-demand coupons
- POST `/ondemand/shipment/cancel` — Cancel on-demand order

**Response structure similar to standard shipping.** On-demand orders return driver assignment and real-time coordinates.

---

## 9. Webhooks

### Available Topics
| Topic ID | Topic Name | Description |
|---|---|---|
| 1 | Shipment Status Update | Shipment status code changes |
| 2 | Shipment AWB Update | AWB assigned to shipment |
| 3 | Tracking Status Update | Tracking event logged |
| 4 | Shipment Created | Shipment order submitted |
| 5 | Ondemand Order Status Update | On-demand order status changes |

### Example Payloads

**shipment.status.update:**
```json
{
  "topic": "shipment.status.update",
  "awb_number": "238725129086",
  "event_date": "2017-10-28 11:40:00",
  "shipment_number": "ES-2504-G7FDF",
  "shipment_status": "Cancelled",
  "shipment_status_code": 0
}
```

**shipment.awb.update:**
```json
{
  "topic": "shipment.awb.update",
  "shipment_number": "ES-2504-G7FDF",
  "uuid": "webhook-test-uuid-123",
  "timestamp": "2017-10-28 11:40:00",
  "awb_number": "23872512999",
  "awb_url": "http://...",
  "tracking_url": "https://..."
}
```

**shipment.tracking.update:**
```json
{
  "topic": "shipment.tracking.update",
  "shipment_number": "ES-2504-G7FDF",
  "awb_number": "238725129086",
  "latest_shipment_status_code": 5,
  "latest_tracking_status": "Delivered To Suntech",
  "timestamp": "2017-10-28 11:40:00",
  "status_log": [
    {
      "timestamp": "2017-10-28 11:40:00",
      "shipment_status_code": 5,
      "tracking_status": "Delivered To Suntech"
    }
  ]
}
```

**Configure via:** Developer Hub > Apps > Settings > Webhook > Add Endpoint

---

## 10. Error Handling

### HTTP Status Codes
| Code | Meaning |
|---|---|
| 200 | Success (check individual `status` fields in array responses) |
| 400 | Bad Request — Invalid parameters |
| 401 | Unauthorized — Invalid/expired OAuth token |
| 403 | Forbidden — Insufficient permissions |
| 404 | Not Found — Resource not found |
| 429 | Too Many Requests — Rate limit exceeded |
| 500 | Internal Server Error — Server problem |
| 503 | Service Unavailable — Maintenance |

### Error Response Format
```json
{
  "status_code": 400,
  "message": "Descriptive error message",
  "data": null
}
```

**Important:** Array responses (quotations, cancel, etc.) return HTTP 200 with individual item `status: "success"` or `status: "error"`. Always validate each item.

---

## 11. Rate Limiting & Best Practices

- **Rate Limit:** Not explicitly documented; implement exponential backoff on 429
- **Batch Requests:** Quotations, cancellations, tracking support batching (up to 100 per request for tracking)
- **Always use HTTPS** for all communications
- **Store credentials securely** — never expose client_secret in client-side code
- **Access token caching** — tokens valid for 10 hours; refresh before expiry
- **Validate individual responses** — HTTP 200 may include partial failures

---

## 12. COD (Cash on Delivery) Implementation

### In Quotation Response
Each quotation includes COD availability:
```json
"cod": {
  "available": true,
  "min_cod_amount": "MYR10.00",
  "max_cod_amount": "MYR1000.00",
  "min_cod_charges": "MYR10.00",
  "cod_charging_rate": "4.00%",
  "charges_description": "4.00% of the parcel value or MYR10.00, whichever is higher"
}
```

### COD-Supporting Couriers
- Aramex
- DHL eCommerce
- J&T Express
- Flash Express

**Note:** COD charges are calculated by courier; specify via `feature` object in submit_orders (specific COD amount field not exposed in 2026-03 spec — may need to infer from pricing or contact EasyParcel support for COD-specific request format).

---

## 13. Key Implementation Notes

### Weight & Dimension Units
- **Weight:** KG (double, 8,2 precision)
- **Dimensions (width/length/height):** CM (double, 8,2 precision)
- All dimensions required for accurate pricing from most couriers

### Address Fields
- **Sender/Receiver:** name, email, phone_number, phone_number_country_code, address_1, address_2, postcode, city, subdivision_code, country_code
- **Optional:** company, alternate_phone_number, point_code (for drop-off)
- Subdivision codes must be ISO 3166-2 format (e.g., "MY-07" for Penang, "MY-14" for Kuala Lumpur)

### Collection Date
- Format: YYYY-MM-DD
- Determines when parcel will be picked up
- For drop-off, collection_date should be same day or next business day

### Shipment Number Format
- Pattern: `ES-YYMM-XXXXX` (e.g., ES-2601-K8S32)
- Used in all queries, cancellations, tracking

### Parcel Content
- Each item in `item` array requires: content, weight, dimensions, value, currency_code, quantity
- Used for customs/documentation and valuation

---

## 14. Sandbox Environment

- **Base URL:** Same production URL; differentiated by OAuth credentials
- **Free Test Credits:** Available; top up via Developer Hub
- **Limitations:**
  - Shipment statuses do not advance through delivery stages
  - Tracking notifications (SMS/Email/WhatsApp) not sent
  - Useful for integration/UAT only; not for production testing

---

## 15. Version History Notes (2025-06 → 2026-03)

**Key differences observed:**
- Version 2026-03 uses OAuth 2.0 (NEW); older versions used API keys
- Endpoint paths changed to `/open_api/2026-03/`
- Response format standardized with `status_code`, `request_id`, `message`, `data` wrapper
- New pagination using cursor-based `before_shipment_number` vs. offset-based
- Tracking now supports batch (100 AWB per request)
- Webhook topics expanded to include OnDemand
- Address structure enhanced with subdivision_code and point_code support

---

## 16. Unresolved Questions

1. **COD Amount Specification:** Spec shows COD available/pricing in quotation, but submit_orders request doesn't show explicit COD amount field. How is COD amount specified when creating order? May need to contact EasyParcel support.

2. **Refresh Token Rotation:** Does refresh token rotate on use, or single-use? Documentation shows `refresh_token` in response but doesn't clarify rotation behavior.

3. **Insurance Endpoint:** Spec mentions `/shipment/insurance` and `/shipment/insurance/quotation` but details not in 2026-03 markdown files. Full schema unknown.

4. **OnDemand Vehicle Types:** OnDemand endpoint references vehicle preference and pricing tiers but specific vehicle types not listed (e.g., motorcycle vs. van).

5. **Webhook Signature Verification:** No mention of HMAC signing, callback validation, or retry strategy in webhook documentation.

6. **Malaysia E-Invoice (MyInvois):** Endpoint `/malaysia/invois/submit` mentioned but schema not detailed in provided docs.

7. **Rate Limiting Headers:** No documentation of rate-limit headers in response (e.g., X-RateLimit-Remaining). Behavior on 429 not specified.

8. **Webhook Delivery Guarantees:** No mention of at-least-once vs. exactly-once delivery semantics.

---

## Raw Specification Sources

- **GitHub Repository:** https://github.com/easyparcel/OpenAPI
- **Branch:** main
- **Version Directory:** source/includes/2026-03/
- **Documentation Site:** https://easyparcel.github.io/OpenAPI/
- **Developer Portal:** https://api.easyparcel.com/

**Key Files in 2026-03 Directory:**
- `_authentication.md` — OAuth 2.0 flow
- `_quotation.md` — Shipment quotations
- `_submitorder.md` — Order submission
- `_shipmentlisting.md` — Shipment list & pagination
- `_shipmentdetail.md` — Shipment details
- `_cancelshipment.md` — Cancellation
- `_tracking_status.md` — Tracking with status codes
- `_courierlist.md` — Courier listing
- `_dropoff_point.md` — Drop-off locations
- `_wallet.md` — Wallet balance
- `_get_account_info.md` — Account information
- `_coupon.md` — Coupon management
- `_webhooks.md` — Webhook topics & payloads
- `_errors.md` — HTTP error codes
- `_sandbox.md` — Sandbox environment setup
- `_features.md` — API features overview

---

**Report Generated:** 2026-06-25 | **API Version:** 2026-03 | **Last Updated:** 2026-01-15 (per GitHub commits)
