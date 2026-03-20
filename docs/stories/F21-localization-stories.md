# User Stories: Localization & Multi-language (F21)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F21 — Localization (BM/EN)
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F21-localization.md](../prd/F21-localization.md)

---

## US-F21-01: Language Switcher on Login/Auth Screens

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   Store Owner or Staff (Malaysian SME)
I want to change the language on the login or registration screen
So that I can understand the authentication steps in my preferred language (BM or EN)
```

### Acceptance Criteria

#### AC-1: Display Switcher on Auth Header

```gherkin
GIVEN the user is on the Login, Register, or Forgot Password screen
WHEN  they look at the top right corner of the header
THEN  they should see a Language Switcher toggle (e.g., EN | BM)
```

#### AC-2: Switching Language

```gherkin
GIVEN the user is on the Login screen in English
WHEN  they click "BM" on the Language Switcher
THEN  all text on the screen (labels, placeholders, buttons) immediately translates to Bahasa Melayu
  AND the page does not do a full reload (smooth transition)
```

---

## US-F21-02: Language Switcher on CMS Layout Header

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   Logged-in Store Owner
I want a highly visible language toggle on the CMS top header
So that I can switch between BM and EN at any time while managing my Webstore 2.0 without navigating to abstract settings
```

### Acceptance Criteria

#### AC-1: CMS Header Location

```gherkin
GIVEN the user is logged into the CMS
WHEN  they look at the Top Header (F18 Layout)
THEN  they should see a quick Language Switcher (e.g., 🌐 EN / BM) placed directly on the header, next to the Notification Bell
```

#### AC-2: Global Content Translation

```gherkin
GIVEN the user is working in the CMS (e.g., Products or Orders screen)
WHEN  they switch the language from EN to BM
THEN  all static CMS UI elements (Sidebar, Top Header, Buttons, Table Headers) translate to Bahasa Melayu instantly
  AND their dynamic data (like Product names they typed) remains exactly as inputted
```

---

## US-F21-03: Language Preference Persistence

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   Store Owner
I want the system to remember my language preference
So that I don't have to change it every time I log in
```

### Acceptance Criteria

#### AC-1: Persist for Guest (Local Storage)

```gherkin
GIVEN an unauthenticated user changes the language to BM on the Login screen
WHEN  they close the tab and reopen the Login screen later
THEN  the screen should load in BM by default
```

#### AC-2: Persist for Authenticated User (Database)

```gherkin
GIVEN a logged-in user changes the language in the CMS to BM
WHEN  they log out and log back in from another device
THEN  their CMS dashboard should automatically load in BM based on their saved profile settings
```

### Additional Criteria

- [ ] Các định dạng ngày tháng (Date/Time), tiền tệ (Currency - RM) phải tự động adapt theo locale tương ứng hoặc standard của Malaysia.
- [ ] Tính năng localize phải wrap toàn bộ ứng dụng bằng một i18n provider giúp reactively update UI mà không cần reload iframe hay window.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Tất cả các file JSON/Dictionary language (EN/BM) đã có cấu trúc chuẩn.

---

## US-F21-04: Mobile Web UX — Language Switcher Placement

**Wave 1** | **P1** | **S** | **Status:** Ready

### Story

```
As a   Mobile Store Owner
I want the language switcher to be neatly placed in the mobile menu
So that the small top header doesn't become cluttered and hard to tap
```

### Acceptance Criteria

#### AC-1: Mobile Header Optimization

```gherkin
GIVEN the user is logged into the CMS on a mobile device
WHEN  they look at the Top Header
THEN  the Language Switcher (🌐 EN / BM) is hidden from the main top bar to save space
  AND it is moved inside the Hamburger (☰) slide-in drawer or the Avatar dropdown menu, remaining clearly visible
```

### Definition of Done
- [ ] 9-Point Checklist pass for mobile mode.
