# Research Report: Xendit MANAGED Sub-Account Fund Custody & Malaysian Regulatory Risk
**Date:** 2026-06-10 | **Researcher:** Tech Analyst | **Project:** ECH Prime v2 / F34 Xendit Payment Integration

---

## TL;DR

**Fund Custody:** Xendit (via Payex PLT, licensed merchant acquirer) holds funds in MANAGED sub-account balances. Funds settle directly into the sub-account when buyer pays, and platform operator (your SaaS) orchestrates via `for-user-id` header but **does NOT take legal custody**. Xendit's terms covenant funds are held for merchant's sole benefit.

**Regulatory License Requirement:** Your platform **likely does NOT need a Money Services Business (MSB) license** if using a MANAGED account model where Xendit holds funds and settlement goes directly to merchant's sub-account → bank. However, **this must be confirmed in writing with Xendit (legal/sales) and ideally validated by BNM**, as there is factual ambiguity: if platform operator could be deemed an "aggregator" (funds flow through platform balance before payout), risk tier changes.

---

## FINDINGS BY SUB-QUESTION

### 1. Whose Balance Do Funds Settle Into, and Who is Legal Custodian?

**[DOCUMENTED]**

- **MANAGED accounts:** Funds settle directly into the **sub-account balance**, not master account. Platform operator routes payment via `for-user-id` header → payment goes straight to sub-account.
- **OWNED accounts:** Funds settle into master account (your account). Merchants cannot see/manage funds; you disburse to them.
- **Legal Custodian:** Xendit covenants in its service agreement that "**all funds received on your behalf shall be held for your sole benefit**" with exceptions only for deductible fees and losses legally incurred by Xendit. This holds across all account types.
- **Sub-Account Liability:** Xendit **explicitly states** platform operator is "responsible for the management of Partner Account Dashboards" and disputes between you and merchants are **your responsibility** — Xendit disclaims liability for these.

**Key distinction:** In MANAGED model, the sub-account is legally linked to the merchant (each merchant = one sub-account with separate KYB). Funds stay in that sub-account; Xendit holds them in trust per terms. Platform operator does NOT take custody — you orchestrate, Xendit custodies.

---

### 2. Does Xendit Hold a BNM License, and What Is It Licensed For?

**[DOCUMENTED]**

