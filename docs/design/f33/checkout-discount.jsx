/* F33 — S3 · Checkout discount field (storefront, all gateways)
   Self-contained order-summary panel. Discount applies to subtotal only;
   invalid codes are silently rejected (no error) and the order proceeds at
   full price. Identical UX for COD, QR-banking, and Stripe. */

const CART = [
  { id: 1, name: "Aurora Songket Shawl", meta: "Indigo · 1", priceSen: 7900, icon: "shirt" },
  { id: 2, name: "Batik Pouch (set of 2)", meta: "Maroon · 1", priceSen: 2100, icon: "shopping-bag" },
];
const SUBTOTAL = 10000;   // RM 100.00
const SHIPPING = 1000;    // RM 10.00
const TAX_RATE = 0.06;    // SST 6% on (subtotal + shipping)

/* Valid codes the storefront would resolve. Invalid ones → silent reject. */
const STOREFRONT_CODES = {
  SUMMER50: { type: "percentage", value: 50, ok: true },
  RAYA15:   { type: "percentage", value: 15, ok: true },
  VIP100:   { type: "fixed",      value: 10000, ok: true },
  WELCOME:  { type: "fixed",      value: 2500, ok: false, reason: "at-limit" },   // 100/100
  EXPIRED99:{ type: "percentage", value: 99, ok: false, reason: "expired" },
  OLD2025:  { type: "percentage", value: 10, ok: false, reason: "inactive" },
};

