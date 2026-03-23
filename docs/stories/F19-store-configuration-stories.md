# F19 Store Configuration — User Stories

> **Epic:** Store Setup & Configuration
> **Feature Code:** F19
> **Status:** Draft

## Feature Overview
Allows store owners to configure store-wide settings, currently focusing on Domain Management (adding custom domains, setting primary domains, and DNS instructions).

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 📋 Story Index

| Story ID | Title | Status | Priority |
|----------|-------|--------|----------|
| US-F19-01 | Add Custom Domain | Draft | P1 |
| US-F19-02 | Set Primary Domain | Draft | P1 |
| US-F19-03 | Configure Payment Methods | Draft | P0 |
| US-F19-04 | Mobile Web UX — Camera Roll & Tap-to-Copy | Ready | P1 |
| US-F19-05 | Invite Staff & Role Assignment | Draft | P0 |
| US-F19-06 | Manage Staff Directory & Removal | Draft | P0 |

---

## 📝 User Stories

### US-F19-01: Add Custom Domain
**As a** Store Owner
**I want to** add an externally purchased custom domain to my store
**So that** my customers can access my store via my branded domain name.

#### Acceptance Criteria
1. **Domain Input:**
   - **Given** I am on the Configuration > Domains page
   - **When** I click "Add Custom Domain" and enter my domain (e.g., `mystore.com`)
   - **Then** the system verifies the domain format and availability within the platform.
2. **DNS Instructions:**
   - **Given** the domain is added
   - **Then** I am provided with the needed DNS records to configure at my registrar (e.g., A Record pointing to the system IP, CNAME pointing to the system domain).
   - **And** the status of the domain is set to "Pending Verification".
3. **Verification:**
   - **Given** my domain is "Pending Verification"
   - **When** I click "Verify Connection"
   - **Then** the system checks the DNS records. If matched, the status changes to "Connected" and SSL is provisioned automatically.

#### Edge Cases
- The domain is already linked to another tenant in the platform.
- The user enters an invalid URL format.

---

### US-F19-02: Set Primary Domain
**As a** Store Owner
**I want to** choose which domain is the primary domain
**So that** all traffic correctly routes and canonicalizes to my preferred brand name.

#### Acceptance Criteria
1. **Change Primary Domain:**
   - **Given** I have multiple Connected domains (including the default `.echprime.com` subdomain)
   - **When** I select "Set as Primary" on a Connected custom domain
   - **Then** it is marked as the "Primary Domain" with a visual badge.
2. **Redirect Behavior:**
   - **Given** a new primary domain is set
   - **Then** all traffic hitting the other non-primary domains (or the default subdomain) should perform a 301 Permanent Redirect to the Primary Domain to ensure SEO integrity.
3. **Default Domain Constraints:**
   - **Given** the default platform subdomain
   - **Then** it can never be deleted, but it can be demoted from Primary.

#### Edge Cases
- Attempting to set an unverified/pending domain as Primary (Should be disabled).

---

### US-F19-03: Configure Payment Methods
**As a** Store Owner
**I want to** configure the payment methods available on my storefront, including COD and QR Banking
**So that** I can offer flexible payment options while ensuring I collect payment proofs correctly.

#### Acceptance Criteria
1. **Toggle Payment Methods:**
   - **Given** I am in the Store Configuration > Payments section
   - **When** I view the list of payment methods
   - **Then** I can enable or disable COD and QR Banking independently. Both can be active at the same time.
2. **Uploading QR Code for QR Banking:**
   - **Given** I want to enable "QR Banking"
   - **When** I attempt to toggle it "ON" without uploading an image
   - **Then** the system prevents enabling and prompts me to upload a QR code image.
   - **When** I upload an image, it MUST be strictly under 2MB and format JPG/PNG, otherwise an error is shown.
3. **Disabling QR Banking upon Deletion:**
   - **Given** QR Banking is enabled and has a valid QR image
   - **When** I delete the uploaded QR image
   - **Then** the system automatically disables the "QR Banking" payment method for my store.

---

### US-F19-04: Mobile Web UX — Camera Roll & Tap-to-Copy
**As a** mobile store owner
**I want to** easily copy DNS records or upload QR codes directly from my phone
**So that** I don't get frustrated typing long IPs or transferring images from PC to phone.

#### Acceptance Criteria
1. **Camera Roll Integration:**
   - **Given** I am configuring QR Banking on my phone
   - **When** I tap "Upload Image"
   - **Then** the native iOS/Android camera roll picker is triggered, allowing me to easily select an image from my device.
2. **Tap-to-Copy DNS:**
   - **Given** I am viewing the DNS instructions
   - **When** I tap the "Copy" icon next to the CNAME or A Record
   - **Then** the value is copied instantly, and a success Toast confirms the action, optimized for easy pasting into my mobile registrar app.

---

### US-F19-05: Invite Staff & Role Assignment
**As a** Store Owner (Seller)
**I want to** invite my staff members and assign them specific roles
**So that** I can securely delegate tasks without sharing my master credentials.

#### Acceptance Criteria
1. **Invite Staff:**
   - **Given** I am in the Store Configuration > Staff Management tab
   - **When** I click "Invite New Staff" and enter a valid email address
   - **Then** the system checks if the email is already in the Tenant. If not, it creates a "Pending" invitation and sends a Welcome Email.
2. **Assign Full Access Role:**
   - **Given** I am inviting or editing a Staff member
   - **When** I select the "Full Access" role
   - **Then** that staff member is granted Workspace Admin privileges (access to all modules except billing and workspace deletion).
3. **Assign Custom Role:**
   - **Given** I am inviting or editing a Staff member
   - **When** I select the "Custom" role
   - **Then** a list of checkboxes appears (e.g., Products, Orders, Blog, Builder). I MUST check at least one.
   - **And** the staff member will only be able to view and interact with the selected modules when they log in.

#### Edge Cases
- Email address is already active on another Tenant (Support multi-tenant if architecture allows, otherwise error).
- Unchecking all features when using the "Custom" role (Should disable the Save button).

---

### US-F19-06: Manage Staff Directory & Removal
**As a** Store Owner
**I want to** view all my invited staff and remove their access if necessary
**So that** I maintain complete control over who can access my store's backend.

#### Acceptance Criteria
1. **View Directory:**
   - **Given** I am on the Staff Management tab
   - **When** the page loads
   - **Then** I see a list of my staff displaying their Avatar, Email, Role (Full Access or Custom [Feature List]), and Status (Pending or Active).
2. **Remove Access (Revoke):**
   - **Given** a Staff member is in the list
   - **When** I click the "Remove" button and confirm the destructive action modal
   - **Then** their access to the current Workspace is immediately revoked (Soft Deleted or Unlinked).
   - **And** they are forced to log out if they are currently active.
3. **Owner Protection:**
   - **Given** I am the original Creator/Owner of the Workspace
   - **Then** my account cannot be removed from the Staff Directory by anyone.

#### Edge Cases
- Revoking a Pending invite (cancels the invitation token).