- **Xendit's Malaysia License:** **Payex PLT** — licensed for **Merchant Acquiring Services** by Bank Negara Malaysia (BNM).
- **License Scope:** Merchant Acquiring Services = enabling merchants to accept payments (cards, eWallets, QR, FPX) and processing settlement between buyer and merchant. **Not** an e-money issuer, **not** a Money Services Business licensee (yet), **not** a payment system operator.
- **Payex License Status:** Licensed entity confirmed on [BNM's existing regulatees list](https://www.bnm.gov.my/existing-regulatees) under Merchant Acquiring Services (Non-banks category).
- **Xendit's Regional Expansion:** Xendit entered Malaysia via investment in Payex (2023); Payex is the licensed acquirer; Xendit operates as backend partner.

**Implication:** Xendit's BNM license **covers holding and settling customer funds as a merchant acquirer**. Your platform is not licensed; Xendit is. You are a SaaS customer of Xendit's acquiring service.

---

### 3. Does a Malaysian SaaS Platform Need a License When Using MANAGED Sub-Accounts (No Fee-Taking)?

**[INFERRED + DOCUMENTED]**

This is the critical question and **not completely answered** in public docs. Here's what is documented and inferred:

**Documented Facts:**
- **MSB License** (Money Services Business Act 2011) is required for entities "carrying on business of money services" = handling fund transfers, remittance, foreign exchange, etc. — **not** for pure merchant acquiring.
- **Merchant Acquiring License** (Section 17 FSA) is required for entities enabling merchants to accept payments — **requires BNM registration**.
- **Settlement Model Matters:** Xendit terms distinguish **Aggregator vs. Switcher**:
  - **Aggregator:** Funds settle to Xendit's account, then Xendit disburses to merchant (Xendit holds balance).
  - **Switcher:** Funds settle directly to merchant's bank account (direct settlement, minimal holding).

**Your Model (MANAGED with for-user-id):**
- Operates like a **"Switcher" hybrid**: Payment routed via `for-user-id` → sub-account balance → merchant-initiated withdrawal to bank.
- Platform operator never receives funds in master account (per your design).
- **Xendit is the aggregator** (holds sub-account balance initially); **You are the orchestrator** (route via API, no fund custody).

**Inference:** If you are a **pure SaaS** (website-builder, checkout orchestrator, NOT holding or controlling fund flow), **you likely do NOT need an MSB or Merchant Acquiring license**. Xendit (as licensed acquirer) is responsible for settlement compliance.

**However — Critical Risk:**
- BNM/Xendit could argue that if your platform has operational control over disbursement (e.g., auto-withdrawal scheduling, split rules, transfer API), you are a **"de facto aggregator"** and should be licensed.
- **This ambiguity must be resolved in writing** before launch.

**Real-World Precedent:** SUNRATE received MSB approval because it was operating a money services business (transfers, FX, remittance). Your model is different: you are a checkout/website builder, not a money services operator. But the line is not bright in BNM guidance.

---

### 4. What Does Xendit Put in Writing (DPA, Agreement, Terms) About Fund Custody?

**[DOCUMENTED]**

**Xendit's Covenant on Fund Custody:**

From Xendit Service Agreement (Regional Payments Contract T&Cs):
> "All funds Xendit receives on your behalf...will be held for your sole benefit, except for expenses, fees, costs or charges owed by you to Xendit or losses legally incurred by Xendit as a result of your actions."

**Sub-Account Responsibility Clause:**
> "Customer [Platform] is solely responsible for the nature and quality of products/services provided through connected accounts."

> "Customer shall ensure copies of agreements with merchants are available for inspection upon request."

**Xendit's Disclaimer:**
> "Xendit is not responsible (whether directly or indirectly) for any matter in respect of settlement, which is managed solely between the merchant and the appointed acquiring bank."

**Liability Limits:**
- Annual liability capped at **50% of Fees paid in that Year**.
- Xendit excludes liability for fraudulent transactions, chargebacks, bank errors.
- Platform operator must indemnify Xendit for breaches, disputes with merchants, invalid payments.

**DPA Status:** Xendit has standard terms but **no separate Data Processing Agreement published online**. DPA must be negotiated during Phase 0 (pre-contract).

**Key Gap:** The terms do NOT explicitly state whether a platform operator using MANAGED accounts + Transfer API + auto-disbursement is deemed a "custodian" or merely an "orchestrator". This must be clarified in writing during DPA negotiation.

---

### 5. Nuances Where Platform Could Inadvertently Take Custody

**[INFERRED]**

Risk scenarios where platform could be deemed to hold/escrow funds (triggering licensing):

| Scenario | Risk Level | Mitigation |
|----------|-----------|-----------|
| **Using Transfers API to move funds between sub-accounts or to master** | HIGH | Don't. Transfers API is for moving bulk funds; use only Withdrawal API (merchant → bank direct). Keep Transfer API read-only. |
| **Holding balance in master account, then disbursing via batch transfer** | CRITICAL | Never. Funds must stay in sub-account; merchant initiates withdrawal. Auto-withdrawal = Xendit-scheduled, not platform-initiated. |
| **Split Rules routing portion to master account (platform fee)** | MEDIUM | Permissible per Xendit terms for transaction fees (MDR + platform fees deducted at settlement). But if platform is NOT registered as merchant acquirer, BNM could argue you are taking an unauthorized cut. Clarify fee structure in DPA. |
| **Manual holds, freezes, or delayed release of sub-account balance** | HIGH | Don't. All balance must be immediately available to merchant for withdrawal. Holdback = custody. |
| **Receiving funds from buyer first, then routing to sub-account** | CRITICAL | Impossible with Xendit: for-user-id routes directly. No intermediation. This is your architectural safety guard. |
| **Operating as both orchestrator + settlement intermediary** | CRITICAL | Don't. Be clear in DPA: Xendit settles directly to merchant's nominated bank, not platform. |

**Safest Design (Your Current Plan):**
- ✅ One MANAGED sub-account per merchant.
- ✅ For-user-id routes payment directly to sub-account (no master account involvement).
- ✅ Sub-account balance available to merchant at all times.
- ✅ Merchant initiates withdrawal or Xendit auto-withdraws on schedule (NOT platform-initiated).
- ✅ Platform fee (if charged) deducted as transaction fee, not as balance hold/transfer.

---

## RISKS & WHAT MUST BE CONFIRMED IN WRITING

### Critical (Must Confirm Before Sprint 1):

1. **Fund Custody Classification** — Ask Xendit legal:
   > "In MANAGED sub-account model where platform operator routes payments via for-user-id and merchant can withdraw balance anytime, is the platform operator deemed a custodian or merely a service orchestrator? Does BNM consider this aggregator or switcher?"
   
   **Why:** If BNM says "aggregator," you may need MSB license.

2. **Regulatory Responsibility Split** — Ask Xendit:
   > "If settlement is direct (via auto-withdrawal or merchant-initiated), which entity is responsible to BNM for AML/KYC on the sub-account holder? Is it Xendit or the platform operator?"
   
   **Why:** Could trigger your licensing if you're deemed responsible for merchant onboarding compliance.

3. **DPA & Data Processing** — Negotiate DPA with Xendit that explicitly:
   - Xendit = Data Controller for customer funds.
   - Platform = Data Processor / Service Orchestrator (no fund control).
   - Platform indemnified from Xendit's failure to hold funds securely.

4. **Transfer API Usage Prohibition** — Confirm in writing:
   > "Platform will NOT use Transfers API to move sub-account balance to master or between accounts. Settlement is withdrawal-only (merchant → bank). Does this avoid license requirement?"
   
   **Why:** Transfers API is the main risk vector for inadvertent custody.

### High (Should Confirm):

5. **BNM Pre-Approval** — If possible, get Xendit to facilitate a brief written inquiry to BNM asking: "Does a SaaS platform using MANAGED sub-accounts with direct settlement need an MSB/Merchant Acquiring license if it does NOT take transaction fees and does NOT control fund timing?"
   
   **Why:** BNM guidance is limited; a written response removes ambiguity.

6. **Fee Structure Clarity** — Confirm Xendit will deduct platform fees at transaction settlement (not as balance hold). Document this in DPA.

### Medium (Good to Have):

7. **Webhooks & Audit Trail** — Confirm Xendit provides audit logs proving fund flow went directly to sub-account (for compliance defense if queried by BNM).

8. **Compliance Playbook** — Request Xendit's standard compliance playbook for platform operators in Malaysia (KYC delegation, AML monitoring, dispute handling).

---

## SOURCES

### Xendit Documentation & Legal

- [Xendit Licenses — Official](https://www.xendit.co/en/company/xendit-licenses/)
- [Xendit Service Agreement — Regional Payments Contract T&Cs](https://www.xendit.co/en/xendit-service-agreement/)
- [Local Payments Contract T&Cs — Xendit](https://www.xendit.co/en/legal-local-contract/)
- [Sub-Account Types — Xendit Docs](https://docs.xendit.co/docs/sub-accounts)
- [Settlement Overview — Xendit Docs](https://docs.xendit.co/settlement)
- [for-user-id Parameter Usage — Xendit Help](https://help.xendit.co/hc/en-us/articles/10534695308185-How-Do-I-Use-for-user-id-Parameter-to-Do-Transaction-as-Master-Account-on-Behalf-of-my-Sub-Account)
- [Switcher vs Aggregator Model — Xendit Help](https://help.xendit.co/hc/en-us/articles/31902742050201-What-is-the-difference-between-Aggregator-and-Switcher-Model-for-VA)
- [Managed Sub-Accounts — Xendit Docs](https://docs.xendit.co/xenplatform/accounts/managed)

### Bank Negara Malaysia (BNM) Regulations

- [BNM Existing Regulatees — Official](https://www.bnm.gov.my/existing-regulatees) (Payex PLT confirmed listed)
- [Money Services Business — BNM](https://www.bnm.gov.my/money-services-business)
- [MSB Operators List — BNM](https://www.bnm.gov.my/msb-operators)
- [Merchant Acquiring Services Policy Document — BNM](https://www.bnm.gov.my/-/pd-merchant-acquiring-services)
- [Application for Approval to Operate a Payment System — BNM](https://www.bnm.gov.my/index.php?ch=ps&pg=ps_legal_appl&ac=185&lang=en)

### Malaysian Payment Regulation & SaaS Context

- [Payment Gateways vs Payment Processors in Malaysia (2026) — Airwallex](https://www.airwallex.com/my/blog/payment-gateway-vs-payment-processor)
- [Setting up a Money Services Business in Malaysia — Nazmi Zaini Chambers](https://nzchambers.com/setting-up-a-money-services-business-in-malaysia/)
- [SUNRATE MSB License Announcement — SUNRATE](https://www.sunrate.com/newsroom/sunrate-secures-money-services-business-msb-licence-from-bank-negara-malaysia-establishes-malaysia-as-global-operations-centre/)

### Project Context

- [Local Payments Contract T&Cs — Xendit](https://www.xendit.co/en/legal-local-product/)
- [Regional Payments Contract T&Cs — Xendit](https://www.xendit.co/en/legal-regional-contract/)

---

## UNRESOLVED QUESTIONS (Must Ask Xendit/BNM)

1. **Regulatory Classification:** Is platform operator operating as "aggregator" or "orchestrator" in your model? Who is regulated party?
2. **DPA & Custody Clause:** Will Xendit include explicit clause that platform is NOT a custodian/fund holder in MANAGED model?
3. **Transfer API Risk:** Does using Transfer API to move funds between accounts (even if only for admin/testing) trigger aggregator classification?
4. **BNM Precedent:** Has Xendit worked with other SaaS platforms in Malaysia? What was BNM's position?
5. **Fee Routing:** Can platform fees be deducted at settlement without triggering MSB license, or must fees come from a different revenue stream (e.g., subscription)?
6. **Withdrawal Automation:** Does auto-withdrawal (Xendit-scheduled, platform-configured) count as platform "controlling" fund timing, or is it Xendit-driven?
7. **Onboarding Liability:** If merchant KYB is done via Xendit's Account Holder API, is platform responsible for AML/KYC compliance, or Xendit?

---

## RECOMMENDATION

**Status:** ✅ **PROCEED with caution** — Risk is **MEDIUM**, manageable with clarity.

**Next Step (Phase 0 — Before Sprint 1):**

1. **Schedule call with Xendit sales + legal:** Present your MANAGED sub-account architecture (for-user-id, direct settlement, no fund custody, no transaction fees). Ask explicit question: "Will you confirm in writing that our platform does NOT need a Malaysian financial license, and that you (Xendit/Payex) are the sole custodian and regulated party?"

2. **Request DPA amendments** to explicitly state:
   - Xendit is data controller for customer funds.
   - Platform is service provider/orchestrator only.
   - Platform indemnified from Xendit's fund-handling failures.
   - Platform will NOT use Transfers API to move sub-account balance.

3. **Optional but recommended:** Have a Malaysian fintech legal firm (e.g., Nazmi Zaini Chambers, Allen & Gledhill) review Xendit's terms + your architecture (1–2 hour review, ~RM500–1000). Ask specifically: "Does this trigger MSB or Merchant Acquiring license requirement?"

4. **Do NOT launch Sprint 1** until (1) + (2) + ideally (3) are done. Xendit will likely confirm no license needed, but written confirmation is your defense if BNM ever asks.

**Confidence Level:** 75% confident no license is needed based on documented regulatory framework + Xendit's terms. But 25% uncertainty remains until Xendit & BNM confirm in writing.

---

**Report prepared:** 2026-06-10 | **Token efficiency:** Moderate (research used fan-out query technique across 10+ official sources)
