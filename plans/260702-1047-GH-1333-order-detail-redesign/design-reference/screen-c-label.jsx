/* F36 · Screen C — Create Label, FULL-PAGE Order Detail (dashboard · dark)
   2-column dashboard layout (replaces the old slide-over drawer) to use the
   full desktop width and minimise vertical scroll:
     LEFT 65%  · Order Progress · Shipping Fulfillment Zone · Order Items table
                 · (foot) Cancel / Refund text-links
     RIGHT 35% · Customer · Payment · Order Summary  (read-only reconciliation)
   The EasyParcel flow lives in the Shipping Fulfillment Zone. NO modal.
   Single-courier (preset in Settings). One click runs the 2-step API:
     Step 1  EPSubmitOrderBulk → "Reserving…"   Step 2  EPPayOrderBulk → "Charging wallet…"
   Idempotent once an AWB exists. state: ready | submitting | paying | success
                                          | error | cod-blocked | missing-data */

const { Icon: CIcon, courierById: C_by, CourierLogo: C_Logo, DashShell: C_Dash } = window;

const C_PRESET = C_by("jnt"); // courier comes from Settings
const fmtMYR = (sen) => "MYR " + (sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Order Progress stepper ─────────────────────────────────────────────── */
const STEPS = [
{ id: "pending", label: "Pending", ic: "clock", date: "16 Jun, 14:28" },
{ id: "confirmed", label: "Confirmed", ic: "circle-check", date: "16 Jun, 14:32" },
{ id: "ready", label: "Ready", ic: "package", date: "" },
{ id: "shipping", label: "Shipping", ic: "truck", date: "", tip: "This status is automatically updated once the courier picks up the parcel." },
{ id: "completed", label: "Completed", ic: "badge-check", date: "", tip: "Automatically marked as completed after successful delivery and settlement." }];

/*
  NOTE: This is the design spec reference (React-in-browser, window globals, lucide icons).
  Port it to the project's Next.js + Tailwind + shadcn + lucide-react conventions.
  Full component logic (Stepper, InfoRow, CourierPreset, WalletLine, ShipSteps,
  SchedulePickupPopover, SelfDeliveryZone, ActionZone, CodRecovery, ItemsTable,
  CancelDialog, PrintLabelModal, LabelScreen) is preserved verbatim below.
*/

function Stepper({ current, loading, cancelled, cancelDate }) {
  return (
    <div className="od-stepper">
      {STEPS.map((s, i) => {
        if (cancelled && i === current) {
          return (
            <React.Fragment key="cancelled">
              <div className="od-step cancelled">
                <span className="od-node"><CIcon name="x" /></span>
                <span className="od-step-l">Cancelled</span>
                {cancelDate && <span className="od-step-date">{cancelDate}</span>}
              </div>
              {i < STEPS.length - 1 && <span className="od-conn" />}
            </React.Fragment>);
        }
        const done = i < current;
        const active = i === current;
        const dead = cancelled && i > current;
        const cls = dead ? "dead" : done ? "done" : active ? "active" : "pending";
        return (
          <React.Fragment key={s.id}>
            <div className={`od-step ${cls}`}>
              <span className="od-node">
                {active && loading ? <span className="spin" /> :
                done ? <CIcon name="check" /> : <CIcon name={s.ic} />}
              </span>
              <span className="od-step-l">
                {s.label}
                {s.tip &&
                <span className="od-tip" tabIndex={0}>
                    <CIcon name="info" className="od-tip-ic" />
                    <span className="od-tip-box" role="tooltip">{s.tip}</span>
                  </span>
                }
              </span>
              {done && s.date && <span className="od-step-date">{s.date}</span>}
            </div>
            {i < STEPS.length - 1 && <span className={`od-conn ${cancelled && i >= current ? "dead" : i < current ? "fill" : ""} ${cancelled && i === current - 1 ? "cancel" : ""}`} />}
          </React.Fragment>);
      })}
    </div>);
}

function InfoRow({ ic, label, value, tone }) {
  return (
    <div className="od-info">
      <span className={`od-info-ic ${tone || ""}`}><CIcon name={ic} /></span>
      <div className="od-info-tx"><div className="od-info-l">{label}</div><div className="od-info-v">{value}</div></div>
    </div>);
}

function CourierPreset() {
  return (
    <div className="courier-preset">
      <span className="cp-l">Courier</span>
      <span className="cp-v"><C_Logo courier={C_PRESET} size={20} /> {C_PRESET.name}
        <span className="preset-tag"><CIcon name="lock" /> from Settings</span></span>
    </div>);
}
function WalletLine({ balance = 480000 }) {
  return (
    <div className="wallet">
      <span className="w-ico"><CIcon name="wallet" /></span>
      <div className="w-body">
        <div className="w-main">EasyParcel cost: <b>{fmtMYR(542)}</b></div>
        <div className="w-sub">Wallet balance <b>{fmtMYR(balance)}</b></div>
      </div>
    </div>);
}
function ShipSteps({ stage }) {
  const s1 = stage > 1 ? "done" : "active";
  const s2 = stage > 1 ? "active" : "pending";
  return (
    <div className="ship-steps">
      <div className={`ship-step ${s1}`}>
        <span className="s-dot">{s1 === "done" ? <CIcon name="check" /> : <span className="spin" />}</span>
        <span className="s-txt">Reserving slot <code>EPSubmitOrderBulk</code></span>
      </div>
      <div className={`ship-step ${s2}`}>
        <span className="s-dot">{s2 === "active" ? <span className="spin" /> : "2"}</span>
        <span className="s-txt">Charging wallet <code>EPPayOrderBulk</code></span>
      </div>
    </div>);
}

/* Schedule-pickup popover config */
const SCHED_HOLIDAYS = ["2026-06-25"];
const MORNING_CUTOFF_H = 11;
const AFTERNOON_CUTOFF_H = 17;
const SCHED_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const schedIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const schedDM = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const schedOff = (d) => d.getDay() === 0 || SCHED_HOLIDAYS.includes(schedIso(d));

function SchedulePickupPopover({ onCancel, onConfirm }) {
  const now = React.useMemo(() => new Date(), []);
  const hour = now.getHours();
  const today = now;
  const tomorrow = React.useMemo(() => new Date(now.getTime() + 86400000), [now]);
  const todayOff = schedOff(today);
  const tomorrowOff = schedOff(tomorrow);
  const todayClosed = todayOff || hour >= AFTERNOON_CUTOFF_H;
  const [mode, setMode] = React.useState(todayClosed ? "tomorrow" : "today");
  const [customDate, setCustomDate] = React.useState("");
  const [slot, setSlot] = React.useState(null);
  const selectedDate =
    mode === "today" ? today :
    mode === "tomorrow" ? tomorrow :
    (customDate ? new Date(customDate + "T00:00:00") : null);
  const selectedOff = selectedDate ? schedOff(selectedDate) : true;
  const customOff = mode === "other" && selectedDate && selectedOff;
  const isToday = selectedDate && schedIso(selectedDate) === schedIso(today);
  const morningOpen = !isToday || hour < MORNING_CUTOFF_H;
  const afternoonOpen = !isToday || hour < AFTERNOON_CUTOFF_H;
  const morningHidden = isToday && !morningOpen;
  const dateValid = selectedDate && !selectedOff && !(mode === "today" && hour >= AFTERNOON_CUTOFF_H);
  React.useEffect(() => {
    if (!dateValid) { setSlot(null); return; }
    setSlot((s) => {
      if (s === "am" && !morningOpen) return afternoonOpen ? "pm" : null;
      if (s === "pm" && !afternoonOpen) return morningOpen ? "am" : null;
      if (!s) return morningOpen ? "am" : afternoonOpen ? "pm" : null;
      return s;
    });
  }, [mode, customDate]);
  const canConfirm = dateValid && ((slot === "am" && morningOpen) || (slot === "pm" && afternoonOpen));
  const slotLabel = slot === "am" ? "Morning (08:00–12:00)" : slot === "pm" ? "Afternoon (13:00–18:00)" : "";
  const dateLabel =
    mode === "today" ? `Today ${schedDM(today)}` :
    mode === "tomorrow" ? `Tomorrow ${schedDM(tomorrow)}` :
    (selectedDate ? `${SCHED_DOW[selectedDate.getDay()]} ${schedDM(selectedDate)}` : "");
  return (
    <div className="sched-pop sched-pop-wide" onClick={(e) => e.stopPropagation()}>
      <div className="sched-pop-h">Schedule pickup</div>
      <div className="sched-label">Pickup date</div>
      <div className="sched-days">
        <button className={`sched-day ${mode === "today" ? "on" : ""}`} disabled={todayClosed} onClick={() => setMode("today")}>
          <span className="sd-dow">{SCHED_DOW[today.getDay()]}</span>
          <span className="sd-main">Today</span>
          <span className="sd-date">{schedDM(today)}</span>
          {todayClosed && <span className="sd-off">{todayOff ? "Closed" : "Cut-off"}</span>}
        </button>
        <button className={`sched-day ${mode === "tomorrow" ? "on" : ""}`} disabled={tomorrowOff} onClick={() => setMode("tomorrow")}>
          <span className="sd-dow">{SCHED_DOW[tomorrow.getDay()]}</span>
          <span className="sd-main">Tomorrow</span>
          <span className="sd-date">{schedDM(tomorrow)}</span>
          {tomorrowOff && <span className="sd-off">Closed</span>}
        </button>
        <button className={`sched-day ${mode === "other" ? "on" : ""}`} onClick={() => setMode("other")}>
          <span className="sd-dow">&nbsp;</span>
          <span className="sd-main">Pick a</span>
          <span className="sd-date">date</span>
        </button>
      </div>
      {mode === "other" &&
      <div className="sched-custom">
          <input type="date" value={customDate} min={schedIso(today)} onChange={(e) => setCustomDate(e.target.value)} />
          {customOff &&
        <div className="sched-warn"><CIcon name="triangle-alert" /> The courier doesn't operate on Sundays / public holidays. Please choose another date.</div>
        }
        </div>
      }
      <div className="sched-label sched-label-2">Pickup time slot</div>
      {dateValid ?
      <>
          <div className="sched-slots">
            {!morningHidden &&
          <button className={`sched-slot ${slot === "am" ? "on" : ""}`} disabled={!morningOpen} onClick={() => setSlot("am")}>
                <span className="ss-time">08:00 – 12:00</span>
                <span className="ss-name">Morning</span>
              </button>
          }
            <button className={`sched-slot ${slot === "pm" ? "on" : ""}`} disabled={!afternoonOpen} onClick={() => setSlot("pm")}>
              <span className="ss-time">13:00 – 18:00</span>
              <span className="ss-name">Afternoon</span>
            </button>
          </div>
          {morningHidden &&
        <div className="sched-cutoff"><CIcon name="alarm-clock-off" /> The morning slot cut-off has passed — please choose the afternoon slot or tomorrow.</div>
        }
        </> :
      <div className="sched-slot-empty">Select a valid pickup date to see available time slots.</div>
      }
      <div className="sched-pop-foot">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={!canConfirm} onClick={() => onConfirm(`${dateLabel} · ${slotLabel}`)}><CIcon name="check" /> Confirm</button>
      </div>
      <div className="sched-pop-note"><CIcon name="info" /> The pickup schedule depends on the courier's working hours. Sundays, public holidays, and dates past the cut-off are hidden automatically.</div>
    </div>);
}

const SELF_COURIERS = ["Pos Laju", "J&T Express", "DHL eCommerce", "Ninja Van", "City-Link Express", "Skynet"];
function SelfDeliveryZone({ initialShipped = false }) {
  const [shipped, setShipped] = React.useState(initialShipped);
  const [courier, setCourier] = React.useState("");
  const [awb, setAwb] = React.useState("");
  const canShip = courier.trim() && awb.trim();
  if (shipped) {
    const cName = courier || "J&T Express";
    const cAwb = awb || "JT760028145MY";
    return (
      <div className="self-deliver">
        <div className="alert success ship-banner">
          <CIcon name="check-circle-2" className="lead" />
          <div className="a-body"><div className="a-t">Order shipped — tracking saved</div>Fulfilled manually via self-delivery.</div>
        </div>
        <div className="ship-track">
          <div className="sd-readrow">
            <div className="od-info-l">Courier</div>
            <div className="sd-courier-val">{cName} <span className="sd-self-badge">Self-delivery</span></div>
          </div>
          <div className="sd-readrow">
            <div className="od-info-l">Tracking number (AWB)</div>
            <div className="copyfield"><span className="cf-v">{cAwb}</span><span className="cf-btn"><CIcon name="copy" /> Copy</span></div>
          </div>
          <div className="sd-disclaimer"><CIcon name="info" /> Order fulfilled via manual tracking. Tracking status updates are not automatically synced.</div>
        </div>
      </div>);
  }
  return (
    <div className="self-deliver">
      <div className="alert info sd-banner"><CIcon name="info" className="lead" />
        <div className="a-body"><div className="a-t">Self-delivery (manual shipping)</div>EasyParcel isn't connected — enter courier &amp; tracking manually to fulfill this order.</div>
      </div>
      <div className="od-field">
        <label className="lbl">Courier</label>
        <div className="sel">
          <select value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="" disabled>Select courier (e.g. Pos Laju, J&T Express, DHL…)</option>
            {SELF_COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <CIcon name="chevron-down" className="chev" />
        </div>
      </div>
      <div className="od-field">
        <label className="lbl">Tracking number (AWB)</label>
        <div className="inp"><input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="Enter tracking number manually" /></div>
      </div>
      <button className="btn btn-primary btn-block" style={{ height: "40px", backgroundColor: canShip ? "rgb(79, 70, 229)" : undefined }}
        disabled={!canShip} onClick={() => setShipped(true)}>
        <CIcon name="truck" /> Ship Order
      </button>
    </div>);
}

function ActionZone({ state, onPrint, onShip, onConfirmOrder }) {
  const submitting = state === "submitting",paying = state === "paying";
  const success = state === "success",error = state === "error";
  const cod = state === "cod-blocked",missing = state === "missing-data";
  const cancelled = state === "cancelled";
  const pending = state === "pending";
  const shipping = state === "shipping",completed = state === "completed";
  const busy = submitting || paying;
  const [schedOpen, setSchedOpen] = React.useState(false);
  const [pickup, setPickup] = React.useState(null);
  const schedRef = React.useRef(null);
  React.useEffect(() => {
    if (!schedOpen) return;
    const onDoc = (e) => {if (schedRef.current && !schedRef.current.contains(e.target)) setSchedOpen(false);};
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [schedOpen]);
  if (state === "self-delivery") return <SelfDeliveryZone initialShipped={false} />;
  if (state === "self-shipped") return <SelfDeliveryZone initialShipped={true} />;
  if (pending) {
    return (
      <div className="action-zone">
        <div className="alert warning"><CIcon name="clock" className="lead" />
          <div className="a-body"><div className="a-t">Awaiting confirmation</div>This order is paid by Cash on Delivery. Review the details, then confirm to move it into fulfillment and create the shipping label.</div>
        </div>
        <div className="ship-meta">
          <div className="od-info"><span className="od-info-ic amber"><CIcon name="banknote" /></span>
            <div className="od-info-tx"><div className="od-info-l">Payment</div><div className="od-info-v amber">Cash on Delivery · collect {fmtMYR(11800)}</div></div></div>
          <div className="od-info"><span className="od-info-ic"><CIcon name="map-pin" /></span>
            <div className="od-info-tx"><div className="od-info-l">Destination</div><div className="od-info-v">Petaling Jaya, Selangor (West MY)</div></div></div>
        </div>
        <div className="ship-foot">
          <div className="help"><CIcon name="info" /> Confirming acknowledges the COD order — no wallet charge until you create the label.</div>
          <button className="btn btn-grad ship-cta ship-cta-fixed" style={{ height: "40px" }} onClick={onConfirmOrder}>Confirm order</button>
        </div>
      </div>);
  }
  if (cancelled) {
    return (
      <div className="action-zone">
        <div className="alert error"><CIcon name="x-circle" className="lead" />
          <div className="a-body"><div className="a-t">Order cancelled</div>Cancelled on 16 Jun 2026 · 15:04. The buyer was refunded {fmtMYR(11800)} automatically — no label was created and no wallet charge applied.</div>
        </div>
        <div className="ship-meta">
          <div className="od-info"><span className="od-info-ic"><CIcon name="user" /></span>
            <div className="od-info-tx"><div className="od-info-l">Cancelled by</div><div className="od-info-v">Store admin</div></div></div>
          <div className="od-info"><span className="od-info-ic amber"><CIcon name="sticky-note" /></span>
            <div className="od-info-tx"><div className="od-info-l">Reason</div><div className="od-info-v">Customer requested cancellation</div></div></div>
        </div>
      </div>);
  }
  if (success) {
    return (
      <div className="ship-result">
        <div className="alert success ship-banner">
          <CIcon name="check-circle-2" className="lead" />
          <div className="a-body"><div className="a-t">Label created — ready to ship</div>Hand this parcel to {C_PRESET.name}. No further action needed.</div>
          <span className="banner-deduct"><CIcon name="wallet" /> {fmtMYR(542)} deducted · wallet now <b>{fmtMYR(425800)}</b></span>
        </div>
        <div className="ship-track">
          <div className="st-row">
            <div className="st-field" style={{ gap: "6px" }}>
              <div className="od-info-l">Courier</div>
              <div className="st-courier"><C_Logo courier={C_PRESET} size={22} /> {C_PRESET.name}</div>
            </div>
            <div className="st-field grow">
              <div className="od-info-l">Tracking number (AWB)</div>
              <div className="copyfield"><span className="cf-v">MY123456789</span><span className="cf-btn"><CIcon name="copy" /> Copy</span></div>
            </div>
            <div className="st-actions">
              <button className="btn btn-primary" onClick={onPrint} style={{ backgroundColor: "rgb(59, 130, 246)" }}><CIcon name="printer" /> Print label (PDF)</button>
              {pickup ?
              <div className="sched-locked"><CIcon name="calendar-check" /> Pickup · <b>{pickup}</b></div> :
              <div className="sched-anchor" ref={schedRef}>
                  <button className={`btn btn-outline ${schedOpen ? "is-open" : ""}`} onClick={() => setSchedOpen((o) => !o)}><CIcon name="calendar-clock" /> Schedule pickup</button>
                  {schedOpen &&
                <SchedulePickupPopover onCancel={() => setSchedOpen(false)} onConfirm={(v) => {setPickup(v);setSchedOpen(false);}} />
                }
                </div>
              }
            </div>
          </div>
        </div>
      </div>);
  }
  if (shipping || completed) {
    const events = completed ? [
      { t: "Delivered", d: "18 Jun 2026 · 14:07", note: "Signed by AISYAH (recipient)", done: true, last: true },
      { t: "Out for delivery", d: "18 Jun 2026 · 08:41", note: "Petaling Jaya Hub", done: true },
      { t: "In transit", d: "17 Jun 2026 · 19:20", note: "Departed Shah Alam Sort Center", done: true },
      { t: "Picked up", d: "17 Jun 2026 · 10:12", note: `Collected by ${C_PRESET.name}`, done: true },
    ] : [
      { t: "In transit", d: "17 Jun 2026 · 19:20", note: "Departed Shah Alam Sort Center", done: true, live: true },
      { t: "Arrived at sort center", d: "17 Jun 2026 · 15:48", note: "Shah Alam Sort Center", done: true },
      { t: "Picked up", d: "17 Jun 2026 · 10:12", note: `Collected by ${C_PRESET.name}`, done: true },
    ];
    return (
      <div className="ship-result">
        <div className={`alert ${completed ? "success" : "info"} ship-banner`}>
          <CIcon name={completed ? "badge-check" : "truck"} className="lead" />
          <div className="a-body">
            <div className="a-t">{completed ? "Delivered — order completed" : "Parcel in transit"}</div>
            {completed ?
            `Delivered on 18 Jun 2026 · 14:07. This order is now complete.` :
            `${C_PRESET.name} has collected the parcel. Track its journey below — updates arrive automatically.`}
          </div>
          <span className="banner-deduct"><CIcon name={completed ? "circle-check" : "clock"} /> {completed ? "Settlement complete" : "Picked up 17 Jun · 10:12"}</span>
        </div>
        <div className="ship-track">
          <div className="st-row">
            <div className="st-field" style={{ gap: "6px" }}>
              <div className="od-info-l">Courier</div>
              <div className="st-courier"><C_Logo courier={C_PRESET} size={22} /> {C_PRESET.name}</div>
            </div>
            <div className="st-field grow">
              <div className="od-info-l">Tracking number (AWB)</div>
              <div className="copyfield"><span className="cf-v">MY123456789</span><span className="cf-btn"><CIcon name="copy" /> Copy</span></div>
            </div>
            <div className="st-actions">
              <button className="btn btn-primary" onClick={onPrint} style={{ backgroundColor: "rgb(59, 130, 246)" }}><CIcon name="printer" /> Print label (PDF)</button>
              <button className="btn btn-outline"><CIcon name="external-link" /> Track on {C_PRESET.name}</button>
            </div>
          </div>
          <div className="track-timeline">
            {events.map((e, i) => (
              <div className={`tl-row ${e.done ? "done" : ""} ${e.live ? "live" : ""} ${e.last ? "last" : ""}`} key={i}>
                <span className="tl-dot" />
                <div className="tl-body">
                  <div className="tl-head"><span className="tl-t">{e.t}</span><span className="tl-d">{e.d}</span></div>
                  <div className="tl-note">{e.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>);
  }
  if (busy) {
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: "40px" }} disabled>
          <span className="spin" /> {submitting ? "Reserving…" : "Charging wallet…"}
        </button>
        <ShipSteps stage={paying ? 2 : 1} />
      </div>);
  }
  if (error) {
    return (
      <div className="action-zone" style={{ backgroundColor: "rgb(15, 23, 42)" }}>
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: "40px" }} disabled>Ready to Ship</button>
        <div className="alert error"><CIcon name="circle-alert" className="lead" />
          <div className="a-body"><div className="a-t">EASYPARCEL_WALLET_LOW</div>Insufficient balance (need {fmtMYR(542)}, have {fmtMYR(21000)}). Order unchanged — top up and retry.</div>
        </div>
        <div className="ship-actions">
          <button className="btn btn-primary"><CIcon name="external-link" /> Top up wallet</button>
          <button className="btn btn-outline"><CIcon name="refresh-cw" /> Try again</button>
        </div>
      </div>);
  }
  if (cod) {
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: "40px" }} disabled>Ready to Ship</button>
        <div className="alert warning"><CIcon name="triangle-alert" className="lead" />
          <div className="a-body"><div className="a-t">COD unavailable for this destination</div>EasyParcel only supports COD in West Malaysia. This order is COD to Sabah (East MY) — choose how to proceed below.</div>
        </div>
        <CodRecovery />
      </div>);
  }
  if (missing) {
    return (
      <div className="action-zone">
        <button className="btn btn-grad btn-block ship-cta disabled" style={{ height: "40px" }} disabled>Ready to Ship</button>
        <div className="parcel-missing">
          <div className="pm-head">
            <span className="pm-ico"><CIcon name="triangle-alert" /></span>
            <div><div className="pm-t">Missing parcel dimensions</div><div className="pm-d">This product has no weight/size saved. Add the parcel details to create the label.</div></div>
          </div>
          <div className="pm-fields pm-fields-row">
            <div className="od-field"><label className="lbl">Weight</label><div className="inp"><input defaultValue="600" /><span className="suf">g</span></div></div>
            <div className="od-field"><label className="lbl">Dimensions (cm)</label>
              <div className="row-3" style={{ gap: 8 }}>
                <div className="inp"><input placeholder="L" /></div><div className="inp"><input placeholder="W" /></div><div className="inp"><input placeholder="H" /></div>
              </div>
            </div>
          </div>
          <button className="btn btn-grad btn-block" style={{ height: "40px" }}>Continue creating label</button>
        </div>
      </div>);
  }
  // ready (Confirmed → one click): show config + cost FIRST, then the CTA last
  return (
    <div className="action-zone">
      <div className="ship-meta">
        <CourierPreset />
        <WalletLine />
      </div>
      <div className="ship-foot">
        <div className="help"><CIcon name="info" /> One click reserves the slot and charges your EasyParcel wallet — no extra steps.</div>
        <button className="btn btn-grad ship-cta ship-cta-fixed" style={{ height: "40px" }} onClick={onShip}>Ready to Ship</button>
      </div>
    </div>);
}

