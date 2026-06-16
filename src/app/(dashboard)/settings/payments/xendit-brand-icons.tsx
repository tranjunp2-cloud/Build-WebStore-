import React from 'react';

export function TngIcon() {
    return <img src="/images/payment/tng.svg" alt="Touch 'n Go" width={34} height={32} className="rounded-[6px]" />;
}

export function GrabPayIcon() {
    return <img src="/images/payment/grabpay.svg" alt="GrabPay" width={30} height={30} />;
}

export function ShopeePayIcon() {
    return <img src="/images/payment/shopeepay.svg" alt="ShopeePay" width={30} height={30} />;
}

export function BoostIcon() {
    return <img src="/images/payment/boost.png" alt="Boost" width={32} height={32} className="rounded-[6px]" />;
}

export function MaeIcon() {
    return <img src="/images/payment/mae.webp" alt="MAE by Maybank" width={34} height={34} className="rounded-[8px]" />;
}

export function DuitNowQrIcon() {
    return (
        <span className="inline-flex items-center justify-center w-[40px] h-[40px] rounded-[8px]" style={{ background: '#DA291C' }}>
            <img src="/images/payment/duitnow-qr.png" alt="DuitNow QR" width={34} height={30} className="object-contain" />
        </span>
    );
}

export function FpxIcon() {
    return (
        <span className="inline-flex items-center justify-center w-[46px] h-[16px] rounded-[4px]" style={{ background: '#003087' }}>
            <img src="/images/payment/fpx.png" alt="FPX" width={42} height={14} className="object-contain" />
        </span>
    );
}
