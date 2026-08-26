# Test Convention — ECH Prime Web v2

> Chuẩn bắt buộc cho mọi dev + AI agent khi viết unit tests.
> Mọi test phải follow doc này. CI sẽ reject tests không đạt chuẩn.

---

## 1. File Structure

```
src/__tests__/
  ├── unit/                          # Unit tests
  │   ├── auth/                      # F02 Auth
  │   │   ├── auth-validation.test.ts
  │   │   └── rate-limit-auth.test.ts
  │   ├── builder/                   # F01 AI Builder
  │   │   ├── builder-store.test.ts
  │   │   └── business-info-form.test.tsx
  │   ├── dashboard/                 # F03 Dashboard, F08 Products, F10 Orders
  │   ├── editor/                    # F05 AI Editor
  │   ├── stores/                    # Zustand stores
  │   ├── blocks/                    # F04 Block renderer
  │   ├── email/                     # Email templates
  │   ├── otp/                       # OTP generation
  │   ├── payment/                   # F13 Stripe
  │   ├── storefront/                # F09 Storefront
  │   └── localization/              # F21 i18n
  ├── api/                           # API route tests
  │   ├── health.test.ts
  │   ├── products.test.ts
  │   └── sites.test.ts
  └── helpers/
      └── setup.ts                   # Global test setup (vi.mock @payload-config)
```

**Quy tắc:**
- File test đặt trong `src/__tests__/unit/{feature}/` — KHÔNG đặt cạnh source
- Tên file: `{module-name}.test.ts` (logic) hoặc `.test.tsx` (React component)
- Group theo feature (auth, builder, dashboard) — không theo file type

---

## 2. Test Naming — BẮT BUỘC reference TC-ID

Mỗi test PHẢI map đến TC-ID trong `docs/qa/F*.md`. QA đã define test cases — dev/AI chỉ cần implement.

### Cách 1: TC-ID trong describe title (recommend)

```typescript
// ── TC-F02.23: OTP Generation ───────────────────
describe('[TC-F02.23] OTP Generation (6-digit random code)', () => {
    it('returns a 6-digit numeric string', () => {})
    it('returns different codes on multiple calls (not static)', () => {})
    it('never truncates leading zeros', () => {})
})
```

### Cách 2: TC-ID trong test name

```typescript
describe('BusinessInfoForm', () => {
    it('TC-F01.04: renders all 4 required fields', () => {})
    it('TC-F01.05: blocks submit when required fields empty', () => {})
    it('TC-F01.07: prevents XSS injection in form inputs', () => {})
})
```

### Cách 3: TC-ID trong comment header

```typescript
// ── TC-F01.04–07: Form Validation ──────────────────
describe('BusinessInfoForm — Validation', () => {
    it('renders business name, industry, description, products fields', () => {})
    it('shows error when submit with empty fields', () => {})
})
```

### ❌ KHÔNG CHẤP NHẬN

```typescript
describe('test form', () => {})           // Không có TC-ID
it('should work', () => {})               // Không mô tả behavior
it('test1', () => {})                     // Vô nghĩa
```

---

## 3. AAA Pattern — Bắt buộc

Mọi test phải có 3 phần rõ ràng: **Arrange → Act → Assert**

```typescript
it('TC-F02.23: returns a 6-digit numeric string', () => {
    // Arrange — không cần setup cho pure function

    // Act
    const otp = generateOTP()

    // Assert
    expect(otp).toMatch(/^\d{6}$/)
})
```

```typescript
it('TC-F01.05: blocks submit when business name empty', async () => {
    // Arrange
    const onSubmit = vi.fn()
    render(<BusinessInfoForm onSubmit={onSubmit} />)

    // Act
    await fireEvent.click(screen.getByRole('button', { name: /create/i }))

    // Assert
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/business name is required/i)).toBeVisible()
})
```

---

## 4. Import Rules

### ✅ BẮT BUỘC: Import từ source code thật