function CodRecovery() {
  const [choice, setChoice] = React.useState(null);
  const EP_COURIERS = ["jnt", "citylink", "poslaju"].map(C_by);
  return (
    <div className="cod-recovery">
      <div className="cr-cap">How do you want to fulfill this order?</div>
      <div className="cr-options">
        <button className={`cr-opt ${choice === "ep" ? "on" : ""}`} onClick={() => setChoice("ep")}>
          <span className="cr-radio" />
          <span className="cr-ic blue"><CIcon name="truck" /></span>
          <span className="cr-tx">
            <span className="cr-t">Re-select EasyParcel courier</span>
            <span className="cr-d">Switch the buyer to prepaid, then pick a courier that delivers to East MY.</span>
          </span>
        </button>
        <button className={`cr-opt ${choice === "manual" ? "on" : ""}`} onClick={() => setChoice("manual")}>
          <span className="cr-radio" />
          <span className="cr-ic slate"><CIcon name="package" /></span>
          <span className="cr-tx">
            <span className="cr-t">Ship manually</span>
            <span className="cr-d">Fulfill outside EasyParcel and enter the tracking number yourself.</span>
          </span>
        </button>
      </div>
      {choice === "ep" &&
      <div className="cr-panel">
          <div className="od-field">
            <label className="lbl">Courier (prepaid)</label>
            <div className="sel">
              <select defaultValue="jnt">{EP_COURIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <CIcon name="chevron-down" className="chev" />
            </div>
          </div>
          <button className="btn btn-grad btn-block" style={{ height: "40px" }}>Create label (prepaid)</button>
        </div>
      }
      {choice === "manual" &&
      <div className="cr-panel">
          <div className="cr-row">
            <div className="od-field" style={{ flex: "0 0 150px" }}>
              <label className="lbl">Courier</label>
              <div className="inp"><input placeholder="e.g. Pos Laju" /></div>
            </div>
            <div className="od-field" style={{ flex: 1 }}>
              <label className="lbl">Tracking number</label>
              <div className="inp"><input placeholder="Enter AWB / tracking no." /></div>
            </div>
          </div>
          <button className="btn btn-outline btn-block" style={{ height: "40px" }}><CIcon name="check" /> Mark as shipped</button>
        </div>
      }
    </div>);
}

/* Order Items table (thumbnail · name · SKU · attrs · qty · weight · price) */
const ITEMS = [
{ name: "Aurora Batik Scarf — Indigo", sku: "AUR-SCF-IND-180", attrs: "Colour: Indigo · 180×70 cm", qty: 1, kg: "0.4 kg", price: 12900, mono: "BS", color: "#3b5bdb" },
{ name: "Songket Pouch — Small", sku: "SNG-PCH-EMA-S", attrs: "Pattern: Emas · Drawstring", qty: 1, kg: "0.2 kg", price: 6900, mono: "SP", color: "#0c8599" }];

function ItemsTable() {
  const [open, setOpen] = React.useState(false);
  const CAP = 3;
  const shown = open ? ITEMS : ITEMS.slice(0, CAP);
  const hidden = ITEMS.length - CAP;
  return (
    <div className="itab">
      <div className="itab-head">
        <span>Item</span><span className="ta-c">Qty</span><span className="ta-c">Weight</span><span className="ta-r">Price</span>
      </div>
      {shown.map((it, i) =>
      <div className="itab-row" key={i}>
          <div className="it-cell">
            <span className="it-thumb" style={{ background: it.color }}>{it.mono}</span>
            <div className="it-tx"><div className="it-name">{it.name}</div><div className="it-sku"><CIcon name="scan-barcode" /> SKU {it.sku}</div><div className="it-attrs">{it.attrs}</div></div>
          </div>
          <span className="ta-c it-qty">×{it.qty}</span>
          <span className="ta-c it-kg">{it.kg}</span>
          <span className="ta-r it-price">{fmtMYR(it.price)}</span>
        </div>
      )}
      {hidden > 0 &&
      <button className="itab-more" onClick={() => setOpen(!open)}>
          <CIcon name={open ? "chevron-up" : "plus"} /> {open ? "Show fewer" : `Show ${hidden} more item${hidden > 1 ? "s" : ""}`}
        </button>
      }
      <div className="itab-summary">
        <div className="is-row"><span className="is-k">Subtotal</span><span className="is-v">{fmtMYR(19800)}</span></div>
        <div className="is-row"><span className="is-k">Shipping Fee</span><span className="is-v">{fmtMYR(890)}</span></div>
        <div className="is-row"><span className="is-k">Voucher <code className="is-voucher">RAYA10</code></span><span className="is-v" style={{ color: "var(--success-fg)" }}>−{fmtMYR(2000)}</span></div>
        <div className="is-row is-total"><span className="is-k">Total</span><span className="is-v">{fmtMYR(18690)}</span></div>
      </div>
    </div>);
}

function CancelDialog({ orderId, onBack, onConfirm }) {
  const [reason, setReason] = React.useState("");
  return (
    <div className="dialog-backdrop" onClick={onBack}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <span className="cd-ico"><CIcon name="triangle-alert" /></span>
        <h3 className="cd-title">Confirm Cancellation #{orderId}</h3>
        <p className="cd-sub">Are you sure? Customer will receive an email.</p>
        <div className="cd-field">
          <label className="cd-label">Reason for cancellation <span className="req">*</span></label>
          <textarea className="cd-textarea" rows={3} placeholder="Customer placed duplicate order…"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="cd-foot">
          <button className="btn btn-outline" onClick={onBack}>Back</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={onConfirm}>Confirm Cancel</button>
        </div>
      </div>
    </div>);
}

function PrintLabelModal({ onClose }) {
  React.useEffect(() => { if (window.lucide) window.lucide.createIcons(); });
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog plabel-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-h">
          <span className="plabel-h-ic"><CIcon name="printer" /></span>
          <div className="dialog-h-tx">
            <div className="dialog-t">Print shipping label</div>
            <div className="dialog-sub">AWB MY123456789 · A6 thermal (100 × 150 mm)</div>
          </div>
          <button className="dialog-x" onClick={onClose} aria-label="Close"><CIcon name="x" /></button>
        </div>
        <div className="plabel-body">
          <div className="plabel-preview">
            <div className="awb-label">
              <div className="awb-top">
                <div className="awb-courier"><C_Logo courier={C_PRESET} size={26} /> <b>{C_PRESET.name}</b></div>
                <div className="awb-service">EP · Standard</div>
              </div>
              <div className="awb-route">
                <div className="awb-addr">
                  <span className="awb-tag">FROM</span>
                  <b>Prime Store SB</b>
                  <span>18, Jalan PJU 5/1, Kota Damansara, 47810 Petaling Jaya, Selangor</span>
                </div>
                <div className="awb-addr">
                  <span className="awb-tag">TO</span>
                  <b>Aisyah Rahman</b>
                  <span>27, Jalan Kenanga 3, Petaling Jaya, 47100 Selangor · +60 12-345 6789</span>
                </div>
              </div>
              <div className="awb-meta">
                <div><span>Weight</span><b>1.2 kg</b></div>
                <div><span>COD</span><b>—</b></div>
                <div><span>Order</span><b>PRM1042-7K3M</b></div>
              </div>
              <div className="awb-barcode"><div className="awb-bars" /><span className="awb-num">MY 1234 5678 9</span></div>
            </div>
          </div>
          <div className="plabel-side">
            <div className="plabel-field">
              <label>Label format</label>
              <div className="plabel-seg">
                <button className="on">A6 thermal</button>
                <button>A4 sheet</button>
              </div>
            </div>
            <div className="plabel-field">
              <label>Copies</label>
              <div className="plabel-step"><button>–</button><span>1</span><button>+</button></div>
            </div>
            <label className="plabel-check"><input type="checkbox" defaultChecked /> <span>Mark as printed</span></label>
            <div className="plabel-hint"><CIcon name="info" /> Opens the PDF in a new tab — send it straight to your thermal printer.</div>
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-outline"><CIcon name="download" /> Download PDF</button>
          <button className="btn btn-primary" style={{ backgroundColor: "rgb(59, 130, 246)" }}><CIcon name="printer" /> Print label</button>
        </div>
      </div>
    </div>);
}