const rm = (sen) => "RM " + (sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const computeTotals = (applied) => {
  let discount = 0;
  if (applied) {
    discount = applied.type === "percentage"
      ? Math.round(SUBTOTAL * applied.value / 100)
      : Math.min(applied.value, SUBTOTAL);
  }
  const tax = Math.round((SUBTOTAL + SHIPPING) * TAX_RATE);
  const total = Math.max(0, SUBTOTAL - discount + SHIPPING + tax);
  return { discount, tax, total };
};

const GATEWAYS = [
  { id: "cod", label: "Cash on Delivery", icon: "banknote" },
  { id: "qr", label: "QR / Bank Transfer", icon: "qr-code" },
  { id: "stripe", label: "Card — Stripe", icon: "credit-card" },
];

const CheckoutDiscount = ({ initialState, gateway, setGateway }) => {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(null);     // {code, type, value}
  const [phase, setPhase] = useState("empty");       // empty | applying | applied | rejected
  const [flash, setFlash] = useState(false);         // brief "checking" on invalid
  const timerRef = useRef();

  /* react to tweak-driven preset state */
  useEffect(() => {
    if (initialState === "applied") {
      setApplied({ code: "SUMMER50", type: "percentage", value: 50 }); setPhase("applied"); setCode("");
    } else if (initialState === "invalid") {
      setApplied(null); setPhase("rejected"); setCode("");
    } else if (initialState === "applying") {
      setApplied(null); setPhase("applying"); setCode("SUMMER50");
    } else {
      setApplied(null); setPhase("empty"); setCode("");
    }
    return () => clearTimeout(timerRef.current);
  }, [initialState]);

  const apply = () => {
    const key = code.trim().toUpperCase();
    if (!key) return;
    setPhase("applying");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const found = STOREFRONT_CODES[key];
      if (found && found.ok) {
        setApplied({ code: key, type: found.type, value: found.value });
        setPhase("applied");
        setCode("");
      } else {
        /* silent reject — no error, clear the field, full price */
        setApplied(null);
        setPhase("rejected");
        setCode("");
        setFlash(true);
        setTimeout(() => setFlash(false), 1400);
      }
    }, 850);
  };

  const remove = () => { setApplied(null); setPhase("empty"); setCode(""); };

  const { discount, tax, total } = computeTotals(applied);

  return (
    <div className="ck-page mobile s3-stage">
      <div className="s3-shell">
        <div className="s3-storehead">
          <span className="s3-store-mark"><i data-lucide="mouse-pointer-click" /></span>
          <div>
            <div className="s3-store-name">Aurora Batik</div>
            <div className="s3-store-step">Checkout · Order summary</div>
          </div>
          <span className="secure-chip s3-secure"><i data-lucide="shield-check" />Secure</span>
        </div>

        <div className="summary-card s3-card">
          <h3 className="summary-head">Order Summary</h3>

          <ul className="summary-items">
            {CART.map((it) => (
              <li className="summary-item" key={it.id}>
                <div className="item-thumb"><i data-lucide={it.icon} /></div>
                <div className="item-info">
                  <div className="item-name">{it.name}</div>
                  <div className="item-meta">{it.meta}</div>
                </div>
                <span className="item-price">{rm(it.priceSen)}</span>
              </li>
            ))}
          </ul>

          {/* ── Discount field ── */}
          <div className="s3-promo">
            <label className="s3-promo-label">Discount or promo code</label>

            {phase !== "applied" ? (
              <>
                <div className={`s3-promo-input ${flash ? "flash" : ""}`}>
                  <i data-lucide="tag" />
                  <input
                    placeholder="Enter code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && apply()}
                    disabled={phase === "applying"}
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                  <button className="s3-apply" onClick={apply} disabled={phase === "applying" || !code.trim()}>
                    {phase === "applying" ? <span className="s3-spin"><i data-lucide="loader-2" /></span> : "Apply"}
                  </button>
                </div>
                {phase === "rejected" && (
                  <div className="s3-hint">
                    <i data-lucide="info" />
                    That code couldn't be applied — your order continues at full price.
                  </div>
                )}
                {phase === "empty" && (
                  <div className="s3-hint subtle">
                    <i data-lucide="info" />
                    <span>One code per order. Try <button className="s3-try" onClick={() => setCode("SUMMER50")}>SUMMER50</button>.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="s3-applied">
                <span className="s3-applied-tick"><i data-lucide="check" /></span>
                <div className="s3-applied-body">
                  <div className="s3-applied-code"><span className="code-chip">{applied.code}</span> applied</div>
                  <div className="s3-applied-sub">
                    {applied.type === "percentage" ? `${applied.value}% off subtotal` : `${rm(applied.value)} off`}
                  </div>
                </div>
                <button className="s3-remove" onClick={remove}><i data-lucide="x" />Remove</button>
              </div>
            )}
          </div>

          {/* ── Breakdown ── */}
          <div className="s3-lines">
            <div className="summary-line">
              <span className="lbl"><span>Subtotal&nbsp;<span style={{ color: "var(--ck-fg-4)" }}>({CART.length} items)</span></span></span>
              <span className="val">{rm(SUBTOTAL)}</span>
            </div>
            {applied && (
              <div className="summary-line s3-discount-line">
                <span className="lbl">
                  <i data-lucide="tag" />
                  Discount {applied.type === "percentage" ? `(${applied.value}%)` : ""}
                </span>
                <span className="val">−{rm(discount)}</span>
              </div>
            )}
            <div className="summary-line">
              <span className="lbl">Shipping (West MY)</span>
              <span className="val">+{rm(SHIPPING)}</span>
            </div>
            <div className="summary-line">
              <span className="lbl">SST (6%)</span>
              <span className="val">+{rm(tax)}</span>
            </div>
          </div>

          <div className="summary-total">
            <span className="t-lbl">Total</span>
            <span className="t-val"><span className="ccy">RM </span>{(total / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {applied && (
            <div className="s3-savings"><i data-lucide="party-popper" /><span>You saved {rm(discount)} on this order</span></div>
          )}

          {/* ── Gateway (parity across all three) ── */}
          <div className="s3-gateways">
            {GATEWAYS.map((g) => (
              <button key={g.id} className={`s3-gw ${gateway === g.id ? "on" : ""}`} onClick={() => setGateway && setGateway(g.id)}>
                <i data-lucide={g.icon} />{g.label}
              </button>
            ))}
          </div>

          <button className="place-order s3-place">
            <i data-lucide="lock" />
            {gateway === "stripe" ? `Pay ${rm(total)}` : gateway === "qr" ? "Continue to bank transfer" : "Place order"}
          </button>
          <div className="summary-trust"><i data-lucide="shield-check" />Charged exactly {rm(total)} · same on receipt</div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CheckoutDiscount });
