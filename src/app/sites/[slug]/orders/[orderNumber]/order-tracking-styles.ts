export const OT_CSS = `
*{box-sizing:border-box;}
.ot-page{
  --tl:var(--accent,#0e7556);--tl7:var(--accent-hover,#095e44);
  --tl2:rgba(var(--accent-rgb,14,117,86),.22);--tl1:rgba(var(--accent-rgb,14,117,86),.12);
  --tl5:rgba(var(--accent-rgb,14,117,86),.07);--tlb:rgba(var(--accent-rgb,14,117,86),.30);
  --f1:var(--text-primary,#0c1014);--f2:var(--text-secondary,#2a3138);
  --f3:var(--text-muted,#7b8390);--f4:var(--muted,#a8b0b9);
  --card:var(--surface-card,var(--surface,#fff));
  --inp:color-mix(in srgb,var(--card) 91%,var(--f1) 9%);
  --bd:color-mix(in srgb,var(--card) 80%,var(--f1) 20%);
  --bd2:color-mix(in srgb,var(--card) 90%,var(--f1) 10%);
  --bd3:color-mix(in srgb,var(--card) 73%,var(--f1) 27%);
  --sh:0 1px 2px rgba(15,23,42,.04),0 4px 14px -8px rgba(15,23,42,.10);
  --shp:0 4px 24px -8px rgba(15,23,42,.18);
  --rc:16px;
  --hf:var(--font-heading,'Outfit',sans-serif);
  --bf:var(--font-body,'Inter',system-ui,sans-serif);
  --mf:'JetBrains Mono','Fira Mono','Courier New',monospace;
  --amb1:#fff4dc;--ambfg:#8a5c0a;
  font-family:var(--bf);color:var(--f1);background:var(--background,#eff1f3);min-height:100vh;display:flex;flex-direction:column;
}
.ot-page .ck-header{position:sticky;top:0;z-index:4;background:var(--card);border-bottom:1px solid var(--bd);padding:18px 28px;display:flex;align-items:center;gap:14px;}
.ot-page .ck-header h1{font-family:var(--hf);font-size:18px;font-weight:800;letter-spacing:-.005em;margin:0;color:var(--f1);}
.ot-page .crumbs{font-size:12px;color:var(--f3);display:flex;align-items:center;gap:8px;}
.ot-page .crumbs strong{color:var(--tl7);font-weight:700;}
.ot-page .crumbs svg{width:14px;height:14px;color:var(--f4);}
.ot-page .ck-shell{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;padding:24px 28px 32px;align-items:start;}
.ot-page .ck-form-col{display:flex;flex-direction:column;gap:16px;}
.ot-page .ck-summary-col{position:sticky;top:82px;align-self:start;}
.ot-shop-back{display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:7px 13px;font-size:12px;font-weight:700;color:var(--f2);background:var(--inp);border:1px solid var(--bd);border-radius:999px;text-decoration:none;transition:all 140ms ease;}
.ot-shop-back:hover{background:var(--bd2);color:var(--f1);}
.ot-shop-back svg{width:12px;height:12px;}
/* Order header card */
.ot-order-head{background:var(--card);border-radius:var(--rc);box-shadow:var(--sh);padding:24px 28px;display:grid;grid-template-columns:1fr auto;gap:18px 28px;align-items:center;position:relative;overflow:hidden;}
.ot-order-head::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--tl) 0%,var(--tl2) 60%,transparent 100%);}
.ot-oh-left{display:flex;flex-direction:column;gap:10px;min-width:0;}
.ot-oh-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:var(--tl7);}
.ot-oh-eyebrow svg{width:12px;height:12px;}
.ot-oh-id-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.ot-oh-id{font-family:var(--hf);font-size:28px;font-weight:800;letter-spacing:-.015em;color:var(--f1);line-height:1;}
.ot-oh-id .hash{color:var(--f4);margin-right:1px;}
.ot-oh-copy{width:28px;height:28px;border-radius:8px;background:var(--inp);border:1px solid var(--bd);color:var(--f2);display:grid;place-items:center;transition:all 140ms ease;cursor:pointer;}
.ot-oh-copy:hover{background:var(--tl5);border-color:var(--tl2);color:var(--tl);}
.ot-oh-copy svg{width:13px;height:13px;}
.ot-payment-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px 4px 8px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border:1px solid;white-space:nowrap;}
.ot-payment-chip .dot{width:6px;height:6px;border-radius:999px;display:inline-block;}
.ot-payment-chip.paid{background:var(--tl5);border-color:var(--tl2);color:var(--tl7);}
.ot-payment-chip.paid .dot{background:var(--tl);}
.ot-payment-chip.pending{background:var(--amb1);border-color:#f1d693;color:var(--ambfg);}
.ot-payment-chip.pending .dot{background:var(--ambfg);animation:otDotPulse 1.6s ease-in-out infinite;}
.ot-payment-chip.failed{background:#fef2f2;border-color:#fca5a5;color:#b91c1c;}
.ot-payment-chip.failed .dot{background:#ef4444;}
@keyframes otDotPulse{0%,100%{box-shadow:0 0 0 0 rgba(138,92,10,.50);}50%{box-shadow:0 0 0 5px rgba(138,92,10,0);}}
.ot-oh-meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;color:var(--f3);}
.ot-oh-meta>span{display:inline-flex;align-items:center;gap:6px;}
.ot-oh-meta svg{width:13px;height:13px;color:var(--f4);}
.ot-oh-meta strong{color:var(--f2);font-weight:600;}
.ot-status-badge{display:inline-flex;align-items:center;gap:12px;padding:14px 20px 14px 14px;border-radius:14px;white-space:nowrap;flex-shrink:0;border:1px solid;}
.ot-status-badge.in-transit{background:linear-gradient(135deg,#ecf6f0,#dcefe4);border-color:var(--tl2);}
.ot-status-badge.processing{background:linear-gradient(135deg,var(--amb1),#ffe7b8);border-color:#f1d693;}
.ot-status-badge.delivered{background:linear-gradient(135deg,var(--tl) 0%,#095e44 100%);border-color:var(--tl7);color:#fff;}
.ot-status-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;position:relative;}
.ot-status-badge.in-transit .ot-status-icon{background:var(--tl);color:#fff;box-shadow:0 6px 14px -6px rgba(14,117,86,.50);animation:otTruckBob 2.2s ease-in-out infinite;}
@keyframes otTruckBob{0%,100%{transform:translateX(0);}50%{transform:translateX(3px);}}
.ot-status-badge.processing .ot-status-icon{background:var(--ambfg);color:#fff;box-shadow:0 6px 14px -6px rgba(138,92,10,.45);}
.ot-status-badge.processing .ot-status-icon svg{animation:otSpinSlow 2.4s linear infinite;}
@keyframes otSpinSlow{to{transform:rotate(360deg);}}
.ot-status-badge.delivered .ot-status-icon{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.30);}
.ot-status-icon svg{width:22px;height:22px;}
.ot-status-text{display:flex;flex-direction:column;gap:1px;}
.ot-status-eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.75;}
.ot-status-badge.in-transit .ot-status-eyebrow{color:var(--tl7);}
.ot-status-badge.processing .ot-status-eyebrow{color:var(--ambfg);}
.ot-status-badge.delivered .ot-status-eyebrow{color:rgba(255,255,255,.85);}
.ot-status-title{font-family:var(--hf);font-size:18px;font-weight:800;letter-spacing:-.005em;}
.ot-status-badge.in-transit .ot-status-title{color:var(--tl7);}
.ot-status-badge.processing .ot-status-title{color:var(--ambfg);}
.ot-status-badge.delivered .ot-status-title{color:#fff;}
.ot-status-badge.cancelled{background:linear-gradient(135deg,#fef2f2,#fee2e2);border-color:#fca5a5;}
.ot-status-badge.cancelled .ot-status-icon{background:#ef4444;color:#fff;box-shadow:0 6px 14px -6px rgba(239,68,68,.45);}
.ot-status-badge.cancelled .ot-status-eyebrow{color:#b91c1c;}
.ot-status-badge.cancelled .ot-status-title{color:#b91c1c;}
.ot-status-badge.refunded{background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-color:#c4b5fd;}
.ot-status-badge.refunded .ot-status-icon{background:#7c3aed;color:#fff;box-shadow:0 6px 14px -6px rgba(124,58,237,.45);}
.ot-status-badge.refunded .ot-status-eyebrow{color:#6d28d9;}
.ot-status-badge.refunded .ot-status-title{color:#6d28d9;}
/* Stage tracker */
.ot-tracker{background:var(--card);border-radius:var(--rc);box-shadow:var(--sh);padding:26px 32px 22px;}
.ot-tracker-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:22px;}
.ot-tracker-head h3{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0;}
.ot-tracker-eta{font-size:12.5px;color:var(--f3);}
.ot-tracker-eta strong{font-family:var(--mf);color:var(--f1);font-weight:700;}
.ot-stages{display:grid;grid-template-columns:repeat(4,1fr);position:relative;padding:0 4px;}
.ot-stage{display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;gap:10px;min-width:0;}
.ot-stage-rail{position:absolute;top:20px;left:calc(50% + 24px);right:calc(-50% + 24px);height:4px;border-radius:999px;background:var(--bd);z-index:0;overflow:hidden;}
.ot-stage:last-child .ot-stage-rail{display:none;}
.ot-stage-rail::after{content:"";position:absolute;inset:0;background:var(--tl);transform-origin:left;transform:scaleX(0);transition:transform 600ms cubic-bezier(.22,1,.36,1);}
.ot-stage.done .ot-stage-rail::after{transform:scaleX(1);}
.ot-stage.active .ot-stage-rail::after{transform:scaleX(0.5);background:linear-gradient(90deg,var(--tl) 0%,var(--tl2) 100%);}
.ot-stage.pending .ot-stage-rail{background:repeating-linear-gradient(90deg,var(--bd) 0 8px,transparent 8px 14px);background-size:14px 100%;}
.ot-stage-node{width:44px;height:44px;border-radius:999px;background:#fff;border:2px solid var(--bd);display:grid;place-items:center;color:var(--f3);position:relative;z-index:1;transition:all 200ms ease;}
.ot-stage-node svg{width:18px;height:18px;}
.ot-stage.done .ot-stage-node{background:var(--tl);border-color:var(--tl);color:#fff;box-shadow:0 6px 14px -6px rgba(14,117,86,.55);}
.ot-stage.done .ot-stage-node svg{stroke-width:3;}
.ot-stage.active .ot-stage-node{background:#fff;border-color:var(--tl);color:var(--tl);box-shadow:0 0 0 5px var(--tl5),0 0 0 6px var(--tl2);animation:otActivePulse 2.2s ease-in-out infinite;}
@keyframes otActivePulse{0%,100%{box-shadow:0 0 0 5px var(--tl5),0 0 0 6px var(--tl2);}50%{box-shadow:0 0 0 9px rgba(14,117,86,.06),0 0 0 10px rgba(14,117,86,.10);}}
.ot-stage.active .ot-stage-node svg{animation:otBob 2s ease-in-out infinite;}
@keyframes otBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-2px);}}
.ot-stage.pending .ot-stage-node{border-style:dashed;background:#fbfcfd;}
.ot-stage-label{font-size:12px;font-weight:700;color:var(--f1);letter-spacing:-.005em;white-space:nowrap;}
.ot-stage.pending .ot-stage-label{color:var(--f4);font-weight:600;}
.ot-stage-date{font-family:var(--mf);font-size:10.5px;color:var(--f3);}
.ot-stage.pending .ot-stage-date{color:var(--f4);}
.ot-stage.active .ot-stage-date{color:var(--tl7);font-weight:700;}
/* Card shared */
.ot-card{background:var(--card);border-radius:var(--rc);box-shadow:var(--sh);padding:22px 26px;}
.ot-card-head{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
.ot-card-head h3{font-family:var(--hf);font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--f1);margin:0;}
.ot-card-aux{margin-left:auto;font-size:11.5px;color:var(--f3);display:inline-flex;align-items:center;gap:5px;}
.ot-card-aux svg{width:12px;height:12px;color:var(--f4);}
.ot-card-aux button{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--tl);letter-spacing:.01em;cursor:pointer;}
.ot-card-aux button:hover{color:var(--tl7);}
.ot-card-aux button svg{width:12px;height:12px;color:currentColor;transition:transform 160ms ease;}
.ot-card-aux button.is-open svg.chev{transform:rotate(180deg);}
/* Shipping card */
.ot-ship-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(220px,240px);gap:16px;align-items:stretch;}
.ot-ship-info{display:flex;flex-direction:column;gap:10px;}
.ot-courier-tile{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--inp);border:1px solid var(--bd);border-radius:12px;}
.ot-courier-icon{display:grid;place-items:center;width:34px;height:34px;flex-shrink:0;border-radius:9px;background:var(--tl5);color:var(--tl7);}
.ot-courier-icon svg{width:18px;height:18px;}
.ot-courier-logo{width:34px;height:34px;flex-shrink:0;border-radius:9px;object-fit:contain;background:#fff;border:1px solid var(--bd2);}
.ot-courier-name{font-size:14px;font-weight:700;color:var(--f1);min-width:0;overflow:hidden;text-overflow:ellipsis;}
.ot-tracking-row{display:grid;grid-template-columns:130px 1fr auto;gap:12px;align-items:center;min-height:60px;padding:12px 14px;background:var(--card);border:1px solid var(--bd);border-radius:12px;}
.ot-tr-label{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--f3);}
.ot-tr-label svg{width:12px;height:12px;color:var(--f4);}
.ot-tr-value{font-family:var(--mf);font-size:13.5px;font-weight:700;color:var(--tl7);letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ot-tr-value.pending{color:var(--f4);font-style:italic;font-weight:600;}
.ot-tr-value a{color:inherit;text-decoration:none;transition:color 140ms ease;}
.ot-tr-value a:hover{color:var(--tl);}
.ot-tr-copy{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;font-size:11.5px;font-weight:700;color:var(--tl);background:var(--tl5);border:1px solid var(--tl2);border-radius:8px;transition:all 140ms ease;flex-shrink:0;white-space:nowrap;cursor:pointer;}
.ot-tr-copy:hover{background:var(--tl1);}
.ot-tr-copy.copied{background:var(--tl);color:#fff;border-color:var(--tl);}
.ot-tr-copy svg{width:12px;height:12px;}
.ot-eta-card{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px 14px;background:var(--card);border:1px solid var(--bd);border-left:3px solid var(--tl);border-radius:12px;}
.ot-eta-icon{width:40px;height:40px;border-radius:10px;background:var(--tl5);border:1px solid var(--tl2);display:grid;place-items:center;color:var(--tl);flex-shrink:0;}
.ot-eta-icon svg{width:18px;height:18px;}
.ot-eta-lbl{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tl7);display:block;margin-bottom:1px;}
.ot-eta-date{font-family:var(--hf);font-size:16px;font-weight:800;color:var(--f1);letter-spacing:-.01em;line-height:1.15;}
.ot-eta-window{font-size:11.5px;color:var(--f3);margin-top:1px;}
/* Mini map */
.ot-mini-map{position:relative;min-height:130px;border-radius:12px;overflow:hidden;border:1px solid var(--bd);align-self:stretch;background:radial-gradient(ellipse at 20% 30%,#dcefe4 0%,transparent 55%),radial-gradient(ellipse at 78% 72%,#ecf6f0 0%,transparent 60%),repeating-linear-gradient(45deg,#f5f7f9 0 12px,#eef1f4 12px 24px);display:flex;flex-direction:column;cursor:pointer;transition:transform 200ms ease,box-shadow 200ms ease;}
.ot-mini-map:hover{transform:translateY(-1px);box-shadow:var(--shp);}
.ot-mini-map svg.roads{position:absolute;inset:0;width:100%;height:100%;}
.ot-mini-map .map-route{fill:none;stroke:var(--tl);stroke-width:3;stroke-linecap:round;stroke-dasharray:0 6 200 9999;animation:otRouteDraw 1.6s ease-out forwards;}
@keyframes otRouteDraw{to{stroke-dasharray:200 0 200 0;}}
.ot-mini-map .map-pin-from,.ot-mini-map .map-pin-to{position:absolute;width:22px;height:22px;border-radius:999px 999px 999px 2px;transform:rotate(-45deg);display:grid;place-items:center;font-size:9px;font-weight:800;color:#fff;}
.ot-mini-map .map-pin-from{top:16%;left:18%;background:var(--tl7);box-shadow:0 4px 10px -4px rgba(14,117,86,.55);}
.ot-mini-map .map-pin-to{bottom:44px;right:14%;background:var(--tl);box-shadow:0 4px 10px -4px rgba(14,117,86,.55);animation:otPinPulse 1.8s ease-in-out infinite;}
@keyframes otPinPulse{0%,100%{transform:rotate(-45deg) scale(1);}50%{transform:rotate(-45deg) scale(1.12);}}
.ot-mini-map .map-pin-from span,.ot-mini-map .map-pin-to span{transform:rotate(45deg);display:block;}
.ot-mini-map .map-courier{position:absolute;top:32%;left:36%;width:30px;height:30px;margin:-15px 0 0 -15px;background:#fff;border:2px solid var(--tl);border-radius:999px;display:grid;place-items:center;color:var(--tl);box-shadow:0 6px 14px -6px rgba(0,0,0,.18);animation:otCourierMove 4.5s ease-in-out infinite;}
.ot-mini-map .map-courier svg{width:14px;height:14px;}
@keyframes otCourierMove{0%{top:32%;left:36%;}50%{top:48%;left:66%;}100%{top:32%;left:36%;}}
.ot-mini-map-foot{margin-top:auto;display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-top:1px solid rgba(0,0,0,.08);z-index:2;}
.ot-mini-map-foot .mm-route{font-size:11px;color:var(--f2);display:flex;align-items:center;gap:6px;min-width:0;flex:1;}
.ot-mini-map-foot .mm-route svg{width:11px;height:11px;color:var(--f4);flex-shrink:0;}
.ot-mini-map-foot .mm-route span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
/* Timeline */
.ot-timeline{list-style:none;margin:0;padding:4px 6px 4px 8px;position:relative;}
.ot-tl-item{display:grid;grid-template-columns:26px 1fr auto;column-gap:14px;row-gap:2px;padding:10px 0 14px;position:relative;}
.ot-tl-item+.ot-tl-item::before{content:"";position:absolute;left:12px;top:-10px;height:20px;width:2px;background:var(--bd);}
.ot-tl-item::after{content:"";position:absolute;left:12px;top:26px;bottom:-2px;width:2px;background:var(--bd);}
.ot-tl-item:last-child::after{display:none;}
.ot-tl-item.latest .ot-tl-node{background:var(--tl);border-color:var(--tl);color:#fff;box-shadow:0 0 0 4px var(--tl5);animation:otTimelineNodePulse 2.2s ease-in-out infinite;}
@keyframes otTimelineNodePulse{0%,100%{box-shadow:0 0 0 4px var(--tl5);}50%{box-shadow:0 0 0 8px rgba(14,117,86,.08);}}
.ot-tl-item.latest .ot-tl-title{color:var(--f1);font-weight:800;}
.ot-tl-item.completed .ot-tl-node{background:#fff;border-color:var(--tl);color:var(--tl);}
.ot-tl-item.completed .ot-tl-title{color:var(--f2);}
.ot-tl-node{width:26px;height:26px;border-radius:999px;background:#fff;border:2px solid var(--bd);color:var(--f4);display:grid;place-items:center;z-index:1;position:relative;grid-row:1/3;}
.ot-tl-node svg{width:13px;height:13px;stroke-width:2.5;}
.ot-tl-body{min-width:0;}
.ot-tl-title{font-size:13.5px;font-weight:700;color:var(--f1);letter-spacing:-.005em;}
.ot-tl-meta{font-size:12px;color:var(--f3);margin-top:2px;line-height:1.5;}
.ot-tl-meta .pill-loc{display:inline-flex;align-items:center;gap:4px;font-family:var(--mf);font-size:10.5px;font-weight:600;color:var(--f2);background:var(--inp);border:1px solid var(--bd2);border-radius:999px;padding:1px 8px;margin-right:6px;}
.ot-tl-meta .pill-loc svg{width:10px;height:10px;color:var(--f4);}
.ot-tl-stamp{font-family:var(--mf);font-size:11px;color:var(--f4);white-space:nowrap;text-align:right;padding-top:2px;}
.ot-tl-stamp .date{display:block;color:var(--f3);font-weight:600;}
.ot-tl-stamp .time{color:var(--f2);font-weight:700;}
.ot-tl-item.latest .ot-tl-stamp .time{color:var(--tl7);}
/* Items */
.ot-items-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;transition:max-height 320ms ease,opacity 200ms ease,margin 200ms ease;overflow:hidden;}
.ot-items-list.collapsed{max-height:0;opacity:0;margin-top:-8px;}
.ot-items-list.open{max-height:800px;opacity:1;}
.ot-item{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;padding:12px;background:var(--inp);border:1px solid var(--bd2);border-radius:12px;}
.ot-item-thumb{width:64px;height:64px;border-radius:10px;display:grid;place-items:center;border:1px solid var(--bd);background:linear-gradient(135deg,#ecf6f0,#d9efe5);color:var(--tl);}
.ot-item-thumb svg{width:26px;height:26px;}
.ot-item-info{min-width:0;}
.ot-item-name{font-size:13.5px;font-weight:700;color:var(--f1);letter-spacing:-.005em;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ot-item-attr{font-size:11.5px;color:var(--f3);display:flex;flex-wrap:wrap;gap:6px 10px;}
.ot-item-attr .qty{display:inline-block;padding:1px 7px;background:#fff;border:1px solid var(--bd);border-radius:999px;font-family:var(--mf);font-size:10.5px;font-weight:600;color:var(--f2);}
.ot-item-price{font-family:var(--mf);font-size:13px;font-weight:600;color:var(--f1);white-space:nowrap;text-align:right;}
.ot-item-price .ccy{color:var(--f3);margin-right:3px;font-size:11px;}
.ot-items-totals{margin-top:14px;padding-top:14px;border-top:1px dashed var(--bd);display:flex;flex-direction:column;gap:6px;}
.ot-items-totals .row{display:flex;justify-content:space-between;font-size:12.5px;color:var(--f3);}
.ot-items-totals .row .val{font-family:var(--mf);color:var(--f2);font-weight:500;}
.ot-items-totals .row.total{margin-top:6px;padding-top:8px;border-top:1px solid var(--bd);font-size:14px;}
.ot-items-totals .row.total .lbl{font-weight:800;color:var(--f1);font-family:var(--hf);letter-spacing:.04em;text-transform:uppercase;}
.ot-items-totals .row.total .val{color:var(--tl7);font-weight:800;font-family:var(--hf);font-size:17px;}
/* Side rail */
.ot-side{display:flex;flex-direction:column;gap:16px;}
.ot-side .ot-card{padding:18px 20px;}
.ot-addr-block{display:flex;flex-direction:column;gap:4px;padding-top:2px;}
.ot-addr-name{font-size:13.5px;font-weight:700;color:var(--f1);}
.ot-addr-phone{font-family:var(--mf);font-size:12px;color:var(--f3);margin-bottom:6px;}
.ot-addr-lines{font-size:12.5px;color:var(--f2);line-height:1.55;}
.ot-addr-lines em{font-style:normal;color:var(--f3);}
.ot-addr-tag{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:var(--tl5);border:1px solid var(--tl2);color:var(--tl7);align-self:flex-start;}
.ot-addr-tag svg{width:11px;height:11px;}

.ot-support-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;padding:0 12px;border-radius:9px;font-size:12.5px;font-weight:700;border:1px solid var(--tl2);background:var(--card);color:var(--tl7);transition:all 140ms ease;white-space:nowrap;cursor:pointer;width:100%;}
.ot-support-btn:hover{background:var(--tl5);border-color:var(--tl);}
.ot-support-btn.primary{background:var(--tl);color:#fff;border-color:var(--tl);box-shadow:0 4px 12px -4px rgba(14,117,86,.45);}
.ot-support-btn.primary:hover{background:var(--tl7);border-color:var(--tl7);}
.ot-support-btn svg{width:13px;height:13px;}
.ot-back-row{display:flex;flex-direction:column;gap:8px;}
.ot-back-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:10px;font-size:13px;font-weight:700;border:1px solid var(--bd);background:var(--card);color:var(--f1);letter-spacing:.01em;transition:all 140ms ease;cursor:pointer;text-decoration:none;}
.ot-back-btn:hover{background:var(--inp);border-color:var(--f3);}
.ot-back-btn svg{width:14px;height:14px;}
/* Delivered banner */
.ot-delivered-banner{display:flex;align-items:center;gap:14px;padding:16px 20px;background:radial-gradient(ellipse at 90% 50%,rgba(255,255,255,0) 0%,var(--tl5) 100%),linear-gradient(135deg,var(--tl) 0%,#095e44 100%);color:#fff;border-radius:var(--rc);box-shadow:0 10px 24px -10px rgba(14,117,86,.50);position:relative;overflow:hidden;}
.ot-delivered-banner::before{content:"";position:absolute;inset:-50% -20% auto auto;width:220px;height:220px;background:radial-gradient(circle,rgba(255,255,255,.18) 0%,transparent 60%);pointer-events:none;}
.ot-db-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.30);display:grid;place-items:center;flex-shrink:0;}
.ot-db-icon svg{width:22px;height:22px;stroke-width:2.5;}
.ot-db-text{flex:1;min-width:0;}
.ot-db-title{font-family:var(--hf);font-size:17px;font-weight:800;letter-spacing:-.005em;margin:0 0 2px;}
.ot-db-sub{font-size:12.5px;opacity:.88;margin:0;}
.ot-db-cta{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;font-size:12.5px;font-weight:700;border-radius:9px;background:#fff;color:var(--tl7);flex-shrink:0;white-space:nowrap;transition:transform 140ms ease;cursor:pointer;}
.ot-db-cta:hover{transform:translateY(-1px);}
.ot-db-cta svg{width:13px;height:13px;}
/* Delivered variant */
.ot-page.is-delivered .ot-stage.done .ot-stage-node{background:var(--tl);border-color:var(--tl);}
.ot-page.is-delivered .ot-stage-rail::after{background:var(--tl7);}
/* Mobile */
@media(max-width:768px){
.ot-page .ck-shell{grid-template-columns:1fr;padding:16px 14px;gap:16px;}
.ot-page .ck-summary-col{position:static;}
.ot-order-head{grid-template-columns:1fr;padding:18px;}
.ot-status-badge{width:100%;justify-content:flex-start;}
.ot-oh-id{font-size:22px;}
.ot-tracker{padding:20px 14px 18px;}
.ot-stage-node{width:36px;height:36px;}
.ot-stage-node svg{width:14px;height:14px;}
.ot-stage-rail{top:16px;left:calc(50% + 20px);right:calc(-50% + 20px);}
.ot-stage-label{font-size:10.5px;}
.ot-stage-date{font-size:9.5px;}
.ot-card{padding:18px 16px;}
.ot-ship-grid{grid-template-columns:1fr;}
.ot-mini-map{min-height:130px;}
.ot-tracking-row{grid-template-columns:1fr auto;row-gap:6px;}
.ot-tracking-row .ot-tr-label{grid-column:1/-1;}
.ot-item{grid-template-columns:56px 1fr auto;}
.ot-item-thumb{width:56px;height:56px;}
}
`
