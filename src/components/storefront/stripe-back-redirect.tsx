/**
 * Parse-time inline script: when a page that redirected to Stripe is shown again (browser Back
 * from Stripe Checkout — no-store fresh load OR bfcache), redirect to the order's confirm page in
 * the "payment not completed" state instead of leaving the buyer on checkout/tracking.
 *
 * The redirecting page sets `sessionStorage.pw_stripe_pending = { orderId, slug }` right before
 * `location.href = stripeUrl`. This script (placed before the page content) consumes that flag on
 * the next show and `location.replace`s to the confirm page — no flash of the original page.
 *
 * Used by the checkout page (place-order flow) and the order-tracking page (retry-payment flow)
 * so browser-Back behaves identically to Stripe's own cancel button (cancel_url → confirm?cancelled=1).
 */
export function StripeBackRedirectScript() {
    return (
        <script
            dangerouslySetInnerHTML={{
                __html: `(function(){try{var keys=['pw_stripe_pending','pw_xendit_pending'];for(var i=0;i<keys.length;i++){var r=sessionStorage.getItem(keys[i]);if(r){sessionStorage.removeItem(keys[i]);var d=JSON.parse(r);if(d&&d.orderId&&d.slug){location.replace('/sites/'+encodeURIComponent(d.slug)+'/order/'+encodeURIComponent(d.orderId)+'/confirm?cancelled=1');return;}}}}catch(e){}})();`,
            }}
        />
    )
}
