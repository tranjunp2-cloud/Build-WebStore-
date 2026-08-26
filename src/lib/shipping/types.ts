export interface ShippingConfig {
    enabled?: boolean | null
    westRate?: number | null   // sen (800 = RM 8)
    eastRate?: number | null   // sen (1500 = RM 15)
    freeAbove?: number | null  // sen threshold; null = no free shipping
}