```typescript
import { generateOTP, hashOTP, verifyOTP } from '@/lib/otp/generate'
import { validateForm } from '@/components/dashboard/ProductForm'
import { loginSchema } from '@/app/(auth)/login/page'
import { useBuilderStore } from '@/store/builderStore'
```

### ❌ CẤM: Re-implement logic trong test

```typescript
// NEVER DO THIS — nếu source thay đổi, test vẫn pass → false positive
const validateForm = (data) => {
    if (!data.name) return { error: 'Name required' }
    return { success: true }
}
```

### ❌ CẤM: Import từ đường dẫn tương đối dài

```typescript
// ❌
import { func } from '../../../components/dashboard/ProductForm'

// ✅ Dùng alias
import { func } from '@/components/dashboard/ProductForm'
```

---

## 5. Mock Patterns

### vi.mock() phải ở TOP FILE, trước mọi import

```typescript
// ✅ ĐÚNG
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    usePathname: vi.fn(() => '/dashboard'),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Import SAU mock
import { ComponentName } from '@/components/ComponentName'
```

### ❌ CẤM: vi.mock() bên trong test function

```typescript
it('test something', () => {
    vi.mock('...') // ❌ WRONG — Vitest hoists this, unpredictable behavior
})
```

### Mock toggle pattern (cho conditional behavior)

```typescript
let mockAuthUser: any = { id: 1, roles: ['tenant-owner'] }

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => mockAuthUser),
}))

describe('Auth-dependent feature', () => {
    it('allows access for owner', () => {
        mockAuthUser = { id: 1, roles: ['tenant-owner'] }
        // ... test
    })

    it('blocks access for viewer', () => {
        mockAuthUser = { id: 2, roles: ['viewer'] }
        // ... test
    })
})
```

---

## 6. Cleanup — Bắt buộc

```typescript
beforeEach(() => {
    vi.clearAllMocks()     // Reset mock call counts
    localStorage.clear()   // Reset browser storage
})

afterEach(() => {
    vi.useRealTimers()     // Reset fake timers
})
```

**Cho Zustand stores:**
```typescript
beforeEach(() => {
    useBuilderStore.getState().reset()  // Reset store state
})
```

---

## 7. Test Types — Khi nào dùng cái nào

| Source code | Test type | File đuôi | Pattern |
|---|---|---|---|
| Utility function (`src/lib/`) | Pure unit test | `.test.ts` | Input → output, không mock |
| Zustand store (`src/store/`) | Store test | `.test.ts` | `getState().action()` → verify state |
| React component (`src/components/`) | Render test | `.test.tsx` | `render()` → query DOM → assert |
| API route (`src/app/api/`) | API test | `.test.ts` | Mock Payload → call handler → verify response |
| Zod schema | Validation test | `.test.ts` | `schema.safeParse(data)` → assert success/error |
| Email template | Snapshot test | `.test.ts` | Verify HTML output contains expected content |

### Exemplary test files (copy pattern từ đây):

| Pattern | File | Score |
|---------|------|-------|
| Pure function | `src/__tests__/unit/otp/otp-generate.test.ts` | ⭐ 5/5 |
| Zustand store | `src/__tests__/unit/builder/builder-store.test.ts` | ⭐ 5/5 |
| React component + TC-ID | `src/__tests__/unit/localization/f21-localization.test.tsx` | ⭐ 5/5 |
| Dashboard utils | `src/__tests__/unit/dashboard/dashboard-utils.test.ts` | ⭐ 5/5 |

---

## 8. Test Coverage Requirements

### Bắt buộc:
- Mỗi TC marked `[x] AUTO` trong `docs/qa/F*.md` → PHẢI có unit test
- TC severity **Blocker/Critical** → bắt buộc có test
- Code mới trong PR → phải kèm test (CI block nếu coverage giảm)

### Coverage targets (deadline 15/04/2026):

| Metric | Min (CI block) | Target |
|--------|---------------|--------|
| Lines | 18% | 60% |
| Branches | 50% | 50% |
| Functions | 40% | 50% |
| Statements | 18% | 60% |

