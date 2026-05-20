# Custom Slug Best Practices Research

## How competitors handle it

### Shopify
- User picks store name during onboarding → slug auto-generated
- Can change subdomain later in Settings → Store details
- Format: `mybakery.myshopify.com`
- Reserved: admin, www, api, checkout, etc.

### Wix
- Auto-gen from account name: `username.wixsite.com/sitename`
- Can connect custom domain but cannot change Wix subdomain

### Squarespace
- User picks during signup, cannot change later
- Format: `mybusiness.squarespace.com`

## Validation rules (industry standard)
- 3-63 chars (DNS label limit)
- Lowercase alphanumeric + hyphens only
- Cannot start/end with hyphen
- Cannot be numeric-only (avoid IP confusion)
- Reserved words blocklist: admin, www, api, app, mail, ftp, etc.

## UX patterns
1. **Onboarding step**: ask business name → auto-suggest slug → user can edit
2. **Settings page**: editable with "change subdomain" button + confirmation
3. **Real-time availability check**: debounced API call as user types
4. **Migration handling**: old slug → 301 redirect to new slug for SEO

## Security considerations
- Prevent subdomain takeover: validate ownership on every request
- Rate limit slug change (max 3/month)
- Block offensive/trademark slugs
- Log slug changes for audit trail
