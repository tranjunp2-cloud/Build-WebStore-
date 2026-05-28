import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
    if (stripeInstance) return stripeInstance

    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

    stripeInstance = new Stripe(key, {
        typescript: true,
    })

    return stripeInstance
}