### Optional:
- TC severity **Medium/Low** → nên có nhưng không bắt buộc
- Visual/UX tests (marked `[ ]` trong QA docs) → manual only

---

## 9. Anti-Patterns — CẤM

| Anti-pattern | Ví dụ | Tại sao sai |
|---|---|---|
| Test implementation details | `expect(component.state.count).toBe(1)` | Break khi refactor |
| Over-mocking | Mock function đang test | Test không verify gì |
| Re-implement source logic | Copy validateForm vào test | False positive khi source đổi |
| Hardcoded DB IDs | `tr[data-product-id='1']` | Fail trên environment khác |
| console.log trong test | `console.log(result)` | Noise trong CI output |
| Empty catch | `catch (e) {}` | Nuốt lỗi, test pass sai |
| Conditional assertion | `if (result) expect(...)` | Test có thể skip assert |
| setTimeout | `await new Promise(r => setTimeout(r, 1000))` | Flaky, dùng vi.useFakeTimers() |
| Test không có assert | `render(<Component />)` rồi không expect gì | Vô nghĩa |
| vi.mock() trong it() | `it('test', () => { vi.mock(...) })` | Vitest hoist → unpredictable |

---

## 10. Workflow: Từ QA Test Case → Unit Test

```
1. Mở docs/qa/F{XX}.md → tìm test cases marked [x] AUTO
   │
2. Đọc source code tương ứng (collection, component, API route)
   │
3. Viết test file theo convention này:
   ├── File: src/__tests__/unit/{feature}/{module}.test.ts
   ├── Imports: từ source code thật (@/ alias)
   ├── Mocks: top of file, trước imports
   ├── Describe: [TC-F{XX}.{NN}] + description
   ├── Each it(): AAA pattern
   └── Cleanup: beforeEach/afterEach
   │
4. Chạy verify: npm run test -- --run
   │
5. Check coverage: npm run test -- --coverage
   │
6. Tạo PR → CI verify → Codex review → Merge
```

---

## 11. Ví dụ hoàn chỉnh

### Pure function test (⭐ Gold standard)

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } from '@/lib/otp/generate'

// ── TC-F02.23: OTP Generation (6-digit random code) ───────────────────
describe('generateOTP', () => {
    it('returns a 6-digit numeric string', () => {
        const otp = generateOTP()
        expect(otp).toMatch(/^\d{6}$/)
    })

    it('returns different codes on multiple calls (not static)', () => {
        const otps = new Set(Array.from({ length: 20 }, () => generateOTP()))
        expect(otps.size).toBeGreaterThan(1)
    })
})

// ── TC-F02.24: OTP Verification ───────────────────────────────────────
describe('verifyOTP', () => {
    it('returns true for matching OTP', () => {
        const otp = '377528'
        const hash = hashOTP(otp)
        expect(verifyOTP(otp, hash)).toBe(true)
    })

    it('returns false for wrong OTP', () => {
        const hash = hashOTP('123456')
        expect(verifyOTP('654321', hash)).toBe(false)
    })
})
```

### React component test (⭐ Gold standard)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

import BusinessInfoForm from '@/components/builder/BusinessInfoForm'

// ── TC-F01.04–07: Business Info Form ──────────────────────────────────
describe('BusinessInfoForm', () => {
    const mockOnSubmit = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01.04: renders all 4 required fields', () => {
        render(<BusinessInfoForm onSubmit={mockOnSubmit} />)

        expect(screen.getByLabelText(/business name/i)).toBeVisible()
        expect(screen.getByLabelText(/industry/i)).toBeVisible()
        expect(screen.getByLabelText(/description/i)).toBeVisible()
        expect(screen.getByLabelText(/products/i)).toBeVisible()
    })

    it('TC-F01.05: blocks submit when required fields empty', async () => {
        render(<BusinessInfoForm onSubmit={mockOnSubmit} />)

        await fireEvent.click(screen.getByRole('button', { name: /create/i }))

        expect(mockOnSubmit).not.toHaveBeenCalled()
    })
})
```