/* The full-page Order Detail — layout skeleton (header, progress, 2-col grid) */
function LabelScreen({ state = "ready", mobile = false, onBack, interactive = false }) {
  const [live, setLive] = React.useState(state);
  const st = interactive ? live : state;
  const cod = st === "cod-blocked";
  const pending = st === "pending";
  const shipping = st === "shipping";
  const completed = st === "completed";
  const [didCancel, setDidCancel] = React.useState(false);
  const cancelled = st === "cancelled" || didCancel;
  const success = st === "success" || st === "print";
  const shipped = st === "self-shipped";
  const busy = st === "submitting" || st === "paying";
  const current = completed ? 5 : shipping ? 3 : shipped ? 3 : success ? 2 : cancelled ? 2 : pending ? 0 : 1;
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [printOpen, setPrintOpen] = React.useState(st === "print");
  const startShip = React.useCallback(() => {
    setLive("submitting");
    setTimeout(() => setLive("paying"), 1400);
    setTimeout(() => setLive("success"), 2900);
  }, []);
  const confirmOrder = React.useCallback(() => setLive("ready"), []);
  const statusBadge = completed ?
  { cls: "ok", ic: "badge-check", text: "Completed" } :
  shipping ? { cls: "blue", ic: "truck", text: "Shipping" } :
  success ? { cls: "ok", ic: "package-check", text: "Ready to ship" } :
  shipped ? { cls: "ok", ic: "truck", text: "Shipped" } :
  cancelled ? { cls: "danger", ic: "x-circle", text: "Cancelled" } :
  pending ? { cls: "warn", ic: "clock", text: "Pending" } :
  cod ? { cls: "warn", ic: "ban", text: "Action needed" } :
  st === "error" ? { cls: "warn", ic: "circle-alert", text: "Action needed" } :
  { cls: "blue", ic: "circle-check", text: "Confirmed" };
  return (
    <div className={`f36 f36-dash ${mobile ? "m375" : ""}`} data-theme="dark">
      <C_Dash crumbs={["Orders"]} active="orders">
        <div className="dash-page od-page">
          <div className="od-page-head">
            <a className="od-back" onClick={onBack} style={onBack ? { cursor: "pointer" } : null}><CIcon name="arrow-left" /> Orders</a>
            <div className="od-title-row">
              <h1>Order Details</h1>
              <span className="od-id-pill">ORD-PRM1042-7K3M</span>
              <span className={`od-status ${statusBadge.cls}`}><CIcon name={statusBadge.ic} /> {statusBadge.text}</span>
              <span className="od-date"><CIcon name="calendar" /> Created 16 Jun 2026 · 14:32</span>
            </div>
          </div>
          {/* Progress spans full width above the two columns */}
          <section className="od-card od-progress">
            <div className="od-cap">Order Progress</div>
            <Stepper current={current} loading={busy} cancelled={cancelled} cancelDate="16 Jun, 15:04" />
          </section>
          <div className="od2">
            {/* LEFT 65% — fulfillment + items */}
            <div className="od2-main">
              <section className="od-card od-fulfil">
                <div className="od-cap"><CIcon name="truck" /> Shipping Fulfillment</div>
                <ActionZone state={cancelled ? "cancelled" : success ? "success" : st} onPrint={() => setPrintOpen(true)} onShip={startShip} onConfirmOrder={confirmOrder} />
              </section>
              <section className="od-card">
                <div className="od-cap"><CIcon name="package" /> Order Items</div>
                <ItemsTable />
              </section>
            </div>
            {/* RIGHT 35% — reconciliation */}
            <div className="od2-side">
              <section className="od-card">
                <div className="od-cap">Customer Information</div>
                <InfoRow ic="user" label="Name" value="Aisyah Rahman" />
                <InfoRow ic="phone" label="Phone" value="+60 12-345 6789" />
                <InfoRow ic="mail" label="Email" value="aisyah.rahman@gmail.com" />
                <InfoRow ic="map-pin" label="Address" tone="teal"
                value={cod ? "12, Jalan Gaya, Kota Kinabalu, 88000, Sabah, Malaysia" :
                "27, Jalan Kenanga 3, Petaling Jaya, 47100, Selangor, Malaysia"} />
                {cod &&
                <div className="od-region">
                    <span className="region-badge blocked"><CIcon name="ban" /> East Malaysia · COD blocked</span>
                  </div>
                }
                <InfoRow ic="sticky-note" label="Notes" tone="amber"
                value={cod ? "None" : "Please pack carefully — fragile. Deliver during office hours (9am–5pm)."} />
              </section>
              <section className="od-card">
                <div className="od-cap">Payment Information</div>
                <InfoRow ic="credit-card" label="Method" value={(cod || pending) ? "Cash on delivery" : "Stripe"} />
                <div className="od-info">
                  <span className="od-info-ic"><CIcon name="circle-check" /></span>
                  <div className="od-info-tx"><div className="od-info-l">Status</div>
                    <div className={`od-info-v ${(cod || pending) ? "amber" : "ok"}`}>{pending ? "Awaiting confirmation" : cod ? "Collect on delivery" : "Paid"}</div></div>
                </div>
              </section>
              {!success && !shipped && !cancelled && !shipping && !completed &&
              <section className="od-card">
                  <div className="od-cap">Order Actions</div>
                  <div className="pay-actions single">
                    <button className="btn btn-danger-soft" onClick={() => setCancelOpen(true)}><CIcon name="x-circle" /> Cancel order</button>
                  </div>
                  <p className="od-action-note"><CIcon name="info" /> Cancelling a paid order refunds the buyer automatically. Returns &amp; refunds for shipped orders are handled in Returns.</p>
                </section>
              }
            </div>
          </div>
        </div>
      </C_Dash>
      {cancelOpen && <CancelDialog orderId="ORD-PRM1042-7K3M" onBack={() => setCancelOpen(false)} onConfirm={() => { setDidCancel(true); setCancelOpen(false); }} />}
      {printOpen && <PrintLabelModal onClose={() => setPrintOpen(false)} />}
    </div>);
}

window.LabelScreen = LabelScreen;
