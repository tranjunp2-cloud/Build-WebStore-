export const TY_CSS = `
*{box-sizing:border-box;}
.ty-page{
  --tl:var(--accent,#0e7556);--tl7:var(--accent-hover,#095e44);--tl2:rgba(var(--accent-rgb,14,117,86),.22);--tl5:rgba(var(--accent-rgb,14,117,86),.07);--tlb:rgba(var(--accent-rgb,14,117,86),.30);
  --f1:var(--text-primary,#0c1014);--f2:var(--text-secondary,#2a3138);--f3:var(--text-muted,#7b8390);--f4:var(--muted,#a8b0b9);
  --card:var(--surface-card,var(--surface,#fff));
  --inp:color-mix(in srgb,var(--card) 91%,var(--f1) 9%);
  --bd:color-mix(in srgb,var(--card) 80%,var(--f1) 20%);
  --bd2:color-mix(in srgb,var(--card) 90%,var(--f1) 10%);
  --bd3:var(--ck-border-3,#d8dde2);
  --sh:0 1px 2px rgba(15,23,42,.04),0 4px 14px -8px rgba(15,23,42,.10);
  --hf:var(--font-heading,'Outfit',sans-serif);--bf:var(--font-body,'Inter',system-ui,sans-serif);
  font-family:var(--bf);color:var(--f1);background:var(--background,#eff1f3);min-height:100vh;display:flex;flex-direction:column;
}
.ty-hd{position:sticky;top:0;z-index:4;background:var(--card);border-bottom:1px solid var(--bd);padding:18px 28px;display:flex;align-items:center;gap:14px;}
.ty-back{width:36px;height:36px;border-radius:10px;background:var(--inp);border:1px solid var(--bd);display:grid;place-items:center;color:var(--f2);text-decoration:none;flex-shrink:0;transition:background .15s;}
.ty-back:hover{background:color-mix(in srgb,var(--card) 82%,var(--f1) 18%);}
.ty-h1{font-family:var(--hf);font-size:18px;font-weight:800;letter-spacing:-.005em;margin:0;color:var(--f1);}
.ty-crumbs{font-size:12px;color:var(--f3);margin-left:auto;display:flex;align-items:center;gap:8px;}
.ty-crumbs strong{color:var(--tl7);font-weight:700;}
.ty-crumbs>svg{color:var(--f4);}
.ty-ssl{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tl7);background:var(--tl2);border:1px solid var(--tl7);border-radius:999px;margin-left:8px;}
.ty-shell{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;padding:28px;align-items:start;}
.ty-left{display:flex;flex-direction:column;gap:18px;}
.ty-right{position:sticky;top:90px;align-self:start;}
/* Hero */
.ty-hero{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:36px 28px 28px;text-align:center;position:relative;overflow:hidden;}
.ty-hero::before{content:"";position:absolute;inset:-40% 30% auto 30%;height:180px;background:radial-gradient(ellipse at center,var(--tl5) 0%,transparent 70%);pointer-events:none;}
.ty-hero.pending::before{background:radial-gradient(ellipse at center,#fff4dc 0%,transparent 70%);}
.ty-check-wrap{position:relative;width:84px;height:84px;margin:0 auto 18px;}
.ty-check{position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,var(--tl) 0%,var(--tl7) 100%);display:grid;place-items:center;color:#fff;box-shadow:0 0 0 6px #fff,0 0 0 7px var(--tl2),0 16px 30px -10px rgba(var(--accent-rgb,14,117,86),.40);animation:tyCheckPop 520ms cubic-bezier(.22,1,.36,1);}
.ty-check.warning{background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);box-shadow:0 0 0 6px #fff,0 0 0 7px #fde0a8,0 16px 30px -10px rgba(217,119,6,.40);animation:tyCheckPop 520ms cubic-bezier(.22,1,.36,1),tyWarnPulse 2.4s ease-in-out 520ms infinite;}
.ty-check.info{background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);box-shadow:0 0 0 6px #fff,0 0 0 7px #c4daff,0 16px 30px -10px rgba(37,99,235,.42);animation:tyCheckPop 520ms cubic-bezier(.22,1,.36,1),tyInfoPulse 2.6s ease-in-out 520ms infinite;}
@keyframes tyCheckPop{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}
@keyframes tyWarnPulse{0%,100%{box-shadow:0 0 0 6px #fff,0 0 0 7px #fde0a8,0 16px 30px -10px rgba(217,119,6,.40),0 0 0 0 rgba(245,158,11,.40);}50%{box-shadow:0 0 0 6px #fff,0 0 0 7px #fde0a8,0 16px 30px -10px rgba(217,119,6,.40),0 0 0 10px rgba(245,158,11,0);}}
@keyframes tyInfoPulse{0%,100%{box-shadow:0 0 0 6px #fff,0 0 0 7px #c4daff,0 16px 30px -10px rgba(37,99,235,.42),0 0 0 0 rgba(59,130,246,.40);}50%{box-shadow:0 0 0 6px #fff,0 0 0 7px #c4daff,0 16px 30px -10px rgba(37,99,235,.42),0 0 0 10px rgba(59,130,246,0);}}
.ty-hero.submitted::before{background:radial-gradient(ellipse at center,#e6f0ff 0%,transparent 70%);}
.ty-ring{position:absolute;inset:0;border-radius:999px;border:2px solid rgba(var(--accent-rgb,14,117,86),.55);opacity:0;pointer-events:none;animation:tyRing 2.4s ease-out infinite;}
.ty-ring.r2{animation-delay:1.2s;}
@keyframes tyRing{0%{transform:scale(.95);opacity:.55;}100%{transform:scale(1.7);opacity:0;}}
.ty-hero-title{font-family:var(--hf);font-size:26px;font-weight:800;letter-spacing:-.01em;color:var(--f1);margin:0 0 12px;position:relative;}
.ty-hero-order{display:inline-flex;align-items:center;gap:8px;padding:7px 10px 7px 14px;background:var(--inp);border:1px solid var(--bd);border-radius:999px;font-size:12px;font-weight:600;color:var(--f3);margin:0 0 14px;position:relative;letter-spacing:.02em;}
.ty-order-id{font-family:monospace;color:var(--f1);font-weight:700;font-size:13px;letter-spacing:0;}
.ty-hero-badge{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;border:1px solid;}
.ty-hero-badge.tone-amber{background:#fff4dc;border-color:#f1d693;color:#8a5c0a;}
.ty-hero-badge.tone-teal{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
.ty-hero-badge.tone-blue{background:#e6f0ff;border-color:#c4daff;color:#1e40af;}
.ty-copy-btn{width:24px;height:24px;border-radius:999px;background:var(--card);border:1px solid var(--bd);color:var(--f2);display:grid;place-items:center;transition:all .14s;cursor:pointer;}
.ty-copy-btn:hover,.ty-copy-btn.copied{background:var(--tl5);color:var(--tl);border-color:var(--tl2);}
.ty-hero-sub{font-size:14px;line-height:1.6;color:var(--f3);max-width:520px;margin:0 auto;position:relative;}
/* Block cards */
.ty-bank-block,.ty-upload-block{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:24px 26px;position:relative;}
.ty-bank-block-compact{padding:18px 22px;}
.ty-block-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px;}
.ty-block-head-compact{align-items:center;margin-bottom:14px;gap:12px;}
.ty-block-num{font-family:var(--hf);font-size:22px;font-weight:800;color:var(--tl);letter-spacing:-.01em;flex-shrink:0;line-height:1;padding-top:2px;width:30px;}
.ty-block-head-compact .ty-block-num{font-size:18px;padding-top:0;width:24px;}
.ty-block-titles{flex:1;min-width:0;}
.ty-block-titles h3{font-family:var(--hf);font-size:17px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--f1);margin:0 0 4px;}
.ty-block-head-compact .ty-block-titles h3{font-size:15px;letter-spacing:.06em;}
.ty-block-titles p{font-size:12.5px;color:var(--f3);margin:0;line-height:1.5;}
.ty-amount-chip{display:inline-flex;align-items:baseline;gap:4px;padding:7px 13px;background:var(--tl5);border:1px solid var(--tl2);border-radius:999px;font-family:var(--hf);font-size:16px;font-weight:800;color:var(--tl7);flex-shrink:0;white-space:nowrap;}
.ty-amount-chip .ccy{font-size:11px;font-weight:700;opacity:.7;}
/* Step pills */
.ty-step-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;flex-shrink:0;}
.ty-step-pill.pending{background:#fff4dc;border:1px solid #f1d693;color:#8a5c0a;}
.ty-step-pill.done{background:var(--tl5);border:1px solid var(--tl2);color:var(--tl7);}
.ty-step-pill.blue{background:#e6f0ff;border:1px solid #c4daff;color:#1e40af;}
/* Unified (stripe/cod) block */
.ty-bank-block.ty-unified{padding:20px 22px;}
.ty-block-head.no-num{margin-bottom:12px;}
.ty-bank-block.ty-unified .ty-paid-card,.ty-bank-block.ty-unified .ty-cod-card{padding:14px 16px;}
.ty-bank-block.ty-unified .ty-paid-meta{margin-top:10px;}
.ty-bank-block.ty-unified .ty-paid-meta li{padding:9px 14px;min-height:38px;}
.ty-bank-block.ty-unified .ty-cod-tips{margin-top:10px;gap:6px;}
.ty-bank-block.ty-unified .ty-cod-tips li{padding:8px 12px;}
.ty-bank-block.ty-unified .ty-email-note{margin-top:10px;padding:10px 12px;}
/* Bank Transfer layout */
.ty-bank-block .manual-top{display:grid;grid-template-columns:minmax(180px,220px) minmax(0,1fr);gap:12px;align-items:stretch;margin-top:4px;}
.qr-side{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px;background:var(--inp);border:1px solid var(--bd);border-radius:12px;}
.ty-qr-img{width:128px;height:128px;border-radius:6px;object-fit:contain;}
.ty-qr-ph{width:128px;height:128px;display:grid;place-items:center;background:var(--card);border:2px dashed var(--tlb);border-radius:8px;color:var(--tl);}
.scan-hint{font-size:10.5px;color:var(--f3);text-align:center;line-height:1.4;}
.bank-side{display:flex;flex-direction:column;gap:0;}
.bank-rows{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;}
.bank-row{display:grid;grid-template-columns:110px 1fr auto;gap:10px;align-items:center;padding:9px 14px;min-height:38px;}
.bank-row+.bank-row{border-top:1px solid var(--bd2);}
.bk-label{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--f3);}
.bk-value{font-size:12.5px;font-weight:600;color:var(--f1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bk-value.mono{font-family:monospace;letter-spacing:.02em;}
.bk-value.accent{color:var(--tl7);font-weight:700;}
.copy-btn{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;font-size:11px;font-weight:700;color:var(--f2);background:var(--card);border:1px solid var(--bd);border-radius:7px;transition:all .14s;cursor:pointer;white-space:nowrap;flex-shrink:0;}
.copy-btn:hover,.copy-btn.copied{background:var(--tl5);color:var(--tl);border-color:var(--tl2);}
.ty-memo-note{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:9px 12px;background:color-mix(in srgb,var(--tl) 7%,var(--inp));border:1px solid color-mix(in srgb,var(--tl) 28%,var(--bd2));border-radius:10px;font-size:11.5px;line-height:1.5;color:var(--f3);}
.ty-memo-note svg{color:var(--tl7);flex-shrink:0;margin-top:2px;}
.ty-memo-note strong{color:var(--f1);font-weight:700;}
/* Stripe paid card */
.ty-paid-card{display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--tl5);border:1px solid var(--tl2);border-radius:14px;}
.ty-paid-icon{width:44px;height:44px;border-radius:999px;background:var(--tl);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 4px 12px -4px rgba(var(--accent-rgb,14,117,86),.40);}
.ty-paid-body{flex:1;min-width:0;}
.ty-paid-title{font-size:14px;font-weight:600;color:var(--f1);line-height:1.5;margin:0 0 3px;}
.ty-paid-title strong{color:var(--tl7);font-weight:800;}
.ty-paid-sub{font-size:12px;color:var(--f3);margin:0;}
.ty-paid-brands{display:flex;align-items:center;gap:5px;flex-shrink:0;}
.brand-mark{display:inline-flex;align-items:center;justify-content:center;height:22px;border-radius:4px;font-size:9px;font-weight:900;letter-spacing:.04em;border:1px solid;}
.brand-mark.visa{width:36px;background:#1a1f71;color:#fff;border-color:#1a1f71;}
.brand-mark.mc{width:30px;background:transparent;border-color:var(--bd);gap:0;padding:0 4px;}
.brand-mark.mc .mc-circles{display:flex;}
.brand-mark.mc .mc-circles span{width:14px;height:14px;border-radius:999px;}
.brand-mark.mc .mc-circles span:first-child{background:#eb001b;margin-right:-6px;}
.brand-mark.mc .mc-circles span:last-child{background:#f79e1b;}
.brand-mark.amex{width:36px;background:#016fcf;color:#fff;border-color:#016fcf;}
.brand-mark.fpx{width:32px;background:#f60;color:#fff;border-color:#f60;}
.ty-paid-meta{list-style:none;margin:12px 0 0;padding:0;background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;}
.ty-paid-meta li{display:grid;grid-template-columns:150px 1fr auto;gap:10px;align-items:center;padding:10px 14px;min-height:40px;}
.ty-paid-meta li+li{border-top:1px solid var(--bd2);}
.ty-paid-meta .lbl{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--f3);}
.ty-paid-meta .val{font-size:12.5px;color:var(--f1);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-paid-meta .val.mono{font-family:monospace;letter-spacing:.01em;}
.ty-paid-meta .val strong{font-weight:700;}
/* COD card */
.ty-cod-card{display:flex;align-items:center;gap:16px;padding:20px;background:#f5f8ff;border:1px solid #d6e2fb;border-radius:14px;}
.ty-cod-icon{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 6px 18px -6px rgba(37,99,235,.45);}
.ty-cod-body{flex:1;min-width:0;}
.ty-cod-title{font-size:15px;font-weight:700;color:var(--f1);line-height:1.45;margin:0 0 4px;}
.ty-cod-title strong{font-weight:800;color:#1e3a8a;background:rgba(59,130,246,.10);padding:1px 7px;border-radius:6px;font-family:monospace;}
.ty-cod-sub{font-size:12.5px;color:var(--f3);margin:0;line-height:1.55;}
.ty-cod-tips{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px;}
.ty-cod-tips li{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--inp);border:1px solid var(--bd2);border-radius:10px;font-size:12.5px;color:var(--f2);line-height:1.5;}
.ty-cod-tips svg{color:var(--tl7);margin-top:2px;flex-shrink:0;}
/* Email note */
.ty-email-note{display:flex;align-items:flex-start;gap:9px;padding:12px 14px;margin-top:14px;background:var(--inp);border:1px solid var(--bd2);border-radius:10px;font-size:12.5px;color:var(--f3);line-height:1.55;}
.ty-email-note svg{color:var(--tl7);flex-shrink:0;margin-top:2px;}
.ty-email-note strong{color:var(--f2);font-weight:700;}
/* Items */
.ty-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;}
.ty-item{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;}
.ty-item-th{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);overflow:hidden;}
.ty-item-th img{width:100%;height:100%;object-fit:cover;}
.ty-item-info{min-width:0;}
.ty-item-top{display:flex;align-items:baseline;gap:8px;min-width:0;position:relative;}
.ty-item-top[data-tooltip]:hover::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 7px);left:0;background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:500;padding:6px 10px;border-radius:7px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;z-index:20;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.22);}
.ty-item-nm{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--f1);margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-item-var{font-size:11px;color:var(--f4);margin:0 0 2px;}
.ty-item-qty{font-size:11px;color:var(--f3);margin:0;}
.ty-item-pr{font-size:13px;font-weight:600;color:var(--f2);white-space:nowrap;font-family:monospace;flex-shrink:0;}
/* Summary card */
.summary-card{background:var(--card);border-radius:16px;box-shadow:var(--sh);padding:22px;display:flex;flex-direction:column;}
.summary-head{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0 0 14px;}
.summary-items{list-style:none;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--bd);display:flex;flex-direction:column;gap:10px;}
.summary-item{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:start;}
.item-thumb{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--tl5),var(--tl2));border:1px solid var(--bd);display:grid;place-items:center;color:var(--tl);overflow:hidden;flex-shrink:0;}
.item-thumb img{width:100%;height:100%;object-fit:cover;}
.item-info{min-width:0;}
.item-name{font-size:13px;font-weight:600;color:var(--f1);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.item-meta{font-size:11px;color:var(--f3);margin:3px 0 0;}
.qty{display:inline-block;padding:1px 6px;background:var(--inp);border-radius:999px;font-size:10px;color:var(--f2);margin-right:4px;font-family:monospace;}
.item-price{font-size:12.5px;font-weight:600;color:var(--f2);white-space:nowrap;font-family:monospace;flex-shrink:0;align-self:center;}
.summary-line{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;}
.summary-line .lbl{color:var(--f3);}
.summary-line .val{font-family:monospace;font-weight:500;color:var(--f2);white-space:nowrap;}
.summary-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0 0;padding-top:16px;border-top:1px solid var(--bd);}
.t-lbl{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);}
.t-val{font-family:var(--hf);font-size:28px;font-weight:800;letter-spacing:-.01em;color:var(--tl);white-space:nowrap;}
.t-val .ccy{font-size:13px;font-family:monospace;font-weight:500;color:var(--tl);margin-right:4px;}
/* Summary status */
.ty-summary-status{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:10px;}
.ty-summary-status.tone-amber{background:#fff4dc;border:1px solid #f1d693;}
.ty-summary-status.tone-amber .ty-status-dot{background:#8a5c0a;animation-name:pulseAmber;}
.ty-summary-status.tone-amber .ty-status-line1{color:#8a5c0a;}
.ty-summary-status.tone-amber .ty-status-line2{color:#6a4807;}
.ty-summary-status.tone-teal{background:var(--tl5);border:1px solid var(--tl2);}
.ty-summary-status.tone-teal .ty-status-dot{background:var(--tl);animation-name:pulseTeal;}
.ty-summary-status.tone-teal .ty-status-line1{color:var(--tl7);}
.ty-summary-status.tone-teal .ty-status-line2{color:#0a5a40;}
.ty-summary-status.tone-blue{background:#e6f0ff;border:1px solid #c4daff;}
.ty-summary-status.tone-blue .ty-status-dot{background:#2563eb;animation-name:pulseBlue;}
.ty-summary-status.tone-blue .ty-status-line1{color:#1e40af;}
.ty-summary-status.tone-blue .ty-status-line2{color:#1d4ed8;}
.ty-status-dot{width:8px;height:8px;border-radius:999px;flex-shrink:0;animation:pulseAmber 2s ease-in-out infinite;}
@keyframes pulseAmber{0%,100%{box-shadow:0 0 0 0 rgba(138,92,10,.5);}50%{box-shadow:0 0 0 6px rgba(138,92,10,0);}}
@keyframes pulseTeal{0%,100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb,14,117,86),.45);}50%{box-shadow:0 0 0 6px rgba(var(--accent-rgb,14,117,86),0);}}
@keyframes pulseBlue{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.45);}50%{box-shadow:0 0 0 6px rgba(37,99,235,0);}}
.ty-status-line1{font-size:12.5px;font-weight:800;letter-spacing:.01em;margin:0;}
.ty-status-line2{font-size:11.5px;margin:2px 0 0;}
/* Summary meta */
.ty-summary-meta{display:flex;flex-direction:column;gap:8px;margin:14px 0 18px;padding:14px 4px 0;border-top:1px solid var(--bd);}
.ty-meta-row{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--f3);line-height:1.45;}
.ty-meta-row svg{color:var(--tl7);margin-top:2px;flex-shrink:0;}
.ty-meta-row strong{color:var(--f2);font-weight:700;}
/* CTA row */
.ty-cta-row{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.ty-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:.01em;transition:all 160ms ease;white-space:nowrap;cursor:pointer;border:none;text-decoration:none;}
.ty-btn.primary{background:var(--tl);color:#fff;box-shadow:0 4px 12px -4px rgba(var(--accent-rgb,14,117,86),.40);}
.ty-btn.primary:hover{background:var(--tl7);}
.ty-btn.outline{background:#fff;border:1px solid var(--bd3);color:var(--f1);}
.ty-btn.outline:hover{background:var(--inp);border-color:var(--f4);}
.ty-btn.ghost{background:transparent;color:var(--f2);border:1px solid var(--bd);}
.ty-btn.ghost:hover{background:var(--inp);color:var(--f1);}
.ty-btn.lg{height:44px;font-size:13.5px;}
.ty-btn:disabled{opacity:.55;cursor:not-allowed;}
.ty-upload-actions .ty-btn.primary{margin-left:auto;}
.summary-trust{display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--f3);}
/* Upload required */
.ty-upload-required{border:1.5px solid var(--tl2);animation:tyRequiredPulse 2.6s ease-in-out infinite;}
@keyframes tyRequiredPulse{0%,100%{border-color:var(--tl2);box-shadow:var(--sh),0 0 0 0 rgba(14,117,86,.32);}50%{border-color:var(--tl);box-shadow:var(--sh),0 0 0 8px rgba(14,117,86,0);}}
.ty-upload-required::before{content:"";position:absolute;top:0;left:22px;right:22px;height:3px;background:linear-gradient(90deg,transparent 0%,var(--tl) 50%,transparent 100%);border-radius:0 0 4px 4px;opacity:.55;}
.ty-upload-required .ty-block-num{color:var(--tl);}
.ty-upload-required .ty-step-pill.pending{background:var(--tl);border-color:var(--tl);color:#fff;}
.ty-upload-required .ty-dz-icon{animation:tyIconNudge 2.2s ease-in-out infinite;}
@keyframes tyIconNudge{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
/* Dropzone */
.ty-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:36px 24px;text-align:center;border:1.5px dashed var(--tl2);border-radius:14px;background:repeating-linear-gradient(135deg,rgba(14,117,86,.06) 0 12px,transparent 12px 24px),var(--tl5);color:var(--tl7);cursor:pointer;transition:all 160ms ease;}
.ty-dropzone:hover,.ty-dropzone.dragging{border-color:var(--tl);background:var(--tl5);transform:translateY(-1px);box-shadow:0 8px 24px -12px rgba(14,117,86,.35);}
.ty-dz-icon{width:56px;height:56px;border-radius:16px;background:#fff;border:1px solid var(--tl2);display:grid;place-items:center;color:var(--tl);box-shadow:0 4px 12px -4px rgba(14,117,86,.20);}
.ty-dz-title{font-size:15px;font-weight:700;color:var(--f1);margin-top:2px;}
.ty-dz-sub{font-size:12px;color:var(--f3);font-weight:500;}
.ty-dz-btn{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:8px 14px;background:#fff;border:1px solid var(--tl2);color:var(--tl7);font-size:12.5px;font-weight:700;border-radius:8px;transition:all 140ms ease;cursor:pointer;}
.ty-dz-btn:hover{background:var(--tl);color:#fff;border-color:var(--tl);}
.ty-dropzone.horizontal{flex-direction:row;align-items:center;text-align:left;gap:14px;padding:14px 16px;}
.ty-dropzone.horizontal .ty-dz-icon{width:40px;height:40px;border-radius:12px;margin:0;flex-shrink:0;}
.ty-dropzone.horizontal .ty-dz-text{flex:1;min-width:0;}
.ty-dropzone.horizontal .ty-dz-title{font-size:13.5px;font-weight:700;margin-top:0;line-height:1.3;}
.ty-dropzone.horizontal .ty-dz-sub{font-size:11.5px;margin-top:2px;font-weight:500;}
.ty-dropzone.horizontal .ty-dz-btn{margin-top:0;height:36px;padding:0 14px;font-size:12.5px;flex-shrink:0;}
/* File card */
.ty-file-card{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--inp);border:1px solid var(--bd);border-radius:12px;}
.ty-file-thumb{width:44px;height:44px;border-radius:10px;background:var(--tl5);border:1px solid var(--tl2);color:var(--tl);display:grid;place-items:center;flex-shrink:0;}
.ty-file-info{flex:1;min-width:0;}
.ty-file-name{font-size:14px;font-weight:700;color:var(--f1);margin:0 0 3px;letter-spacing:-.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ty-file-meta{font-family:monospace;font-size:11.5px;color:var(--f3);letter-spacing:.01em;}
.ty-file-x{width:30px;height:30px;border-radius:8px;color:var(--f3);display:grid;place-items:center;transition:all 160ms ease;flex-shrink:0;background:none;border:none;cursor:pointer;}
.ty-file-x:hover{background:rgba(239,68,68,.10);color:#b91c1c;}
/* Success state */
.ty-success-state{display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--tl5);border:1px solid var(--tl2);border-radius:12px;animation:tyFadeIn 320ms cubic-bezier(.22,1,.36,1);}
@keyframes tyFadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.ty-success-icon{width:40px;height:40px;border-radius:999px;background:var(--tl);color:#fff;display:grid;place-items:center;flex-shrink:0;box-shadow:0 4px 12px -4px rgba(14,117,86,.40);}
.ty-success-text{flex:1;min-width:0;}
.ty-success-title{font-size:14px;font-weight:800;color:var(--tl7);margin:0 0 2px;}
.ty-success-sub{font-size:12.5px;color:var(--f3);margin:0;line-height:1.45;}
/* Upload actions */
.ty-upload-actions{display:flex;gap:10px;margin-top:14px;}
.ty-upload-error{font-size:12.5px;color:#b91c1c;margin:8px 0 0;padding:8px 12px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.20);border-radius:8px;}
@keyframes tySpin{to{transform:rotate(360deg);}}
.ty-spin{display:inline-block;animation:tySpin 1s linear infinite;}
/* Mobile */
@media(max-width:768px){
  .ty-hd{padding:14px 16px;}
  .ty-crumbs{display:none;}
  .ty-shell{grid-template-columns:1fr;padding:16px;gap:16px;}
  .ty-left{order:1;}
  .ty-right{order:2;position:static;}
  .ty-hero{padding:28px 18px 22px;}
  .ty-check-wrap{width:68px;height:68px;margin-bottom:14px;}
  .ty-hero-title{font-size:22px;}
  .ty-hero-sub{font-size:13px;}
  .ty-bank-block,.ty-upload-block{padding:18px 16px;}
  .ty-bank-block-compact{padding:16px 14px;}
  .ty-hero-order{flex-wrap:wrap;justify-content:center;}
  .ty-hero-badge{margin-left:0;}
  .ty-bank-block .manual-top{display:flex!important;flex-direction:column;gap:12px;}
  .qr-side{justify-content:center;}
  .ty-cod-card{flex-wrap:wrap;padding:16px;gap:12px;}
  .ty-paid-card{flex-wrap:wrap;padding:14px;gap:10px;}
  .ty-paid-brands{width:100%;justify-content:flex-start;}
  .ty-paid-meta li{grid-template-columns:1fr;gap:4px;padding:10px 14px;}
  .summary-card{padding:18px 16px;border-radius:14px;}
  .t-val{font-size:22px;}
  .ty-dropzone.horizontal{flex-wrap:wrap;}
  .ty-dropzone.horizontal .ty-dz-btn{width:100%;justify-content:center;margin-top:4px;}
  .ty-upload-actions{flex-direction:column;}
  .ty-upload-actions .ty-btn.primary{margin-left:0;width:100%;}
}
`
