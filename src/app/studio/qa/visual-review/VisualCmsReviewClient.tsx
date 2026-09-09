"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Layout,
  FileText,
  ShoppingCart,
  Package,
  Percent,
  Users,
  UserPlus,
  CreditCard,
  Truck,
  Globe,
  Mail,
  Shield,
  HelpCircle,
  Bell,
  Moon,
  Sun,
  Menu as MenuIcon,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Eye,
  Check,
  Pencil,
  Sparkles,
  MousePointerClick,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  Play,
  RotateCcw,
  SlidersHorizontal,
  X,
  Plus,
  Trash2,
  Lock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Undo2,
  Redo2,
  Smartphone,
  Monitor,
  CheckCircle2,
  XCircle,
  Flame,
  Layers,
  Bot,
  Info,
  ArrowRight,
  Filter,
  Download,
  AlertCircle,
  Code2,
  Image as ImageIcon,
  CheckCheck,
  RefreshCw,
  Camera,
  ArrowLeft,
  Settings,
  Grid,
  ArrowUp,
  ArrowDown,
  Copy,
  Type,
  MessageSquare,
  Share2,
  MapPin,
  Clock,
  Tag,
  Phone,
  Video,
  List,
  Palette,
  Compass,
  Sliders,
  Upload,
  LogOut,
  Receipt,
  Gift,
  TrendingUp,
  Headphones,
  UsersRound,
  Inbox,
  Send,
  Key,
  Database,
  Building,
  CheckSquare,
  HelpCircle as QuestionIcon,
  Banknote,
  Landmark,
  QrCode,
  Calculator,
  UserCheck,
  ShieldCheck,
  Wallet,
  Sparkle,
} from "lucide-react";
import '@/app/(dashboard)/dashboard/dashboard-revamp.css';
import type { DirectoryTestCase } from "@/lib/admin/qa/test-case-directory";
import { ALL_TEST_CASES_DIRECTORY } from "@/lib/admin/qa/test-case-directory";
import { CMS_TARGET_REGISTRY, type CmsTarget } from "@/lib/admin/qa/target-registry";

// ── All CMS Page Views ────────────────────────────────────────────────────────

export type CmsPageView =
  | "dashboard"
  | "editor"
  | "blog"
  | "blog-edit"
  | "blog-create"
  | "orders"
  | "products"
  | "products-new"
  | "discounts"
  | "discounts-new"
  | "customers"
  | "customer-detail"
  | "contact-leads"
  | "payments"
  | "shipping"
  | "domains"
  | "email-templates"
  | "email-template-edit"
  | "team-account"
  | "help-center";

export type OverlayMode = "impact" | "clean";

export interface HumanReadablePR {
  id: number;
  number: number;
  title: string;
  author: string;
  branch: string;
  affectedTargetIds: string[];
  failingTestIds: string[];
  changedFiles: string[];
  summaryVi: string;
  errorExplanationVi: string;
  suggestedFixVi: string;
}

export const SAMPLE_PRS: HumanReadablePR[] = [
  {
    id: 1733,
    number: 1733,
    title: "fix(blog): AI blog post generator and category auto-tagging",
    author: "content-ai",
    branch: "fix/f17-ai-blog-assistant",
    affectedTargetIds: [
      "blog-post-management",
      "blog-category-management",
      "products-ai-description",
    ],
    failingTestIds: ["TC-F17-02-01"],
    changedFiles: [
      "src/app/api/blogs/route.ts",
      "src/app/(dashboard)/blog/[id]/page.tsx",
      "src/lib/ai/blog-generator.ts",
    ],
    summaryVi: "PR #1733: Nâng cấp AI tạo bài viết Blog & Tự động gắn danh mục",
    errorExplanationVi:
      "Khi bấm nút [✨ AI assistant] hoặc [✨ Generate with AI] trong trang Blog, API AI bị timeout và không trả về kết quả (Mã lỗi: TC-F17-02-01).",
    suggestedFixVi:
      "Cần tăng timeout cấu hình OpenAI SDK trong src/lib/ai/blog-generator.ts và bổ sung try/catch fallback.",
  },
  {
    id: 1742,
    number: 1742,
    title: "fix(editor): variant stock sync & mobile viewport drag-and-drop",
    author: "dlinh-dev",
    branch: "fix/editor-variant-stock-sync",
    affectedTargetIds: [
      "editor-productgrid-variants",
      "editor-block-content",
      "builder-preview-completion",
      "products-variants-inventory",
    ],
    failingTestIds: ["TC-F05-08-01", "TC-F40-04-02"],
    changedFiles: [
      "src/app/(editor)/editor/[siteId]/page.tsx",
      "src/components/editor/BlockInspector.tsx",
      "src/lib/editor/variant-matcher.ts",
    ],
    summaryVi: "PR #1742: Sửa kéo thả khối Editor trên Mobile & Đồng bộ tồn kho",
    errorExplanationVi:
      "Trong trang Editor, khi chuyển sang chế độ Mobile View và thao tác trên bảng thuộc tính Block, sự kiện chạm kéo thả bị treo không phản hồi (Mã lỗi: TC-F05-08-01, TC-F40-04-02).",
    suggestedFixVi:
      "Sửa lại touch event handler trong src/components/editor/BlockInspector.tsx để hỗ trợ pointer events trên mobile.",
  },
  {
    id: 1690,
    number: 1690,
    title: "feat(seo): Google Business Profile local sync & structured JsonLD",
    author: "seo-team",
    branch: "feat/f37-local-seo-schema",
    affectedTargetIds: [
      "seo-tools-automation",
      "local-seo-gbp-map",
      "public-seo-discovery",
    ],
    failingTestIds: [],
    changedFiles: [
      "src/lib/seo/local-business.ts",
      "src/components/dashboard/revamp/seo-health-card.tsx",
    ],
    summaryVi: "PR #1690: Tích hợp Google Business Profile & Schema SEO",
    errorExplanationVi: "PR này hoàn toàn khỏe mạnh, 100% Smoke tests và Schema validation đều pass.",
    suggestedFixVi: "Không có lỗi, sẵn sàng merge vào staging.",
  },
];

// ── Structured QA Bug & Testing Registry ─────────────────────────────────────

export interface QaBugItem {
  bugId: string;
  targetId: string;
  title: string;
  severity: "P0 Critical" | "P1 High" | "P2 Medium";
  status: "failing" | "in_progress" | "passed";
  page: CmsPageView;
  symptomVi: string;
  reproStepsVi: string[];
  expectedVi: string;
  actualVi: string;
  testCaseId: string;
  specFile: string;
  suggestedFixVi: string;
}

export const INITIAL_QA_BUGS: QaBugItem[] = [
  {
    bugId: "BUG-F17-02",
    targetId: "blog-post-management",
    title: "Lỗi AI Blog Assistant Timeout",
    severity: "P0 Critical",
    status: "failing",
    page: "blog",
    symptomVi: "Khi bấm nút [✨ AI assistant] hoặc [✨ Generate with AI] trong trang Blog, API OpenAI SDK bị timeout quá 10s và không sinh được bài viết.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Blog' từ thanh điều hướng bên trái.",
      "2. Bấm vào nút '✨ AI assistant' hoặc '✨ Generate with AI' ở góc trên bên phải.",
      "3. Nhập chủ đề bài viết 'Trà sữa kem cheese đặc sản' và bấm 'Tạo bài viết'.",
      "4. Quan sát: Yêu cầu bị treo quá 10 giây và báo lỗi 504 Gateway Timeout.",
    ],
    expectedVi: "AI phải sinh đầy đủ Tiêu đề, Tóm tắt, Nội dung Markdown và Tự động điền vào Form bài viết trong vòng 3 giây.",
    actualVi: "API timeout sau 10s, màn hình báo lỗi và form không được điền nội dung.",
    testCaseId: "TC-F17-02-01",
    specFile: "src/__tests__/unit/blog/ai-assistant.test.ts",
    suggestedFixVi: "Tăng timeout cấu hình OpenAI SDK trong src/lib/ai/blog-generator.ts và bổ sung cơ chế retry exponential backoff.",
  },
  {
    bugId: "BUG-F05-08",
    targetId: "editor-block-content",
    title: "Lỗi Kéo Thả & Touch Event Trên Mobile View Editor",
    severity: "P0 Critical",
    status: "failing",
    page: "editor",
    symptomVi: "Khi chuyển sang chế độ Mobile View (390px) trong Editor, thanh công cụ floating toolbar của khối Hero và các Variant selector bị đơ cảm ứng.",
    reproStepsVi: [
      "1. Truy cập vào trang 'Editor' từ menu bên trái.",
      "2. Trên thanh công cụ trên cùng, bấm chọn nút 'Mobile' (390px).",
      "3. Click chọn khối 'Hero' đang có viền xanh trên Canvas.",
      "4. Thử bấm đổi sang các Variant khác như 'Centered' hoặc 'Minimal' ở tab Block bên phải.",
      "5. Quan sát: Sự kiện chạm/click bị nuốt và không đổi được variant trên khung Mobile.",
    ],
    expectedVi: "Khi ở chế độ Mobile, bấm đổi Variant phải cập nhật ngay lập tức giao diện khối trên màn hình điện thoại.",
    actualVi: "Touch handler bị chặn do CSS pointer-events và overflow của khung điện thoại.",
    testCaseId: "TC-F05-08-01",
    specFile: "tests/editor-mobile-viewport.spec.ts",
    suggestedFixVi: "Cập nhật touch-action và z-index của container Preview Canvas trong EditorScreenStaging.",
  },
  {
    bugId: "BUG-F40-04",
    targetId: "builder-preview-completion",
    title: "Lỗi Nút 'View Live' Không Mở Tab Mới",
    severity: "P1 High",
    status: "failing",
    page: "editor",
    symptomVi: "Bấm nút màu xanh 'View live ▾' trên góc phải Header Editor nhưng website thật không được mở ra tab mới.",
    reproStepsVi: [
      "1. Tại trang Editor, nhìn lên góc trên cùng bên phải.",
      "2. Bấm nút màu xanh lá cây 'View live ▾'.",
      "3. Quan sát: Tab mới không mở ra, chỉ hiển thị thông báo toast.",
    ],
    expectedVi: "Hệ thống phải mở URL chính thức https://chin-muoi.web-v2.dev.ecommercehub.my trong tab mới.",
    actualVi: "window.open bị chặn hoặc thiếu target='_blank'.",
    testCaseId: "TC-F40-04-02",
    specFile: "tests/builder-view-live.spec.ts",
    suggestedFixVi: "Gắn thẻ <a> target='_blank' rel='noopener noreferrer' trực tiếp vào nút View live.",
  },
  {
    bugId: "BUG-F08-01",
    targetId: "orders-list-search-metrics",
    title: "Lỗi Bộ Lọc Trạng Thái Đơn Hàng Reset Khi Phân Trang",
    severity: "P1 High",
    status: "failing",
    page: "orders",
    symptomVi: "Khi lọc danh sách đơn hàng theo trạng thái 'Delivered' hoặc 'Processing', bấm chuyển trang 2 sẽ làm mất bộ lọc và hiển thị lại 'All Orders'.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Orders'.",
      "2. Chọn tab lọc 'Delivered'.",
      "3. Bấm vào nút phân trang sang 'Trang 2'.",
      "4. Quan sát: Tab lọc tự động nhảy về 'All Orders'.",
    ],
    expectedVi: "Trạng thái lọc phải được lưu trên URL query params (?status=delivered&page=2).",
    actualVi: "State filter bị reset về giá trị mặc định khi đổi page.",
    testCaseId: "TC-F08-01-03",
    specFile: "tests/orders-filter-pagination.spec.ts",
    suggestedFixVi: "Đồng bộ query params với useRouter() trong component OrdersList.",
  },
  {
    bugId: "BUG-F04-01",
    targetId: "products-list-search-filter",
    title: "Lỗi Tìm Kiếm Sản Phẩm Không Bỏ Dấu Tiếng Việt",
    severity: "P2 Medium",
    status: "failing",
    page: "products",
    symptomVi: "Gõ tìm kiếm không dấu như 'tra dao' hoặc 'tra xoai' không tìm thấy 'Trà đào độc đáo' hoặc 'Trà xoài chín mọng'.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Products'.",
      "2. Gõ từ khóa 'tra dao' vào ô tìm kiếm sản phẩm.",
      "3. Quan sát: Danh sách trả về trống rỗng (0 kết quả).",
    ],
    expectedVi: "Hệ thống phải tự động chuẩn hóa chuỗi Unicode (normalize NFD) để tìm kiếm không phân biệt dấu.",
    actualVi: "Hệ thống so sánh chuỗi chính xác có dấu dẫn đến không khớp từ khóa.",
    testCaseId: "TC-F04-01-02",
    specFile: "src/__tests__/unit/products/search-normalize.test.ts",
    suggestedFixVi: "Sử dụng hàm unaccent() trong PostgreSQL hoặc regex normalize('NFD') ở frontend.",
  },
  {
    bugId: "BUG-F09-02",
    targetId: "discount-rules-coupons",
    title: "Lỗi Bỏ Qua Giới Hạn Lượt Dùng Mã Giảm Giá",
    severity: "P0 Critical",
    status: "failing",
    page: "discounts",
    symptomVi: "Mã giảm giá đã đạt giới hạn 10/10 lượt sử dụng nhưng hệ thống vẫn cho phép áp dụng mã lần thứ 11.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Discounts'.",
      "2. Xem mã 'LT869466' có giới hạn sử dụng.",
      "3. Tạo đơn hàng mới và áp dụng mã khi mã đã hết lượt.",
      "4. Quan sát: Mã vẫn trừ 10% giá trị đơn hàng.",
    ],
    expectedVi: "Hệ thống phải từ chối và báo lỗi 'Mã giảm giá đã hết lượt sử dụng'.",
    actualVi: "Field usage_limit không được kiểm tra trong hàm validateCoupon().",
    testCaseId: "TC-F09-02-04",
    specFile: "src/__tests__/unit/discounts/coupon-limit.test.ts",
    suggestedFixVi: "Thêm điều kiện if (coupon.times_used >= coupon.usage_limit) throw new Error(...) trong API checkout.",
  },
  {
    bugId: "BUG-F11-03",
    targetId: "shop-customers-directory",
    title: "Lỗi Tính Sai Tổng Chi Tiêu Của Khách Hàng (Total Spent)",
    severity: "P1 High",
    status: "failing",
    page: "customers",
    symptomVi: "Khách hàng có nhiều đơn hàng hoàn tất nhưng số tiền trong cột 'Total Spent' ở trang Customer Detail vẫn hiện RM 0.00.",
    reproStepsVi: [
      "1. Truy cập vào menu 'All Customers'.",
      "2. Bấm vào khách hàng 'Ocean' (cus_000106).",
      "3. Quan sát: Thẻ 'Total Spent' hiển thị RM 0.00 dù khách đã có đơn hàng.",
    ],
    expectedVi: "Thẻ Total Spent phải cộng tổng tất cả các đơn có trạng thái 'Confirmed' và 'Delivered'.",
    actualVi: "Câu query SUM(orders.total) bị thiếu JOIN với bảng orders.",
    testCaseId: "TC-F11-03-01",
    specFile: "src/__tests__/unit/customers/customer-metrics.test.ts",
    suggestedFixVi: "Sửa aggregate query trong src/lib/customers/metrics.ts để tính đúng tổng chi tiêu.",
  },
  {
    bugId: "BUG-F28-01",
    targetId: "custom-domain-dns-guard",
    title: "Lỗi Xác Thực CNAME Tên Miền Tùy Chỉnh",
    severity: "P1 High",
    status: "failing",
    page: "domains",
    symptomVi: "Người dùng đã cấu hình đúng bản ghi CNAME trỏ về cname.vercel-dns.com nhưng hệ thống kiểm tra báo lỗi 'DNS Not Configured'.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Domains'.",
      "2. Bấm nút 'Verify DNS' cho tên miền tùy chỉnh.",
      "3. Quan sát: Hệ thống báo lỗi dù bản ghi DNS đã phân giải thành công.",
    ],
    expectedVi: "Hệ thống phải nhận diện bản ghi CNAME và chuyển trạng thái sang 'Active / SSL Ready' màu xanh.",
    actualVi: "API DNS Lookup bị cache kết quả cũ quá lâu.",
    testCaseId: "TC-F28-01-02",
    specFile: "tests/domains-dns-verify.spec.ts",
    suggestedFixVi: "Thêm tham số cache-bust và query trực tiếp Cloudflare 1.1.1.1 DoH API.",
  },
  {
    bugId: "BUG-F33-01",
    targetId: "notifications-read-stream",
    title: "Lỗi Render Biến {{customer_name}} Trong Email Template",
    severity: "P2 Medium",
    status: "failing",
    page: "email-templates",
    symptomVi: "Trong trang xem trước Email Templates, các biến động như {{customer_name}} và {{order_number}} không được thay thế bằng dữ liệu mẫu.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Email Templates'.",
      "2. Bấm vào mẫu 'Order Confirmation Email'.",
      "3. Quan sát: Nội dung email hiển thị chuỗi ký tự 'Xin chào {{customer_name}}' thay vì tên khách hàng mẫu.",
    ],
    expectedVi: "Khung xem trước phải render thành 'Xin chào Ahmad Faizal' với mã đơn '#ORD-9021'.",
    actualVi: "Template parser chưa chạy qua hàm replaceMergeTags().",
    testCaseId: "TC-F33-01-01",
    specFile: "src/__tests__/unit/email/merge-tags.test.ts",
    suggestedFixVi: "Gọi hàm interpolateVariables(templateHtml, samplePayload) trước khi render iframe preview.",
  },
  {
    bugId: "BUG-F01-01",
    targetId: "identity-login-otp",
    title: "Lỗi Thiếu Banner Đếm Ngược Rate Limit Gửi OTP",
    severity: "P2 Medium",
    status: "failing",
    page: "team-account",
    symptomVi: "Khi bấm gửi lại mã OTP đăng nhập hoặc bảo mật, không có đồng hồ đếm ngược 60 giây hiển thị cho người dùng.",
    reproStepsVi: [
      "1. Truy cập vào menu 'Team & Account'.",
      "2. Bấm nút 'Send verification OTP' hoặc 'Invite Member'.",
      "3. Quan sát: Nút không bị disable 60 giây và không có đồng hồ đếm ngược.",
    ],
    expectedVi: "Nút phải chuyển sang trạng thái disabled kèm đồng hồ đếm ngược 'Gửi lại sau (59s)'.",
    actualVi: "Nút cho phép bấm liên tục gửi nhiều email OTP cùng lúc.",
    testCaseId: "TC-F01-01-03",
    specFile: "src/__tests__/unit/otp/otp-rate-limit.test.ts",
    suggestedFixVi: "Bổ sung state countdown timer 60s và lưu timestamp vào localStorage.",
  },
];

export interface TargetImpactInfo {
  targetId: string;
  target?: CmsTarget;
  bug?: QaBugItem;
  isImpacted: boolean;
  hasFailingTest: boolean;
  failingTests: DirectoryTestCase[];
  allTests: DirectoryTestCase[];
}

export function VisualCmsReviewClient() {
  const [currentPage, setCurrentPage] = useState<CmsPageView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  const [overlayMode, setOverlayMode] = useState<OverlayMode>("impact");
  const [selectedPrId, setSelectedPrId] = useState<number | "all">(1733);
  const [filterDomain, setFilterDomain] = useState<string>("all");

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Global Modals
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showAiFixModal, setShowAiFixModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAiBlogModal, setShowAiBlogModal] = useState(false);

  // QA Bug State
  const [qaBugs, setQaBugs] = useState<QaBugItem[]>(INITIAL_QA_BUGS);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [retestingTargetId, setRetestingTargetId] = useState<string | null>(null);
  const [retestMessage, setRetestMessage] = useState<string | null>(null);
  const [hoveredBugTargetId, setHoveredBugTargetId] = useState<string | null>(null);

  // ── Exact Staging Mock & Persistent State ───────────────────────────────────

  // Products (Matching Screenshot 0, 1, 2)
  const [products, setProducts] = useState([
    { id: "p-1", name: "Trà trái cây đá xay", sku: "RES-006", price: 15.0, stock: 122, weight: "0.4 kg", created: "07 Aug 2026", status: true },
    { id: "p-2", name: "Trà kem cheese béo ngậy", sku: "RES-005", price: 14.5, stock: 0, weight: "0.4 kg", created: "07 Aug 2026", status: true },
    { id: "p-3", name: "Trà đào độc đáo", sku: "RES-004", price: 11.5, stock: 0, weight: "0.3 kg", created: "07 Aug 2026", status: true },
    { id: "p-4", name: "Trà xoài chín mọng", sku: "RES-003", price: 13.0, stock: 0, weight: "0.3 kg", created: "07 Aug 2026", status: true },
    { id: "p-5", name: "Trà sữa trân châu đậm vị", sku: "RES-002", price: 14.0, stock: 0, weight: "0.4 kg", created: "07 Aug 2026", status: true },
    { id: "p-6", name: "Trà trái cây tươi mát", sku: "RES-001", price: 12.5, stock: 0, weight: "0.3 kg", created: "07 Aug 2026", status: true },
  ]);
  const [showAiDraftModal, setShowAiDraftModal] = useState(false);
  const [aiDraftInput, setAiDraftInput] = useState("");

  // Discounts (Matching Screenshot 3, 4)
  const [discounts, setDiscounts] = useState([
    { id: "d-1", code: "LT869466", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-2", code: "LT103560", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-3", code: "LT346186", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-4", code: "LT346570", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-5", code: "LT239963", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-6", code: "LT793482", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-7", code: "LT632408", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-8", code: "LT563278", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-9", code: "LT306973", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
    { id: "d-10", code: "LT105483", type: "% Percentage", value: "10%", usage: "0 / ∞ Unlimited", expires: "—", status: "Active" },
  ]);

  // Customers (Matching Screenshot 5, 6)
  const [customers, setCustomers] = useState([
    { id: "cus_000106", email: "ngan.ptt@primecommerce.asia", name: "Ocean", rank: "Unranked", phone: "01116127971", orders: 0, lastOrder: "27d ago", initials: "OC", color: "bg-amber-800" },
    { id: "cus_000105", email: "ary01@yopmail.com", name: "ary", rank: "Unranked", phone: "01232354235", orders: 0, lastOrder: "1mo ago", initials: "AR", color: "bg-amber-900" },
    { id: "cus_000104", email: "ary@yopmail.com", name: "ary", rank: "Unranked", phone: "0123353455", orders: 0, lastOrder: "1mo ago", initials: "AR", color: "bg-rose-900" },
    { id: "cus_000103", email: "lt@yopmail.com", name: "LT", rank: "Unranked", phone: "60123456789", orders: 0, lastOrder: "1mo ago", initials: "LT", color: "bg-teal-900" },
    { id: "cus_000102", email: "ry@yopmail.com", name: "ryry", rank: "Unranked", phone: "0123345345", orders: 0, lastOrder: "1mo ago", initials: "RY", color: "bg-emerald-900" },
    { id: "cus_000101", email: "ryry@yopmail.com", name: "arry", rank: "Unranked", phone: "0133453455", orders: 0, lastOrder: "1mo ago", initials: "AR", color: "bg-amber-950" },
  ]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("cus_000106");

  // Orders State
  const [orders, setOrders] = useState([
    { id: "#ORD-9021", customer: "Ahmad Faizal", email: "ahmad.faizal@gmail.com", phone: "+60 12-889-1029", address: "14 Jalan Bukit Bintang, 55100 Kuala Lumpur", items: "2x Special Beef Pho, 1x Lemon Tea", subtotal: 45.0, shipping: 7.5, total: 52.5, status: "Confirmed", payment: "Stripe Card", date: "20 Aug 2026 14:15", awbNo: "EP-MY-8920194" },
    { id: "#ORD-9022", customer: "Sarah Tan", email: "sarah.tan@yahoo.com", phone: "+60 16-773-4412", address: "88 Mont Kiara, 50480 Kuala Lumpur", items: "4x Iced Lemon Tea", subtotal: 34.0, shipping: 0.0, total: 34.0, status: "Delivered", payment: "FPX Online", date: "20 Aug 2026 13:40", awbNo: "EP-MY-8919022" },
    { id: "#ORD-9023", customer: "David Wong", email: "david.wong@outlook.com", phone: "+60 19-332-9011", address: "55 Bangsar South, 59200 Kuala Lumpur", items: "1x Matcha Cheese Milk, 1x Fruit Tea", subtotal: 28.5, shipping: 5.0, total: 33.5, status: "Processing", payment: "Cash on Delivery", date: "19 Aug 2026 18:20", awbNo: "EP-MY-8840192" },
    { id: "#ORD-9024", customer: "Nor Aini", email: "noraini@gmail.com", phone: "+60 11-209-4481", address: "23 Jalan Ampang, 50450 Kuala Lumpur", items: "3x Mango Smoothie", subtotal: 39.0, shipping: 5.0, total: 44.0, status: "Unpaid", payment: "Bank Transfer", date: "19 Aug 2026 16:05", awbNo: null },
  ]);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<any | null>(null);

  // Blog State
  const [blogPosts, setBlogPosts] = useState([
    { id: "b-1", title: "Top 5 Asian Cuisine Trends in 2026", slug: "top-5-asian-cuisine-trends-2026", status: "published" as const, author: "Admin Editor", category: "Food Trends", createdAt: "18 Aug 2026", thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80" },
    { id: "b-2", title: "Guide to Authentic Malaysian Tea Culture", slug: "malaysian-tea-culture-guide", status: "published" as const, author: "Sarah Tan", category: "Guides", createdAt: "15 Aug 2026", thumbnail: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=200&auto=format&fit=crop&q=80" },
    { id: "b-3", title: "Behind the Scenes: Sourcing Organic Tea Leaves", slug: "behind-the-scenes-sourcing-tea", status: "draft" as const, author: "Admin Editor", category: "Stories", createdAt: "12 Aug 2026", thumbnail: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=200&auto=format&fit=crop&q=80" },
  ]);
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);
  const [blogCategories, setBlogCategories] = useState(["Food Trends", "Guides", "Stories", "Recipes"]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Domains (Matching Screenshot 10, 11, 12)
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [showSelectPrimaryDrawer, setShowSelectPrimaryDrawer] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState("chin-muoi.web-v2.dev.ecommercehub.my");

  // Email Templates (Matching Screenshot 13, 14)
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>("order-confirmation");

  // Help Center Tab (Matching Screenshot 16, 17, 18)
  const [helpCenterTab, setHelpCenterTab] = useState<"overview" | "qna" | "guides">("overview");
  const [helpModuleGuideSubTab, setHelpModuleGuideSubTab] = useState<"dashboard" | "builder" | "blog" | "settings">("dashboard");

  const showToast = (type: "success" | "error" | "info", text: string) => {
    setToastMessage({ type, text });
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const activePR = useMemo(() => {
    if (selectedPrId === "all") return null;
    return SAMPLE_PRS.find((pr) => pr.id === selectedPrId) ?? null;
  }, [selectedPrId]);

  const getImpact = useCallback((targetId: string): TargetImpactInfo => {
    const target = CMS_TARGET_REGISTRY.find((t) => t.id === targetId);
    const bug = qaBugs.find((b) => b.targetId === targetId);
    const allTests = ALL_TEST_CASES_DIRECTORY.filter(
      (tc) => tc.targetId === targetId || tc.domain === target?.domain
    );

    let isImpacted = false;
    let failingTestIds: string[] = [];

    if (activePR) {
      isImpacted = activePR.affectedTargetIds.includes(targetId);
      failingTestIds = activePR.failingTestIds;
    } else {
      failingTestIds = SAMPLE_PRS.flatMap((p) => p.failingTestIds);
      isImpacted = SAMPLE_PRS.some((p) => p.affectedTargetIds.includes(targetId));
    }

    const failingTests = allTests.filter((tc) => failingTestIds.includes(tc.id));
    const hasFailingTest = failingTests.length > 0 || bug?.status === "failing";

    return {
      targetId,
      target,
      bug,
      isImpacted,
      hasFailingTest,
      failingTests,
      allTests,
    };
  }, [activePR, qaBugs]);

  const openInspector = (targetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTargetId(targetId);
    setRetestMessage(null);
  };

  const handleToggleBugStatus = (targetId: string, newStatus: "passed" | "failing") => {
    setQaBugs((prev) =>
      prev.map((b) => (b.targetId === targetId ? { ...b, status: newStatus } : b))
    );
    if (newStatus === "passed") {
      showToast("success", `✓ Đã xác nhận TEST PASS cho bug [${targetId}]!`);
    } else {
      showToast("error", `Đã đánh dấu VẪN CÒN LỖI cho [${targetId}]`);
    }
  };

  const handleRetest = async (targetId: string) => {
    setRetestingTargetId(targetId);
    setRetestMessage(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setQaBugs((prev) =>
        prev.map((b) => (b.targetId === targetId ? { ...b, status: "passed" } : b))
      );
      setRetestMessage(`✓ Test runner đã hoàn thành! 100% assertions đã PASS cho target [${targetId}].`);
      showToast("success", `✓ Test runner đã kiểm thử thành công target [${targetId}]!`);
    } catch {
      setRetestMessage("Không thể kích hoạt test runner.");
      showToast("error", "Lỗi khi chạy retest");
    } finally {
      setRetestingTargetId(null);
    }
  };

  const activeTargetDetail = useMemo(() => {
    if (!selectedTargetId) return null;
    return getImpact(selectedTargetId);
  }, [selectedTargetId, getImpact]);

  // Active bugs for current screen view
  const activeScreenBugs = useMemo(() => {
    return qaBugs.filter((b) => b.page === currentPage || (currentPage === "blog-create" && b.page === "blog") || (currentPage === "blog-edit" && b.page === "blog"));
  }, [qaBugs, currentPage]);

  // ── Clean & Minimalist Impact Node (Khoanh chỗ lỗi, click mở popup chi tiết) ─
  const ImpactNode = ({
    targetId,
    children,
    className = "",
    label,
  }: {
    targetId: string;
    children: React.ReactNode;
    className?: string;
    label?: string;
  }) => {
    const impact = getImpact(targetId);
    const bug = impact.bug;

    if (overlayMode === "clean") {
      return (
        <div data-testid={`impact-node-${targetId}`} className={className}>
          {children}
        </div>
      );
    }

    const isFilteredOut =
      filterDomain !== "all" && impact.target?.domain !== filterDomain;
    if (isFilteredOut) {
      return (
        <div data-testid={`impact-node-${targetId}`} className={className}>
          {children}
        </div>
      );
    }

    let borderClass = "";

    if (bug) {
      if (bug.status === "failing") {
        borderClass = "ring-2 ring-red-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 rounded-xl cursor-pointer hover:ring-red-400 hover:shadow-md transition-all";
      } else {
        borderClass = "ring-2 ring-emerald-500/80 ring-offset-1 rounded-xl cursor-pointer hover:ring-emerald-400 transition-all";
      }
    } else if (impact.hasFailingTest) {
      borderClass = "ring-2 ring-red-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 rounded-xl cursor-pointer hover:ring-red-400 hover:shadow-md transition-all";
    } else if (impact.isImpacted) {
      borderClass = "ring-2 ring-amber-400/80 ring-offset-1 rounded-xl cursor-pointer hover:ring-amber-300 transition-all";
    }

    return (
      <div
        data-testid={`impact-node-${targetId}`}
        onClick={(e) => {
          if (bug || impact.hasFailingTest || impact.isImpacted) {
            e.stopPropagation();
            openInspector(targetId);
          }
        }}
        className={`relative ${borderClass} ${className}`}
        title={bug ? `[${bug.bugId}] ${bug.title} (Click để xem chi tiết lỗi)` : label}
      >
        {children}
      </div>
    );
  };

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    targetId: string;
    badge?: string;
  }

  interface NavSection {
    header: string | null;
    items: NavItem[];
  }

  const navItems: NavSection[] = [
    {
      header: null,
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, targetId: "traffic-performance-client" },
      ],
    },
    {
      header: "ONLINE STORE",
      items: [
        { id: "editor", label: "Editor", icon: Layout, targetId: "editor-load-and-tenant-access" },
        { id: "blog", label: "Blog", icon: FileText, targetId: "blog-post-management" },
      ],
    },
    {
      header: "CORE OPERATIONS",
      items: [
        { id: "orders", label: "Orders", icon: ShoppingCart, targetId: "orders-list-search-metrics" },
        { id: "products", label: "Products", icon: Package, badge: "6", targetId: "products-list-search-filter" },
        { id: "discounts", label: "Discounts", icon: Percent, badge: "1.2K", targetId: "discount-rules-coupons" },
      ],
    },
    {
      header: "CRM",
      items: [
        { id: "customers", label: "All Customers", icon: Users, badge: "48", targetId: "shop-customers-directory" },
        { id: "contact-leads", label: "Contact Leads", icon: UserPlus, targetId: "contact-form-delivery" },
      ],
    },
    {
      header: "SETTINGS",
      items: [
        { id: "payments", label: "Payments", icon: CreditCard, targetId: "payment-methods-checkout" },
        { id: "shipping", label: "Shipping", icon: Truck, targetId: "shipping-zones-matrix" },
        { id: "domains", label: "Domains", icon: Globe, targetId: "custom-domain-dns-guard" },
        { id: "email-templates", label: "Email Templates", icon: Bell, targetId: "notifications-read-stream" },
        { id: "team-account", label: "Team & Account", icon: UsersRound, targetId: "identity-login-otp" },
      ],
    },
    {
      header: "SUPPORT",
      items: [
        { id: "help-center", label: "Help Center", icon: Headphones, targetId: "builder-help-assistant" },
      ],
    },
  ];

  return (
    <div className={`dash-shell dash-shell-root min-h-screen bg-dash-bg flex flex-col font-sans antialiased ${themeMode === "dark" ? "dark" : ""}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === "error"
              ? "bg-red-950/95 border-red-800 text-red-200 shadow-red-950/50"
              : toastMessage.type === "success"
              ? "bg-emerald-950/95 border-emerald-800 text-emerald-200 shadow-emerald-950/50"
              : "bg-slate-900/95 border-slate-800 text-cyan-300"
          }`}
        >
          {toastMessage.type === "error" ? (
            <AlertCircle className="size-4 text-red-400 shrink-0" />
          ) : toastMessage.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          ) : (
            <Info className="size-4 text-cyan-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Slim Review Toolbar */}
      <div className="bg-[#0b1329] border-b border-slate-800 px-4 h-10 shrink-0 flex items-center justify-between gap-3 text-xs shadow-md z-40 text-slate-100">
        <div className="flex items-center gap-2">
          <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
            <Flame className="size-3 text-cyan-400" /> Review PR
          </span>
          <select
            id="pr-select"
            value={selectedPrId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedPrId(val === "all" ? "all" : Number(val));
            }}
            className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-400 max-w-[280px] sm:max-w-xs truncate cursor-pointer"
          >
            <option value="all">⚡ Staging Live Health (Toàn bộ)</option>
            {SAMPLE_PRS.map((pr) => (
              <option key={pr.id} value={pr.id}>
                PR #{pr.number}: {pr.title}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden md:flex items-center gap-2 max-w-xl truncate">
          {activePR ? (
            <div className="flex items-center gap-2 text-xs">
              {activePR.failingTestIds.length > 0 ? (
                <span className="bg-red-950/90 border border-red-800 text-red-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Flame className="size-3 text-red-400 animate-pulse" /> {activePR.failingTestIds.length} Lỗi test
                </span>
              ) : (
                <span className="bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="size-3 text-emerald-400" /> 0 Lỗi test
                </span>
              )}
              <span className="text-slate-300 truncate font-medium">
                {activePR.summaryVi}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">Đang theo dõi toàn bộ hệ thống Staging (13 trang CMS)</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={overlayMode === "impact"}
              onChange={(e) => setOverlayMode(e.target.checked ? "impact" : "clean")}
              className="accent-cyan-500 rounded cursor-pointer size-3.5"
            />
            <span>Cảnh báo lỗi: <span className={overlayMode === "impact" ? "text-cyan-400 font-bold" : "text-slate-500"}>{overlayMode === "impact" ? "BẬT" : "TẮT"}</span></span>
          </label>
        </div>
      </div>

      {/* Dynamic Viewport Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header - White Background matching Staging Screenshots */}
        <div className="h-[56px] shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 text-slate-800 dark:text-slate-100 shadow-xs">
          {/* Left Top Brand / Collapse */}
          <div className="flex items-center gap-3 w-60 shrink-0">
            <button type="button" className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <svg className="size-4.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="4" height="4" rx="1" />
                <rect x="10" y="4" width="4" height="4" rx="1" />
                <rect x="16" y="4" width="4" height="4" rx="1" />
                <rect x="4" y="10" width="4" height="4" rx="1" />
                <rect x="10" y="10" width="4" height="4" rx="1" />
                <rect x="16" y="10" width="4" height="4" rx="1" />
                <rect x="4" y="16" width="4" height="4" rx="1" />
                <rect x="10" y="16" width="4" height="4" rx="1" />
                <rect x="16" y="16" width="4" height="4" rx="1" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center font-black text-slate-950 text-sm shadow-md">
                W
              </div>
              <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white">
                Web<span className="text-[#06b6d4]">Store</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded ml-auto cursor-pointer"
              title="Thu gọn sidebar"
            >
              <ChevronsLeft className={`size-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Right Top Header Actions matching Screenshot Top */}
          <div className="flex items-center gap-3">
            <button type="button" className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer">
              <Bell className="size-4.5" />
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">15</span>
            </button>

            <button
              type="button"
              onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {themeMode === "light" ? <Moon className="size-4.5 text-amber-500" /> : <Sun className="size-4.5 text-amber-400" />}
            </button>

            <div className="flex items-center gap-1.5 cursor-pointer pl-1">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />
              <ChevronDown className="size-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Sidebar & Main Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Staging Dark Navy Sidebar */}
          <aside
            className={`bg-[#0b1329] border-r border-[#172340] transition-all duration-200 flex flex-col justify-between shrink-0 z-30 ${
              sidebarCollapsed ? "w-16" : "w-60"
            }`}
          >
            <div className="p-3 space-y-4 overflow-y-auto">
              {navItems.map((sec, sIdx) => (
                <div key={sIdx}>
                  {!sidebarCollapsed && sec.header && (
                    <div className="px-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 opacity-60 select-none">
                      {sec.header}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isCurrent =
                        currentPage === item.id ||
                        (item.id === "products" && currentPage === "products-new") ||
                        (item.id === "discounts" && currentPage === "discounts-new") ||
                        (item.id === "customers" && currentPage === "customer-detail") ||
                        (item.id === "email-templates" && currentPage === "email-template-edit") ||
                        (item.id === "blog" && (currentPage === "blog-create" || currentPage === "blog-edit"));

                      return (
                        <button
                          key={item.id}
                          data-testid={`nav-${item.id}`}
                          type="button"
                          onClick={() => setCurrentPage(item.id as CmsPageView)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                            isCurrent
                              ? "bg-[rgba(6,182,212,0.12)] text-[#06b6d4] font-bold shadow-[0_0_16px_rgba(6,182,212,0.2)]"
                              : "text-slate-400 hover:bg-[#14203d] hover:text-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="size-4.5 shrink-0" />
                            {!sidebarCollapsed && <span>{item.label}</span>}
                          </div>
                          {!sidebarCollapsed && item.badge && (
                            <span className="bg-[#131d36] text-slate-400 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-[#172340]">
              {!sidebarCollapsed ? (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <Globe className="size-3.5" />
                  <div className="flex items-center bg-[#131d36] rounded-full p-0.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 hover:text-white cursor-pointer">MY</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#06b6d4] text-slate-950 font-bold">
                      EN
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs font-bold text-[#06b6d4]">EN</div>
              )}
            </div>
          </aside>

          {/* Main Content View Switcher matching 100% Staging UI */}
          <main className="flex-1 overflow-y-auto bg-dash-bg text-dash-text p-4 sm:p-6 md:p-8">

            {currentPage === "dashboard" ? (
              <DashboardScreen
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                onOpenCustomize={() => setShowCustomizeModal(true)}
                onOpenAiFix={() => setShowAiFixModal(true)}
                onNavigateEditor={() => setCurrentPage("editor")}
                showToast={showToast}
              />
            ) : currentPage === "editor" ? (
              <EditorScreenStaging
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "blog" ? (
              <BlogScreenStaging
                blogPosts={blogPosts}
                setBlogPosts={setBlogPosts}
                onOpenCreate={() => setCurrentPage("blog-create")}
                onOpenEdit={(id) => {
                  setSelectedBlogId(id);
                  setCurrentPage("blog-edit");
                }}
                onOpenCategories={() => setIsCategoryModalOpen(true)}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "blog-create" || currentPage === "blog-edit" ? (
              <BlogEditScreenStaging
                post={blogPosts.find(p => p.id === selectedBlogId) || null}
                categories={blogCategories}
                onBack={() => setCurrentPage("blog")}
                onSave={(newPost) => {
                  setBlogPosts(prev => {
                    const exists = prev.some(p => p.id === newPost.id);
                    if (exists) {
                      return prev.map(p => p.id === newPost.id ? newPost : p);
                    }
                    return [newPost, ...prev];
                  });
                  showToast("success", `✓ Đã lưu bài viết "${newPost.title}" thành công!`);
                  setCurrentPage("blog");
                }}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "orders" ? (
              <OrdersScreenStaging
                orders={orders}
                setOrders={setOrders}
                onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "products" ? (
              <ProductsScreenStaging
                products={products}
                setProducts={setProducts}
                onOpenAdd={() => setCurrentPage("products-new")}
                onOpenAiDrafts={() => setShowAiDraftModal(true)}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "products-new" ? (
              <AddProductScreenStaging
                onBack={() => setCurrentPage("products")}
                onSave={(newP) => {
                  setProducts((prev) => [newP, ...prev]);
                  showToast("success", `✓ Đã thêm sản phẩm "${newP.name}" thành công!`);
                  setCurrentPage("products");
                }}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "discounts" ? (
              <DiscountsScreenStaging
                discounts={discounts}
                setDiscounts={setDiscounts}
                onOpenAdd={() => setCurrentPage("discounts-new")}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "discounts-new" ? (
              <CreateDiscountScreenStaging
                onBack={() => setCurrentPage("discounts")}
                onSave={(newD) => {
                  setDiscounts((prev) => [newD, ...prev]);
                  showToast("success", `✓ Đã tạo mã giảm giá "${newD.code}" thành công!`);
                  setCurrentPage("discounts");
                }}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "customers" ? (
              <CustomersScreenStaging
                customers={customers}
                onSelectCustomer={(cId) => {
                  setSelectedCustomerId(cId);
                  setCurrentPage("customer-detail");
                }}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "customer-detail" ? (
              <CustomerDetailScreenStaging
                customer={customers.find(c => c.id === selectedCustomerId) || customers[0]}
                onBack={() => setCurrentPage("customers")}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "contact-leads" ? (
              <ContactLeadsScreenStaging
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "payments" ? (
              <PaymentsScreenStaging
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "shipping" ? (
              <ShippingScreenStaging
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "domains" ? (
              <DomainsScreenStaging
                primaryDomain={primaryDomain}
                onOpenAddDomain={() => setShowAddDomainModal(true)}
                onOpenSelectPrimary={() => setShowSelectPrimaryDrawer(true)}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "email-templates" ? (
              <EmailTemplatesScreenStaging
                onSelectTemplate={(tId) => {
                  setSelectedEmailTemplateId(tId);
                  setCurrentPage("email-template-edit");
                }}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "email-template-edit" ? (
              <EmailTemplateEditScreenStaging
                templateId={selectedEmailTemplateId}
                onBack={() => setCurrentPage("email-templates")}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : currentPage === "team-account" ? (
              <TeamAccountScreenStaging
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            ) : (
              <HelpCenterScreenStaging
                activeTab={helpCenterTab}
                setActiveTab={setHelpCenterTab}
                guideSubTab={helpModuleGuideSubTab}
                setGuideSubTab={setHelpModuleGuideSubTab}
                ImpactNode={ImpactNode}
                openInspector={openInspector}
                showToast={showToast}
              />
            )}
          </main>
        </div>
      </div>

      {/* ── STAGING SPECIFIC POPUPS & DRAWERS ──────────────────────────────── */}

      {/* 1. Review AI Drafts Modal (Screenshot 1) */}
      {showAiDraftModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-cyan-500" />
                <h3 className="font-bold text-sm">Review AI drafts</h3>
              </div>
              <button type="button" onClick={() => setShowAiDraftModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-slate-500 text-[11px]">Edit anything before adding these to your store. Nothing is published yet.</p>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                  <ImageIcon className="size-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input defaultValue="Trsees" placeholder="Name" className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs" />
                    <input defaultValue="0" placeholder="Price (RM)" className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs" />
                    <input defaultValue="0" placeholder="Stock" className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-red-500 block mb-0.5">Category *</label>
                    <select className="w-full bg-white dark:bg-slate-900 border border-red-400 rounded-lg px-2.5 py-1 text-xs">
                      <option>Select categories...</option>
                      <option>Food</option>
                      <option>Drinks</option>
                    </select>
                    <span className="text-[10px] text-red-500 mt-0.5 block">Pick at least one category.</span>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAiDraftModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400">1 draft</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowAiDraftModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProducts((prev) => [{ id: `p-${Date.now()}`, name: "Trsees", sku: "RES-007", price: 15.0, stock: 10, weight: "0.3 kg", created: "Today", status: true }, ...prev]);
                    setShowAiDraftModal(false);
                    showToast("success", "✓ Đã duyệt và thêm sản phẩm từ AI!");
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold"
                >
                  Approve All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Custom Domain Modal (Screenshot 10) */}
      {showAddDomainModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 text-xs">
            <h3 className="text-base font-bold">Enter the domain name you own</h3>
            <p className="text-slate-500 text-[11px]">Note: make sure you can sign in to your domain registrar.</p>

            <input
              type="text"
              placeholder="example.com"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-cyan-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddDomainModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddDomainModal(false);
                  showToast("success", "✓ Đã kết nối tên miền thành công!");
                }}
                className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold shadow"
              >
                Add domain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Select Primary Domain Drawer (Screenshot 11) */}
      {showSelectPrimaryDrawer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl animate-in slide-in-from-right duration-200 text-slate-900 dark:text-slate-100 text-xs relative flex flex-col justify-between">
            <button
              type="button"
              onClick={() => setShowSelectPrimaryDrawer(false)}
              className="absolute top-6 -left-4 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 shadow-md cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>

            <div className="space-y-4">
              <h2 className="text-lg font-bold">Select primary domain</h2>

              <div className="p-3.5 bg-cyan-50/50 dark:bg-cyan-950/30 border border-[#06b6d4] rounded-xl flex items-center gap-2.5 font-mono text-cyan-600 dark:text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
                <span className="truncate">{primaryDomain}</span>
              </div>

              <p className="text-slate-400 text-[11px]">No verified custom domains yet. Add and verify one first.</p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSelectPrimaryDrawer(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSelectPrimaryDrawer(false);
                  showToast("success", "✓ Đã lưu thay đổi Primary domain!");
                }}
                className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold shadow"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Slide-in Order Detail Drawer (Screenshot Parity & Real Dash Component) */}
      {selectedOrderForDetail && (
        <OrderDetailDrawerStaging
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          onUpdateStatus={(newStatus) => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === selectedOrderForDetail.id ? { ...o, status: newStatus } : o
              )
            );
            setSelectedOrderForDetail((prev: any) => ({ ...prev, status: newStatus }));
            showToast("success", `✓ Đã cập nhật trạng thái đơn hàng thành [${newStatus}]`);
          }}
          showToast={showToast}
        />
      )}

      {/* 5. Category Modal */}
      {isCategoryModalOpen && (
        <CategoryModalStaging
          categories={blogCategories}
          onClose={() => setIsCategoryModalOpen(false)}
          onAddCategory={(cat) => {
            if (!blogCategories.includes(cat)) {
              setBlogCategories([...blogCategories, cat]);
              showToast("success", `✓ Đã thêm danh mục "${cat}"!`);
            }
          }}
          onDeleteCategory={(cat) => {
            setBlogCategories(blogCategories.filter((c) => c !== cat));
            showToast("info", `Đã xóa danh mục "${cat}"`);
          }}
        />
      )}

      {/* ── 6. CLEAN QA BUG DETAILS POPUP MODAL ─────────────────────────────── */}
      {selectedTargetId && activeTargetDetail && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl text-slate-900 dark:text-slate-100 text-xs overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-base">
                  {activeTargetDetail.bug?.status === "passed" ? "🟢" : "🔴"}
                </span>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {activeTargetDetail.bug ? `[${activeTargetDetail.bug.bugId}] ${activeTargetDetail.bug.title}` : activeTargetDetail.target?.name || activeTargetDetail.targetId}
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Target: {activeTargetDetail.targetId} • {activeTargetDetail.bug?.severity || "P1 High"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTargetId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* 1. Lỗi là gì */}
              <div className="space-y-1.5">
                <span className="font-bold text-red-500 dark:text-red-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="size-4" /> Lỗi là gì:
                </span>
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-slate-800 dark:text-red-200 leading-relaxed text-xs">
                  {activeTargetDetail.bug?.symptomVi || activePR?.errorExplanationVi || "Tính năng này đang có lỗi được ghi nhận."}
                </div>
              </div>

              {/* 2. Hướng dẫn các bước test lại */}
              <div className="space-y-1.5">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs flex items-center gap-1.5">
                  <CheckSquare className="size-4" /> Hướng dẫn cách test lại:
                </span>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  {(activeTargetDetail.bug?.reproStepsVi || [
                    "1. Thao tác trên giao diện component này.",
                    "2. Kiểm tra phản hồi của hệ thống.",
                  ]).map((step: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-200 text-xs">
                      <span className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-950 border border-cyan-400 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Kỳ vọng vs Thực tế */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Kết quả kỳ vọng:
                  </span>
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200">
                    {activeTargetDetail.bug?.expectedVi || "Hệ thống hoạt động đúng."}
                  </p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-1">
                  <span className="font-bold text-amber-700 dark:text-amber-400 text-[11px] flex items-center gap-1">
                    <AlertTriangle className="size-3.5" /> Thực tế khi lỗi:
                  </span>
                  <p className="text-[11px] text-amber-900 dark:text-amber-200">
                    {activeTargetDetail.bug?.actualVi || "Thao tác không phản hồi hoặc báo lỗi."}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col gap-2 shrink-0">
              {retestMessage && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <span>{retestMessage}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTargetId(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer text-xs"
                >
                  Đóng
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={retestingTargetId === activeTargetDetail.targetId}
                    onClick={() => handleRetest(activeTargetDetail.targetId)}
                    className="px-3.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3.5 ${retestingTargetId === activeTargetDetail.targetId ? "animate-spin" : ""}`} />
                    <span>{retestingTargetId === activeTargetDetail.targetId ? "Đang chạy test runner..." : "Chạy Test Lại 🔄"}</span>
                  </button>

                  {activeTargetDetail.bug?.status !== "passed" ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleBugStatus(activeTargetDetail.targetId, "passed");
                        setSelectedTargetId(null);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Đánh Dấu ĐÃ PASS 🟢</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleBugStatus(activeTargetDetail.targetId, "failing");
                      }}
                      className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
                    >
                      <Flame className="size-3.5" />
                      <span>Báo Lỗi Lại 🔴</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: F05 AI Website Builder / Editor Screen (100% Staging Screenshots 0-6)
// ═════════════════════════════════════════════════════════════════════════════

const BLOCK_TYPE_CONFIG: Record<
  string,
  {
    variants: string[];
    defaultProps?: Record<string, any>;
  }
> = {
  hero: {
    variants: [
      "Split Left", "Split Right", "Centered", "Fullscreen", "Video", "Magazine",
      "Minimal", "Cards Overlay", "Gradient", "Parallax", "Slideshow", "Split Video",
    ],
  },
  features: {
    variants: ["3 Columns", "4 Grid Cards", "Alternating Rows", "Icon List", "Numbered Steps"],
  },
  about: {
    variants: ["Split Image & Story", "Story Timeline", "Mission & Vision", "Founder Spotlight"],
  },
  cta: {
    variants: ["Banner Strip", "Card Popup", "Countdown Box", "Minimal Clean"],
  },
  services: {
    variants: ["Card Grid", "List View", "Interactive Hover", "Price Attached"],
  },
  "rich-text": {
    variants: ["Clean Article", "Two Columns", "Highlighted Quote", "Callout Box"],
  },
  faq: {
    variants: ["Accordion List", "2-Column Grid", "Categorized Tabs", "Card Grid"],
  },
  testimonials: {
    variants: ["Cards Carousel", "3-Column Grid", "Single Spotlight", "Video Reviews"],
  },
  stats: {
    variants: ["4 Counters Row", "Card Grid", "Animated Progress", "Badge Icons"],
  },
  gallery: {
    variants: ["Masonry Grid", "Carousel Slider", "Square Grid", "Lightbox Zoom"],
  },
  video: {
    variants: ["Embedded 16:9", "Popup Modal", "Autoplay Background", "Split Video & Text"],
  },
  carousel: {
    variants: ["Full Width Banner", "Card Swiper", "Fade Transition", "Thumbnail Slider"],
  },
  pricing: {
    variants: ["3-Tier Cards", "Monthly / Yearly Toggle", "Comparison Table", "Simple List"],
  },
  team: {
    variants: ["Avatar Cards", "Grid with Bios", "Round Circles", "Hover Socials"],
  },
  timeline: {
    variants: ["Vertical Line", "Horizontal Steps", "Milestones Tree"],
  },
  "product-grid": {
    variants: ["4-Column Grid", "3-Column Large", "Horizontal Scroll", "Filterable Tabs"],
  },
  "featured-product": {
    variants: ["Split Spotlight", "Sticky Buy Box", "360 View Demo", "Bundle Pack"],
  },
  "category-carousel": {
    variants: ["Circle Badges", "Card Grid", "Icon Strip", "Banner Tiles"],
  },
  "mini-cart": {
    variants: ["Floating Drawer", "Bottom Sticky Bar", "Top Header Dropdown"],
  },
  "contact-form": {
    variants: ["Standard Form", "Split with Map", "Simple 2-Field", "Card Boxed"],
  },
  newsletter: {
    variants: ["Inline Input Bar", "Popup Box", "Footer Banner", "Discount Unlock"],
  },
  booking: {
    variants: ["Date & Time Picker", "Step-by-Step Wizard", "Slot Selector"],
  },
  "social-links": {
    variants: ["Color Badges", "Monochrome Icons", "Floating Sidebar", "Large Cards"],
  },
  "google-map": {
    variants: ["Full Width Map", "Split with Address Info", "Dark Mode Map"],
  },
  countdown: {
    variants: ["Urgency Flip Clock", "Minimal Digital", "Sale Header Bar"],
  },
  "trust-badges": {
    variants: ["Horizontal Strip", "Icon Badges Grid", "Guarantees Box"],
  },
  "2-col": {
    variants: ["50/50 Split", "30/70 Asymmetric", "70/30 Asymmetric"],
  },
  spacer: {
    variants: ["Small 16px", "Medium 32px", "Large 64px", "Styled Divider Line"],
  },
};

const COMPONENT_CATALOG = [
  {
    category: "Basics",
    count: 5,
    icon: Package,
    items: [
      { id: "hero", icon: "🎯", name: "Hero", desc: "Hero banner with headline and CTA", tag: "This page only" },
      { id: "features", icon: "✨", name: "Features", desc: "Feature highlights with icons", tag: "This page only" },
      { id: "about", icon: "📖", name: "About", desc: "About us section", tag: "This page only" },
      { id: "cta", icon: "🔘", name: "CTA", desc: "Call to action banner", tag: "This page only" },
      { id: "services", icon: "🛠️", name: "Service cards", desc: "Your services shown as cards", tag: "This page only" },
    ],
  },
  {
    category: "Content",
    count: 4,
    icon: FileText,
    items: [
      { id: "rich-text", icon: "📝", name: "Rich Text", desc: "Formatted article body & paragraphs", tag: "This page only" },
      { id: "faq", icon: "❓", name: "FAQ Accordion", desc: "Frequently asked questions list", tag: "This page only" },
      { id: "testimonials", icon: "💬", name: "Testimonials", desc: "Customer reviews & rating quotes", tag: "This page only" },
      { id: "stats", icon: "📊", name: "Numbers Counter", desc: "Highlight key metrics & stats", tag: "This page only" },
    ],
  },
  {
    category: "Media",
    count: 3,
    icon: ImageIcon,
    items: [
      { id: "gallery", icon: "🖼️", name: "Image Gallery", desc: "Masonry photo showcase grid", tag: "This page only" },
      { id: "video", icon: "🎥", name: "Video Player", desc: "YouTube / Vimeo player embed", tag: "This page only" },
      { id: "carousel", icon: "🏙️", name: "Banner Carousel", desc: "Full-width sliding hero banner", tag: "This page only" },
    ],
  },
  {
    category: "Business",
    count: 3,
    icon: Building,
    items: [
      { id: "pricing", icon: "💳", name: "Pricing Table", desc: "Side-by-side tier comparison cards", tag: "This page only" },
      { id: "team", icon: "👥", name: "Team Members", desc: "Showcase staff and founders", tag: "This page only" },
      { id: "timeline", icon: "📜", name: "Timeline / Story", desc: "Company journey and milestones", tag: "This page only" },
    ],
  },
  {
    category: "Commerce",
    count: 4,
    icon: ShoppingCart,
    items: [
      { id: "product-grid", icon: "🛍️", name: "Product Grid", desc: "Catalog items with prices and cart", tag: "This page only" },
      { id: "featured-product", icon: "⭐", name: "Featured Product", desc: "Spotlight single item with gallery", tag: "This page only" },
      { id: "category-carousel", icon: "🏷️", name: "Category Carousel", desc: "Scrollable product categories", tag: "This page only" },
      { id: "mini-cart", icon: "🛒", name: "Mini Cart Banner", desc: "Floating sticky checkout drawer", tag: "This page only" },
    ],
  },
  {
    category: "Form & contact",
    count: 3,
    icon: Mail,
    items: [
      { id: "contact-form", icon: "✉️", name: "Contact Form", desc: "Send lead message to inbox", tag: "This page only" },
      { id: "newsletter", icon: "📬", name: "Newsletter Signup", desc: "Subscribe email lead generation", tag: "This page only" },
      { id: "booking", icon: "📅", name: "Booking Form", desc: "Appointment calendar scheduler", tag: "This page only" },
    ],
  },
  {
    category: "Widgets",
    count: 4,
    icon: Sliders,
    items: [
      { id: "social-links", icon: "🌐", name: "Social Icons", desc: "Instagram, Facebook, TikTok links", tag: "This page only" },
      { id: "google-map", icon: "🗺️", name: "Google Maps", desc: "Embed store location map", tag: "This page only" },
      { id: "countdown", icon: "⏳", name: "Countdown Timer", desc: "Flash sale urgency banner timer", tag: "This page only" },
      { id: "trust-badges", icon: "🛡️", name: "Trust Badges", desc: "SSL, 100% Genuine, Fast Ship", tag: "This page only" },
    ],
  },
  {
    category: "Layout",
    count: 2,
    icon: Layout,
    items: [
      { id: "2-col", icon: "🔳", name: "2-Column Section", desc: "Split side-by-side flexible grid", tag: "This page only" },
      { id: "spacer", icon: "➖", name: "Spacer & Divider", desc: "White space gap and styled line", tag: "This page only" },
    ],
  },
];

function EditorScreenStaging({
  ImpactNode,
  openInspector,
  showToast,
}: {
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  // Top Toolbar & Canvas State
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [isSaved, setIsSaved] = useState(true);

  // Left Panel Navigation Tabs: 'ai' | 'components' | 'pages'
  const [leftTab, setLeftTab] = useState<"ai" | "components" | "pages">("components");
  const [componentSearch, setComponentSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<string[]>(["Basics", "Commerce"]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>([
    "Hi! What would you like to edit?",
  ]);
  const [selectedPage, setSelectedPage] = useState("Trang Chủ");

  // Canvas Dynamic Blocks State
  const [canvasBlocks, setCanvasBlocks] = useState<any[]>([
    {
      id: "blk-hero-1",
      type: "hero",
      name: "Hero",
      icon: "🎯",
      headline: "Chín 10",
      subheadline: "Trà trái cây chín mọng, trà sữa đậm vị, topping tươi mỗi ngày, giao nhanh tận nơi.",
      variant: "Split Left",
      topSpacing: 32,
      bottomSpacing: 32,
    },
    {
      id: "blk-features-1",
      type: "features",
      name: "Features",
      icon: "✨",
      headline: "Đặc Điểm Nổi Bật",
      subheadline: "Nguyên liệu tươi mới mỗi ngày, pha chế chuẩn vị, phục vụ tận tâm.",
      variant: "3 Columns",
      topSpacing: 24,
      bottomSpacing: 24,
    },
    {
      id: "blk-products-1",
      type: "product-grid",
      name: "Product Grid",
      icon: "🛍️",
      headline: "Món Bán Chạy Nhất",
      subheadline: "Thưởng thức những ly trà sữa và trà trái cây được yêu thích nhất tuần này.",
      variant: "Grid 4",
      topSpacing: 28,
      bottomSpacing: 28,
    },
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>("blk-hero-1");

  // Right Panel Inspector Tabs: 'global' | 'seo' | 'menu' | 'block'
  const [rightTab, setRightTab] = useState<"global" | "seo" | "menu" | "block">("block");

  // Global Settings State
  const [businessName, setBusinessName] = useState("Chín Muối");
  const [phone, setPhone] = useState("+60123456789");
  const [email, setEmail] = useState("thaongan10@yopmail.com");
  const [address, setAddress] = useState("12 Jalan Ampang, Kuala Lumpur");
  const [serviceArea, setServiceArea] = useState("go go go");

  // SEO Settings State
  const [metaTitle, setMetaTitle] = useState("Trang Chủ - Chín Muối Malaysia");
  const [metaDesc, setMetaDesc] = useState(
    "Khám phá Trang Chủ của Chín Muối, nơi mang đến trà trái cây tươi ngon và trà sữa đậm vị, giao hàng nhanh tận nơi tại Malaysia."
  );
  const [searchVerification, setSearchVerification] = useState("34535");

  // Menu Settings State
  const [navStyle, setNavStyle] = useState("Default");
  const [navLinks, setNavLinks] = useState(["Trang Chủ", "Giới Thiệu", "Menu", "Bài viết"]);
  const [multiLang, setMultiLang] = useState(false);

  // Selected block object for inspector
  const selectedBlock = canvasBlocks.find((b) => b.id === selectedBlockId) || canvasBlocks[0] || {
    id: "empty",
    name: "Hero",
    headline: "Chín 10",
    subheadline: "Trà sữa đậm vị",
    variant: "Split Left",
    topSpacing: 32,
    bottomSpacing: 32,
  };

  const toggleCategory = (catName: string) => {
    setOpenCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const handleAddOrSelectBlock = (item: any) => {
    const existing = canvasBlocks.find((b) => b.type === item.id);
    if (existing) {
      setSelectedBlockId(existing.id);
      setRightTab("block");
      showToast("info", `Đã chọn khối ${existing.name} trên Canvas`);
      return;
    }

    const newBlock = {
      id: `blk-${item.id}-${Date.now()}`,
      type: item.id,
      name: item.name,
      icon: item.icon,
      headline: `${item.name} Tiêu Đề Mới`,
      subheadline: item.desc || "Nội dung mô tả ngắn cho phần section này.",
      variant: "Default",
      topSpacing: 28,
      bottomSpacing: 28,
    };

    setCanvasBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    setRightTab("block");
    showToast("success", `✓ Đã thêm khối "${item.name}" vào Canvas!`);
  };

  const handleDuplicateBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = canvasBlocks.find((b) => b.id === id);
    if (!target) return;
    const duplicated = {
      ...target,
      id: `blk-${target.type}-${Date.now()}`,
      name: `${target.name} (Copy)`,
    };
    const idx = canvasBlocks.findIndex((b) => b.id === id);
    const next = [...canvasBlocks];
    next.splice(idx + 1, 0, duplicated);
    setCanvasBlocks(next);
    setSelectedBlockId(duplicated.id);
    showToast("success", `✓ Đã nhân bản khối ${target.name}!`);
  };

  const handleDeleteBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (canvasBlocks.length <= 1) {
      showToast("error", "Trang cần giữ ít nhất 1 khối section!");
      return;
    }
    const filtered = canvasBlocks.filter((b) => b.id !== id);
    setCanvasBlocks(filtered);
    setSelectedBlockId(filtered[0]?.id || "");
    showToast("info", "Đã xóa khối khỏi Canvas");
  };

  const handleMoveBlock = (idx: number, dir: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= canvasBlocks.length) return;
    const next = [...canvasBlocks];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setCanvasBlocks(next);
    showToast("info", "Đã đổi thứ tự khối");
  };

  const updateSelectedBlock = (field: string, value: any) => {
    setCanvasBlocks((prev) =>
      prev.map((b) => (b.id === selectedBlockId ? { ...b, [field]: value } : b))
    );
  };

  const handleSendAi = () => {
    if (!aiChatInput.trim()) return;
    const userText = aiChatInput;
    setChatMessages((prev) => [...prev, userText]);
    setAiChatInput("");
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        `✓ Đã xử lý yêu cầu: "${userText}". Mình đã cập nhật thay đổi trực tiếp trên Canvas.`,
      ]);
      showToast("success", "✓ AI đã hoàn thành cập nhật trang!");
    }, 800);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-[#f8fafc] dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl text-slate-900 dark:text-slate-100 text-xs select-none">
      {/* Top Header Bar (100% Staging Screenshot Top) */}
      <div className="h-13 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between shrink-0 z-30">
        {/* Left Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => showToast("info", "Mở Menu chính")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <MenuIcon className="size-3.5" />
            <span>Menu</span>
          </button>

          <button
            type="button"
            onClick={() => setLeftTab("pages")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Layout className="size-3.5 text-slate-500" />
            <span>{selectedPage}</span>
          </button>

          <button
            type="button"
            onClick={() => showToast("info", "Mở kho Templates mẫu")}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Palette className="size-3.5 text-slate-500" />
            <span>Templates</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          <button type="button" onClick={() => showToast("info", "Undo")} className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1">
            <Undo2 className="size-3.5" /> <span className="text-[11px]">Undo</span>
          </button>
          <button type="button" onClick={() => showToast("info", "Redo")} className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1">
            <Redo2 className="size-3.5" /> <span className="text-[11px]">Redo</span>
          </button>
        </div>

        {/* Center Viewport Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs ${
                viewport === "desktop" ? "bg-[#06b6d4] text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Monitor className="size-3.5" /> Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs ${
                viewport === "mobile" ? "bg-[#06b6d4] text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Smartphone className="size-3.5" /> Mobile
            </button>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <button type="button" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><Grid className="size-3.5" /></button>
            <button type="button" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronsLeft className="size-3.5" /></button>
            <button type="button" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronsRight className="size-3.5" /></button>
          </div>
        </div>

        {/* Right Status & Publish */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Saved
          </span>
          <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </span>
          <button
            type="button"
            onClick={() => showToast("info", "Mở xem trước website")}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <ExternalLink className="size-3.5" /> Preview
          </button>
          <ImpactNode targetId="builder-preview-completion" label="View Live Website">
            <button
              type="button"
              onClick={() => showToast("success", "✓ Đang chuyển tới trang web trực tuyến!")}
              className="px-3.5 py-1.5 rounded-xl bg-[#10b981] hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Globe className="size-3.5" /> View live <ChevronDown className="size-3" />
            </button>
          </ImpactNode>
        </div>
      </div>

      {/* 3-Column Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT PANEL (Width ~280px) ────────────────────────────────────── */}
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          {/* 3 Top Sub-Tabs */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-semibold px-2">
            <button
              type="button"
              onClick={() => setLeftTab("ai")}
              className={`flex-1 py-3 text-center flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                leftTab === "ai"
                  ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="size-3.5" /> AI Chat
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("components")}
              className={`flex-1 py-3 text-center flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                leftTab === "components"
                  ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles className="size-3.5" /> Components
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("pages")}
              className={`flex-1 py-3 text-center flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                leftTab === "pages"
                  ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <FileText className="size-3.5" /> Pages
            </button>
          </div>

          {/* Tab 1 Content: AI Chat (Screenshot 0) */}
          {leftTab === "ai" && (
            <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      idx % 2 === 0
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm"
                        : "bg-[#06b6d4] text-white rounded-tr-sm font-medium"
                    }`}
                  >
                    {msg}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAi();
                      }
                    }}
                    placeholder="Tell AI what to change..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white resize-none pr-8 focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendAi}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-cyan-500 cursor-pointer"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono px-1">
                  <span>Enter: Send</span>
                  <span>Shift+Enter: new line</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2 Content: Components Catalog (Screenshot 1 - FULLY INTERACTIVE) */}
          {leftTab === "components" && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-3">
              <div className="relative">
                <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  placeholder="Search blocks"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
                {COMPONENT_CATALOG.filter((cat) =>
                  componentSearch
                    ? cat.category.toLowerCase().includes(componentSearch.toLowerCase()) ||
                      cat.items.some((it) => it.name.toLowerCase().includes(componentSearch.toLowerCase()))
                    : true
                ).map((cat) => {
                  const Icon = cat.icon;
                  const isOpen = openCategories.includes(cat.category) || componentSearch.length > 0;
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.category)}
                        className="w-full flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 px-1 py-1 hover:text-cyan-500 cursor-pointer transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="size-3.5 text-amber-600 dark:text-amber-400" />
                          <span>{cat.category}</span>
                          <span className="text-slate-400 font-normal">{cat.count}</span>
                        </span>
                        {isOpen ? (
                          <ChevronDown className="size-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="size-3.5 text-slate-400" />
                        )}
                      </button>

                      {/* Accordion Expanded Items */}
                      {isOpen && (
                        <div className="space-y-1.5 pl-1 animate-in fade-in-50 duration-150">
                          {cat.items
                            .filter((it) =>
                              componentSearch
                                ? it.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
                                  it.desc.toLowerCase().includes(componentSearch.toLowerCase())
                                : true
                            )
                            .map((item) => {
                              const isAdded = canvasBlocks.some((b) => b.type === item.id);
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => handleAddOrSelectBlock(item)}
                                  className={`p-2.5 rounded-xl border space-y-0.5 cursor-pointer transition-all ${
                                    isAdded
                                      ? "bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-600"
                                      : "bg-slate-50 hover:bg-cyan-50/40 dark:bg-slate-800/40 dark:hover:bg-cyan-950/20 border-slate-200 dark:border-slate-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                      <span>{item.icon}</span> <span>{item.name}</span>
                                    </span>
                                    <span className="text-[9px] bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-medium">
                                      {item.tag}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">{item.desc}</p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
                Click to add or drag blocks into the preview
              </div>
            </div>
          )}

          {/* Tab 3 Content: Pages Library (Screenshot 2) */}
          {leftTab === "pages" && (
            <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
              <div className="space-y-3 overflow-y-auto flex-1">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Page library</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pages here are for editing only. To show one on your website, add it to Menu settings on the right.</p>
                </div>

                <button
                  type="button"
                  onClick={() => showToast("info", "Mở tạo trang mới")}
                  className="w-full py-2.5 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="size-4" /> Add new page
                </button>

                <div className="space-y-2">
                  {[
                    { name: "Trang Chủ", slug: "/", date: "13-08", isHome: true, isEditing: true, isLive: false },
                    { name: "Giới Thiệu", slug: "/about", date: "13-08", isHome: false, isEditing: false, isLive: true },
                    { name: "Dịch Vụ", slug: "/services", date: "13-08", isHome: false, isEditing: false, isLive: true },
                    { name: "Bài Viết", slug: "/blog", date: "13-08", isHome: false, isEditing: false, isLive: true },
                  ].map((pg) => (
                    <div
                      key={pg.name}
                      onClick={() => setSelectedPage(pg.name)}
                      className={`p-3 rounded-2xl border transition-colors cursor-pointer space-y-2 ${
                        selectedPage === pg.name
                          ? "bg-cyan-50/40 dark:bg-cyan-950/20 border-[#06b6d4]"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{pg.name}</span>
                        <div className="flex items-center gap-1">
                          {pg.isHome && <span className="bg-cyan-100 dark:bg-cyan-950 text-[#06b6d4] font-bold px-1.5 py-0.2 rounded text-[10px]">🏠 Home</span>}
                          {pg.isEditing && <span className="bg-cyan-500 text-white font-bold px-1.5 py-0.2 rounded text-[10px]">● Editing</span>}
                          {pg.isLive && <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-bold px-1.5 py-0.2 rounded text-[10px]">● Live</span>}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{pg.slug} · {pg.date}</div>

                      {pg.isEditing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLeftTab("ai");
                          }}
                          className="w-full py-1.5 rounded-lg bg-[#06b6d4] text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs"
                        >
                          <MessageSquare className="size-3" /> Edit with AI chat
                        </button>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 hover:text-cyan-500"><Eye className="size-3" /> Visible</span>
                        <span className="flex items-center gap-1 hover:text-red-500"><Trash2 className="size-3" /> Delete</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Settings className="size-3.5" /> Custom 404 page</span>
                  <ChevronRight className="size-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── CENTER CANVAS (Screenshot 0, 5 - FULLY DYNAMIC BLOCKS) ───────── */}
        <div className="flex-1 bg-[#f1f5f9] dark:bg-slate-950/80 p-6 overflow-y-auto flex justify-center items-start relative">
          <div
            className={`transition-all duration-300 bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[600px] flex flex-col justify-between relative ${
              viewport === "mobile" ? "w-[390px]" : "w-full max-w-4xl"
            }`}
          >
            {/* Live Header Block */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center font-bold text-amber-900 text-xs">
                  🍵
                </div>
                <div className="hidden sm:flex items-center gap-5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {navLinks.map((l) => (
                    <span key={l} className="hover:text-cyan-500 cursor-pointer">{l}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer">
                <Package className="size-4 text-slate-400" />
                <span>Track order</span>
              </div>
            </div>

            {/* Dynamic Blocks Container */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {canvasBlocks.map((block, idx) => {
                const isSelected = selectedBlockId === block.id;
                return (
                  <ImpactNode key={block.id} targetId="editor-block-content" label={`${block.name} Active`}>
                    <div
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setRightTab("block");
                      }}
                      style={{
                        paddingTop: `${(block.topSpacing || 32) * 1.2}px`,
                        paddingBottom: `${(block.bottomSpacing || 32) * 1.2}px`,
                      }}
                      className={`relative group/block m-2 rounded-xl p-6 transition-all cursor-pointer ${
                        isSelected
                          ? "border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-md ring-2 ring-blue-500/20"
                          : "border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {/* Top Floating Tag */}
                      {isSelected && (
                        <div className="absolute -top-3 left-3 bg-blue-500 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow">
                          {block.name}
                        </div>
                      )}

                      {/* Floating Top Toolbar (Screenshot 5) */}
                      {isSelected && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-1 flex items-center gap-2 shadow-lg z-30">
                          <button
                            type="button"
                            title="Di chuyển lên"
                            disabled={idx === 0}
                            onClick={(e) => handleMoveBlock(idx, "up", e)}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Di chuyển xuống"
                            disabled={idx === canvasBlocks.length - 1}
                            onClick={(e) => handleMoveBlock(idx, "down", e)}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Nhân bản"
                            onClick={(e) => handleDuplicateBlock(block.id, e)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="AI Edit"
                            onClick={() => setLeftTab("ai")}
                            className="text-cyan-500 hover:text-cyan-600"
                          >
                            <Sparkles className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Xóa khối"
                            onClick={(e) => handleDeleteBlock(block.id, e)}
                            className="text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Block Specific Render Content (All 28 Block Types & Variants) */}
                      {block.type === "hero" ? (
                        <div
                          className={`items-center gap-8 ${
                            block.variant === "Centered"
                              ? "text-center flex flex-col justify-center"
                              : block.variant === "Split Right"
                              ? "grid grid-cols-1 md:grid-cols-2 flex-row-reverse"
                              : "grid grid-cols-1 md:grid-cols-2"
                          }`}
                        >
                          <div className={`space-y-4 ${block.variant === "Centered" ? "max-w-xl mx-auto" : ""}`}>
                            <div className="text-[11px] font-bold text-amber-700 tracking-wider">
                              • ĐẬM VỊ · TƯƠI MỚI · CHỤP ĐẸP
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                              {block.headline || "Chín 10"}
                            </h1>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                              {block.subheadline || "Trà trái cây chín mọng, trà sữa đậm vị, topping tươi mỗi ngày, giao nhanh tận nơi."}
                            </p>
                            <div className={`flex items-center gap-3 pt-2 ${block.variant === "Centered" ? "justify-center" : ""}`}>
                              <button type="button" className="px-5 py-2.5 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold text-xs shadow-md">
                                Order Now
                              </button>
                              <button type="button" className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100">
                                View Menu
                              </button>
                            </div>
                          </div>

                          <div className="relative flex items-center justify-center">
                            <div className="w-full max-w-sm h-60 rounded-3xl bg-[#fef3c7]/60 border border-amber-200 flex flex-col items-center justify-center p-6 shadow-md">
                              <div className="text-5xl font-black text-emerald-900">🍵</div>
                              <div className="text-2xl font-extrabold text-slate-900 mt-2">chinmuoi</div>
                              <div className="text-[10px] text-amber-800 tracking-widest font-bold mt-0.5">TRÀ SỮA CHÍN MƯỜI</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => showToast("info", "Mở đổi ảnh Hero")}
                              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white font-bold text-[11px] flex items-center gap-1.5 shadow"
                            >
                              <ImageIcon className="size-3.5" /> Change Image
                            </button>
                          </div>
                        </div>
                      ) : block.type === "features" || block.type === "services" ? (
                        <div className="space-y-6 text-center">
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Đặc Điểm Nổi Bật"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "Nguyên liệu tươi mới mỗi ngày, pha chế chuẩn vị."}</p>
                          </div>
                          <div className={`grid gap-4 ${block.variant === "4 Grid Cards" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
                            {[
                              { icon: "🍃", title: "Trà Tươi 100%", desc: "Lá trà organic tuyển chọn từ cao nguyên" },
                              { icon: "⚡", title: "Giao 30 Phút", desc: "Đảm bảo đá chưa tan, giữ trọn hương vị" },
                              { icon: "🏷️", title: "Freeship Từ 50k", desc: "Nhiều mã ưu đãi hấp dẫn mỗi tuần" },
                              ...(block.variant === "4 Grid Cards" ? [{ icon: "⭐", title: "Top 1 Rating", desc: "Hơn 50,000+ khách tin dùng" }] : []),
                            ].map((f, i) => (
                              <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 hover:border-cyan-400 transition-colors">
                                <div className="text-3xl">{f.icon}</div>
                                <h3 className="font-bold text-xs text-slate-900 dark:text-white">{f.title}</h3>
                                <p className="text-[11px] text-slate-500">{f.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : block.type === "product-grid" || block.type === "featured-product" ? (
                        <div className="space-y-6">
                          <div className="text-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Món Bán Chạy Nhất"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "Thưởng thức những ly trà sữa và trà trái cây được yêu thích nhất."}</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { name: "Trà Sữa Nướng Chín Muối", price: "RM 14.50", img: "🧋", badge: "Best Seller" },
                              { name: "Trà Đào Cam Sả Tươi", price: "RM 12.00", img: "🍑", badge: "Fresh" },
                              { name: "Matcha Cheese Kem Muối", price: "RM 16.00", img: "🍵", badge: "Hot" },
                              { name: "Trà Xoài Nhiệt Đới", price: "RM 13.50", img: "🥭", badge: "New" },
                            ].map((p, i) => (
                              <div key={i} className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-xs relative">
                                <span className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                                  {p.badge}
                                </span>
                                <div className="h-24 bg-amber-50/60 dark:bg-slate-700 rounded-xl flex items-center justify-center text-3xl">
                                  {p.img}
                                </div>
                                <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{p.name}</h4>
                                <div className="flex items-center justify-between pt-1">
                                  <span className="font-extrabold text-cyan-600 dark:text-cyan-400 text-xs">{p.price}</span>
                                  <button type="button" className="px-2 py-1 bg-[#06b6d4] text-white rounded-lg font-bold text-[10px] cursor-pointer hover:bg-cyan-600">+</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : block.type === "faq" ? (
                        <div className="space-y-4 max-w-2xl mx-auto">
                          <div className="text-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Câu Hỏi Thường Gặp"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "Giải đáp mọi thắc mắc về đặt hàng và giao hàng nhanh."}</p>
                          </div>
                          <div className="space-y-2">
                            {[
                              { q: "Quán mở cửa từ mấy giờ đến mấy giờ?", a: "Chín Muối mở cửa từ 8:00 sáng đến 22:30 tối tất cả các ngày trong tuần." },
                              { q: "Có chính sách freeship không?", a: "Freeship cho đơn hàng từ RM 50 trong bán kính 10km tại Kuala Lumpur." },
                              { q: "Trà sữa có điều chỉnh lượng đường đá được không?", a: "Có thể tùy chỉnh 0%, 30%, 50%, 70%, 100% đường và đá theo khẩu vị." },
                            ].map((faq, i) => (
                              <div key={i} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                                  <span>{faq.q}</span>
                                  <ChevronDown className="size-3.5 text-slate-400" />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-700/50">{faq.a}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : block.type === "testimonials" ? (
                        <div className="space-y-6 text-center">
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Khách Hàng Nói Gì Về Chín Muối"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "Hơn 50,000 khách hàng yêu thích và đánh giá 4.9 sao."}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                              { name: "Minh Anh", role: "Khách quen tại KL", stars: "★★★★★", quote: "Trà đào thơm nức, kem cheese mặn mặn béo ngậy đúng gu mình!" },
                              { name: "Sarah Lee", role: "Food Reviewer", stars: "★★★★★", quote: "Fast delivery, ice still solid and flavor is 10/10 authentic!" },
                              { name: "Tuấn Hưng", role: "Văn phòng Ampang", stars: "★★★★★", quote: "Cả team order mỗi chiều, đóng gói cẩn thận không bị đổ." },
                            ].map((t, i) => (
                              <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-left">
                                <div className="text-amber-500 text-sm tracking-wider">{t.stars}</div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <div className="font-bold text-xs text-slate-900 dark:text-white">{t.name}</div>
                                  <div className="text-[10px] text-slate-400">{t.role}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : block.type === "pricing" ? (
                        <div className="space-y-6 text-center">
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Bảng Giá Gói Hội Viên"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "Tiết kiệm hơn khi đăng ký gói thành viên VIP hàng tháng."}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                            {[
                              { tier: "Cơ Bản", price: "RM 29/tháng", perks: ["Voucher giảm 10%", "Freeship 2 đơn/tháng", "Tích điểm thường"] },
                              { tier: "Pro VIP", price: "RM 59/tháng", perks: ["Voucher giảm 20%", "Freeship không giới hạn", "Ưu tiên phục vụ", "Tặng bánh ngọt"], hot: true },
                              { tier: "Doanh Nghiệp", price: "RM 149/tháng", perks: ["Giảm giá 30% sỉ", "Giao định kỳ hàng ngày", "Xuất hóa đơn VAT"] },
                            ].map((p, i) => (
                              <div key={i} className={`p-5 rounded-2xl border space-y-3 relative ${p.hot ? "border-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/20 shadow-md ring-2 ring-cyan-500/30" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"}`}>
                                {p.hot && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">MOST POPULAR</span>}
                                <h3 className="font-bold text-sm">{p.tier}</h3>
                                <div className="text-xl font-extrabold text-cyan-600">{p.price}</div>
                                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 text-left pt-2 border-t border-slate-200 dark:border-slate-700">
                                  {p.perks.map((pk, j) => (
                                    <div key={j} className="flex items-center gap-1.5">✓ {pk}</div>
                                  ))}
                                </div>
                                <button type="button" className={`w-full py-2 rounded-xl font-bold text-xs mt-2 ${p.hot ? "bg-[#06b6d4] text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"}`}>
                                  Chọn Gói Này
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : block.type === "contact-form" ? (
                        <div className="max-w-md mx-auto space-y-4">
                          <div className="text-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Liên Hệ Với Chúng Tôi"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "Gửi thắc mắc hoặc yêu cầu hợp tác đại lý, nhượng quyền."}</p>
                          </div>
                          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Họ & Tên</label>
                              <input placeholder="Nguyễn Văn A" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Số Điện Thoại</label>
                                <input placeholder="+60 12-345 6789" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label>
                                <input placeholder="email@domain.com" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nội Dung Tin Nhắn</label>
                              <textarea rows={2} placeholder="Nội dung cần liên hệ..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs resize-none" />
                            </div>
                            <button type="button" className="w-full py-2 bg-[#06b6d4] text-white font-bold rounded-xl text-xs shadow-sm hover:bg-cyan-600">
                              Gửi Tin Nhắn
                            </button>
                          </div>
                        </div>
                      ) : block.type === "countdown" ? (
                        <div className="p-6 bg-linear-to-r from-amber-500 to-rose-500 rounded-2xl text-white text-center space-y-4 shadow-lg">
                          <div>
                            <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">🔥 FLASH SALE CUỐI TUẦN</span>
                            <h2 className="text-2xl font-black mt-2">{block.headline || "Giảm 20% Toàn Bộ Menu Trà"}</h2>
                            <p className="text-xs text-white/90">{block.subheadline || "Nhập mã CHINMUOI20 khi thanh toán trực tuyến"}</p>
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            {[
                              { label: "NGÀY", val: "02" },
                              { label: "GIỜ", val: "14" },
                              { label: "PHÚT", val: "35" },
                              { label: "GIÂY", val: "10" },
                            ].map((unit, i) => (
                              <div key={i} className="bg-black/30 backdrop-blur-xs rounded-xl p-2 w-14 text-center">
                                <div className="text-xl font-black font-mono">{unit.val}</div>
                                <div className="text-[8px] text-white/75">{unit.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : block.type === "google-map" ? (
                        <div className="space-y-3">
                          <div className="text-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{block.headline || "Địa Chỉ Cửa Hàng"}</h2>
                            <p className="text-xs text-slate-500 mt-1">{block.subheadline || "12 Jalan Ampang, Kuala Lumpur, Malaysia"}</p>
                          </div>
                          <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="text-4xl">🗺️</div>
                            <div className="font-bold text-xs mt-1">Google Maps Preview (KL Center)</div>
                            <span className="text-[10px] text-slate-500">Lat: 3.1569 · Lng: 101.7123</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center space-y-2 border border-dashed border-slate-300 dark:border-slate-700">
                          <div className="text-3xl">{block.icon || "📦"}</div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">{block.headline || block.name}</h3>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">{block.subheadline}</p>
                        </div>
                      )}
                    </div>
                  </ImpactNode>
                );
              })}
            </div>

            {/* Bottom Float Cart (Screenshot 0) */}
            <div className="p-4 flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-amber-900 text-white flex items-center justify-center relative shadow-lg cursor-pointer">
                <ShoppingCart className="size-5" />
                <span className="absolute -top-1 -right-1 bg-white text-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-amber-900">
                  0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (Width ~300px) (Screenshot 0, 3, 4, 5, 6) ────────── */}
        <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          {/* 4 Mode Grid Tabs (2x2) */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1 bg-slate-50/50 dark:bg-slate-800/40">
            <button
              key="global"
              data-testid="right-tab-global"
              type="button"
              onClick={() => setRightTab("global")}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rightTab === "global" ? "bg-[#06b6d4] text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Settings className="size-3.5" /> Global
            </button>
            <button
              key="seo"
              data-testid="right-tab-seo"
              type="button"
              onClick={() => setRightTab("seo")}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rightTab === "seo" ? "bg-[#06b6d4] text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Search className="size-3.5" /> SEO
            </button>
            <button
              key="menu"
              data-testid="right-tab-menu"
              type="button"
              onClick={() => setRightTab("menu")}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rightTab === "menu" ? "bg-[#06b6d4] text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Compass className="size-3.5" /> Menu
            </button>
            <button
              key="block"
              data-testid="right-tab-block"
              type="button"
              onClick={() => setRightTab("block")}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rightTab === "block" ? "bg-[#06b6d4] text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Layers className="size-3.5" /> Block
            </button>
          </div>

          {/* Right Tab 1: Global Site Settings (Screenshot 0, 6) */}
          {rightTab === "global" && (
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center gap-1.5 text-[#06b6d4] font-bold text-xs">
                <Settings className="size-3.5" /> GLOBAL SITE SETTINGS
              </div>

              {/* Brand Identity Accordion */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <span>Brand identity</span>
                  <ChevronDown className="size-3.5 text-slate-400" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">BUSINESS NAME</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">UPLOAD LOGO</label>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="w-12 h-8 rounded bg-amber-50 flex items-center justify-center text-xs font-bold">🍵</div>
                    <div className="flex gap-2 text-xs">
                      <button type="button" className="text-slate-600 hover:text-cyan-500 font-semibold">Replace</button>
                      <button type="button" className="text-red-500 hover:text-red-600 font-semibold">🗑️ Remove</button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">UPLOAD FAVICON</label>
                  <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 text-xs cursor-pointer hover:border-cyan-500">
                    <Upload className="size-4 mx-auto mb-1" />
                    <span>Click to upload</span>
                  </div>
                </div>
              </div>

              {/* Contact Info Accordion */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <span>Contact info</span>
                  <ChevronDown className="size-3.5 text-slate-400" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">PHONE</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">EMAIL</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">ADDRESS</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Price Range & Service Area (Screenshot 6) */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">PRICE RANGE</label>
                  <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
                    <option>$ - Budget</option>
                    <option>$$ - Moderate</option>
                    <option>$$$ - Premium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">SERVICE AREA</label>
                  <textarea
                    rows={2}
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                  />
                </div>

                {/* Local SEO Essentials (Screenshot 6) */}
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">LOCAL SEO ESSENTIALS</span>
                  <div className="space-y-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <div>● Address saved</div>
                    <div>✓ Opening hours saved</div>
                    <div>✓ Business category saved</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Tab 2: SEO & Social (Screenshot 3) */}
          {rightTab === "seo" && (
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center gap-1.5 text-[#06b6d4] font-bold text-xs">
                <Search className="size-3.5" /> SEO & SOCIAL
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search verification</label>
                <input
                  value={searchVerification}
                  onChange={(e) => setSearchVerification(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL slug</label>
                <input defaultValue="/" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono" />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                  <span>Meta title</span>
                  <span>{metaTitle.length}/60 characters</span>
                </div>
                <input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                  <span>Meta description</span>
                  <span>{metaDesc.length}/160 characters</span>
                </div>
                <textarea
                  rows={3}
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                />
              </div>

              {/* Google Preview Card (Screenshot 3) */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">GOOGLE PREVIEW</span>
                <div className="text-[11px] text-slate-500 font-mono truncate">https://ch-n-mu-i.web-v2.dev.ecommercehub...</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">{metaTitle}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{metaDesc}</div>
              </div>
            </div>
          )}

          {/* Right Tab 3: Menu Settings (Screenshot 4) */}
          {rightTab === "menu" && (
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center gap-1.5 text-[#06b6d4] font-bold text-xs">
                <Compass className="size-3.5" /> MENU SETTINGS
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Navigation style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Default", "Centered", "Transparent", "Sidebar", "Floating"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNavStyle(st)}
                      className={`py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        navStyle === st ? "bg-cyan-50 dark:bg-cyan-950/60 border border-[#06b6d4] text-[#06b6d4] font-bold" : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Navigation links</label>
                <div className="space-y-1.5">
                  {navLinks.map((l) => (
                    <div key={l} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">⋮⋮ {l}</span>
                      <Pencil className="size-3.5 text-slate-400 cursor-pointer hover:text-cyan-500" />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => showToast("info", "Mở thêm liên kết Navigation")}
                    className="w-full py-2 border border-dashed border-[#06b6d4] text-[#06b6d4] font-bold rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-cyan-50/50 cursor-pointer"
                  >
                    <Plus className="size-3.5" /> Add link
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs">QUICK LANGUAGE ⓘ</span>
                  <p className="text-[10px] text-slate-400">Turn on multi-language</p>
                </div>
                <div
                  onClick={() => setMultiLang(!multiLang)}
                  className={`w-9 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors ${
                    multiLang ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Right Tab 4: Block Settings (Dynamic for currently selected block) */}
          {rightTab === "block" && (
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#06b6d4] font-bold">
                  <Layers className="size-3.5" /> BLOCK SETTINGS [{selectedBlock.type || "hero"}]
                </div>
                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-600 font-bold px-2 py-0.5 rounded">
                  #{canvasBlocks.findIndex((b) => b.id === selectedBlock.id) + 1} of {canvasBlocks.length}
                </span>
              </div>

              {/* Block Name Banner */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <span>{selectedBlock.icon || "🎯"}</span>
                  <span>{selectedBlock.name}</span>
                </span>
                <span className="text-slate-400 font-mono text-[10px]">{selectedBlock.type}</span>
              </div>

              {/* Component-Specific VARIANTS Segmented Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>VARIANT ({BLOCK_TYPE_CONFIG[selectedBlock.type]?.variants?.length || 4})</span>
                  <span className="text-cyan-500 font-mono">{selectedBlock.variant || "Default"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(BLOCK_TYPE_CONFIG[selectedBlock.type]?.variants || [
                    "Default", "Centered", "Split Left", "Minimal",
                  ]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateSelectedBlock("variant", v)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                        (selectedBlock.variant || "Default") === v ||
                        ((selectedBlock.variant === undefined || selectedBlock.variant === "Split Left") && v === "Split Left")
                          ? "bg-[#06b6d4] text-white font-bold shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout & Spacing Sliders */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">LAYOUT & SPACING</label>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Top Spacing</span>
                    <span className="text-slate-400 font-mono">{selectedBlock.topSpacing || 32}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    value={selectedBlock.topSpacing || 32}
                    onChange={(e) => updateSelectedBlock("topSpacing", Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Bottom Spacing</span>
                    <span className="text-slate-400 font-mono">{selectedBlock.bottomSpacing || 32}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    value={selectedBlock.bottomSpacing || 32}
                    onChange={(e) => updateSelectedBlock("bottomSpacing", Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Common Headline & Subheadline Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Headline / Title</label>
                  <input
                    value={selectedBlock.headline || ""}
                    onChange={(e) => updateSelectedBlock("headline", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subheadline / Description</label>
                  <textarea
                    rows={3}
                    value={selectedBlock.subheadline || ""}
                    onChange={(e) => updateSelectedBlock("subheadline", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs leading-relaxed text-slate-900 dark:text-white resize-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* ── COMPONENT-SPECIFIC CUSTOM FEATURES & CONTROLS ─────────── */}

              {/* 1. HERO SPECIFIC CONTROLS */}
              {selectedBlock.type === "hero" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">HERO FEATURES</span>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Badge Tagline</label>
                    <input
                      defaultValue="• ĐẬM VỊ · TƯƠI MỚI · CHỤP ĐẸP"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primary CTA</label>
                      <input defaultValue="Order Now" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Secondary CTA</label>
                      <input defaultValue="View Menu" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PRODUCT GRID SPECIFIC CONTROLS */}
              {selectedBlock.type === "product-grid" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">PRODUCT GRID SETTINGS</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Columns</label>
                      <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                        <option>4 Columns (Desktop)</option>
                        <option>3 Columns (Large)</option>
                        <option>2 Columns (Compact)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Currency Tag</label>
                      <input defaultValue="RM" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono" />
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
                    <span>Show Quick Add to Cart button</span>
                    <span className="text-emerald-500 font-bold">Enabled</span>
                  </div>
                </div>
              )}

              {/* 3. FAQ SPECIFIC CONTROLS */}
              {selectedBlock.type === "faq" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">FAQ QUESTIONS (3)</span>
                  {[
                    "Quán mở cửa từ mấy giờ?",
                    "Có freeship cho đơn trên RM 50 không?",
                    "Topping có tươi làm trong ngày không?",
                  ].map((q, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{q}</span>
                      <Pencil className="size-3.5 text-slate-400 cursor-pointer hover:text-cyan-500 shrink-0" />
                    </div>
                  ))}
                  <button type="button" className="w-full py-2 border border-dashed border-[#06b6d4] text-[#06b6d4] font-bold rounded-xl text-xs flex items-center justify-center gap-1">
                    <Plus className="size-3.5" /> Add FAQ Item
                  </button>
                </div>
              )}

              {/* 4. CONTACT FORM SPECIFIC CONTROLS */}
              {selectedBlock.type === "contact-form" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">CONTACT FORM SETTINGS</span>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Receiver Email</label>
                    <input defaultValue="thaongan10@yopmail.com" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Submit Button Text</label>
                    <input defaultValue="Gửi Tin Nhắn" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs" />
                  </div>
                </div>
              )}

              {/* 5. COUNTDOWN TIMER SPECIFIC CONTROLS */}
              {selectedBlock.type === "countdown" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">COUNTDOWN TIMER</span>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sale End Date & Time</label>
                    <input defaultValue="2026-08-31 23:59:59" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Promo Discount Code</label>
                    <input defaultValue="CHINMUOI20" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-cyan-600" />
                  </div>
                </div>
              )}

              {/* 6. GOOGLE MAP SPECIFIC CONTROLS */}
              {selectedBlock.type === "google-map" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">MAP CONFIGURATION</span>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store Address Pin</label>
                    <input defaultValue="12 Jalan Ampang, 50450 Kuala Lumpur" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Map Zoom (15x)</label>
                    <input type="range" min="1" max="20" defaultValue="15" className="w-full accent-cyan-500 cursor-pointer" />
                  </div>
                </div>
              )}

              {/* Generic CTA Button Add */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">ACTION BUTTONS</label>
                <button
                  type="button"
                  onClick={() => showToast("info", `Mở thêm nút Action cho khối ${selectedBlock.name}`)}
                  className="w-full py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-[#06b6d4] text-[#06b6d4] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer hover:bg-cyan-100"
                >
                  <Plus className="size-3.5" /> Add custom button
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Blog Posts List & AI Generator (F17)
// ═════════════════════════════════════════════════════════════════════════════

function BlogScreenStaging({
  blogPosts,
  setBlogPosts,
  onOpenCreate,
  onOpenEdit,
  onOpenCategories,
  ImpactNode,
  openInspector,
  showToast,
}: {
  blogPosts: any[];
  setBlogPosts: React.Dispatch<React.SetStateAction<any[]>>;
  onOpenCreate: () => void;
  onOpenEdit: (id: string) => void;
  onOpenCategories: () => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");

  const filtered = blogPosts.filter((p) => {
    if (tab === "published" && p.status !== "published") return false;
    if (tab === "draft" && p.status !== "draft") return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Blog posts</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage and publish articles to boost store traffic and SEO.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCategories}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Tag className="size-3.5" /> Categories
          </button>
          <ImpactNode targetId="blog-post-management" label="AI Blog Assistant">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="size-3.5 text-cyan-500" /> AI assistant
            </button>
          </ImpactNode>
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" /> Create post
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {[
          { id: "all", label: "All", count: blogPosts.length },
          { id: "published", label: "Published", count: blogPosts.filter((p) => p.status === "published").length },
          { id: "draft", label: "Draft", count: blogPosts.filter((p) => p.status === "draft").length },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
              tab === t.id ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
            }`}
          >
            <span>{t.label}</span>
            <span className="text-[11px] font-bold opacity-80">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
        />
      </div>

      {/* Blog Table */}
      <ImpactNode targetId="blog-post-management" label="Blog Posts Table">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-4 w-12">THUMBNAIL</th>
                <th className="p-4">TITLE & SLUG</th>
                <th className="p-4">CATEGORY</th>
                <th className="p-4">STATUS</th>
                <th className="p-4">AUTHOR</th>
                <th className="p-4">CREATED</th>
                <th className="p-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <img src={p.thumbnail} alt={p.title} className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-white hover:text-cyan-500 cursor-pointer" onClick={() => onOpenEdit(p.id)}>
                      {p.title}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">/{p.slug}</div>
                  </td>
                  <td className="p-4">
                    <span className="bg-cyan-50 dark:bg-cyan-950/60 text-[#06b6d4] font-bold px-2 py-0.5 rounded text-[11px]">
                      {p.category}
                    </span>
                  </td>
                  <td className="p-4">
                    {p.status === "published" ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Draft
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{p.author}</td>
                  <td className="p-4 text-slate-400">{p.createdAt}</td>
                  <td className="p-4 text-right space-x-2">
                    <button type="button" onClick={() => onOpenEdit(p.id)} className="p-1 text-slate-400 hover:text-cyan-500 cursor-pointer">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBlogPosts((prev) => prev.filter((item) => item.id !== p.id));
                        showToast("info", `Đã xóa bài viết "${p.title}"`);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ImpactNode>

      {/* AI Assistant Modal (F17 Error Demo) */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-cyan-500" />
                <h3 className="font-bold text-sm">AI Blog Assistant</h3>
              </div>
              <button type="button" onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-4" />
              </button>
            </div>

            <p className="text-slate-500 text-[11px]">Describe the topic or angle you want AI to generate an SEO blog post for:</p>

            <input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="e.g. 5 reasons organic green tea improves digestion"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAiModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlogPosts((prev) => [
                    {
                      id: `b-${Date.now()}`,
                      title: aiTopic || "The Ultimate Organic Tea Guide",
                      slug: (aiTopic || "organic-tea-guide").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                      status: "draft",
                      author: "AI Assistant",
                      category: "Guides",
                      createdAt: "Today",
                      thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80",
                    },
                    ...prev,
                  ]);
                  setShowAiModal(false);
                  showToast("success", "✓ AI đã tạo bản nháp bài viết mới!");
                }}
                className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold"
              >
                Generate Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlogEditScreenStaging({
  post,
  categories,
  onBack,
  onSave,
  ImpactNode,
  openInspector,
  showToast,
}: {
  post: any | null;
  categories: string[];
  onBack: () => void;
  onSave: (p: any) => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [title, setTitle] = useState(post?.title || "New Article");
  const [category, setCategory] = useState(post?.category || categories[0] || "Guides");
  const [status, setStatus] = useState<"draft" | "published">(post?.status || "published");
  const [content, setContent] = useState(
    post?.content ||
      "Discover the authentic heritage behind artisanal teas and seasonal refreshments freshly crafted each day."
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{post ? "Edit Post" : "Create New Post"}</h1>
            <p className="text-slate-500 text-[11px]">Draft and publish high-ranking blog articles</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSave({
                id: post?.id || `b-${Date.now()}`,
                title,
                slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                status: "draft",
                category,
                author: "Admin",
                createdAt: post?.createdAt || "Today",
                thumbnail: post?.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80",
                content,
              });
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({
                id: post?.id || `b-${Date.now()}`,
                title,
                slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                status: "published",
                category,
                author: "Admin",
                createdAt: post?.createdAt || "Today",
                thumbnail: post?.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80",
                content,
              });
            }}
            className="px-5 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold shadow"
          >
            Publish Article
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
        <div>
          <label className="block font-semibold mb-1">Post Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Article Body (Markdown / Rich text)</label>
          <textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

function CategoryModalStaging({
  categories,
  onClose,
  onAddCategory,
  onDeleteCategory,
}: {
  categories: string[];
  onClose: () => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (name: string) => void;
}) {
  const [newCat, setNewCat] = useState("");

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-sm">Manage Blog Categories</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category name..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (newCat.trim()) {
                onAddCategory(newCat.trim());
                setNewCat("");
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#06b6d4] text-white font-bold"
          >
            Add
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map((c) => (
            <div key={c} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-semibold">{c}</span>
              <button type="button" onClick={() => onDeleteCategory(c)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Orders Management & Detail Panel (F07)
// ═════════════════════════════════════════════════════════════════════════════

function OrdersScreenStaging({
  orders,
  setOrders,
  onSelectOrder,
  ImpactNode,
  openInspector,
  showToast,
}: {
  orders: any[];
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  onSelectOrder: (ord: any) => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"all" | "confirmed" | "delivered" | "unpaid">("all");
  const [search, setSearch] = useState("");

  const filtered = orders.filter((o) => {
    if (tab === "confirmed" && o.status !== "Confirmed" && o.status !== "Processing") return false;
    if (tab === "delivered" && o.status !== "Delivered") return false;
    if (tab === "unpaid" && o.status !== "Unpaid") return false;
    if (search && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.customer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Orders</h1>
          <p className="text-slate-500 text-xs mt-0.5">Track, fulfill and manage store orders across all channels.</p>
        </div>

        <button
          type="button"
          onClick={() => showToast("success", "Đã xuất file CSV đơn hàng!")}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold flex items-center gap-1.5 shadow-xs"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", val: "128", delta: "+12.5%", color: "text-cyan-500" },
          { label: "Pending Fulfillment", val: "12", delta: "Action required", color: "text-amber-500" },
          { label: "Delivered", val: "112", delta: "98% completion", color: "text-emerald-500" },
          { label: "Unpaid / COD", val: "4", delta: "RM 145.00", color: "text-blue-500" },
        ].map((c, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{c.val}</div>
            <span className={`text-[11px] font-bold ${c.color}`}>{c.delta}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {[
          { id: "all", label: "All Orders", count: orders.length },
          { id: "confirmed", label: "Processing / Confirmed", count: orders.filter((o) => o.status === "Confirmed" || o.status === "Processing").length },
          { id: "delivered", label: "Delivered", count: orders.filter((o) => o.status === "Delivered").length },
          { id: "unpaid", label: "Unpaid", count: orders.filter((o) => o.status === "Unpaid").length },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
              tab === t.id ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
            }`}
          >
            <span>{t.label}</span>
            <span className="text-[10px] font-bold opacity-80">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <ImpactNode targetId="orders-list-search-metrics" label="Orders Table">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-4">ORDER #</th>
                <th className="p-4">CUSTOMER</th>
                <th className="p-4">ITEMS</th>
                <th className="p-4">TOTAL</th>
                <th className="p-4">PAYMENT</th>
                <th className="p-4">STATUS</th>
                <th className="p-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">{o.id}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-white">{o.customer}</div>
                    <div className="text-[10px] text-slate-400">{o.phone}</div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{o.items}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">RM {o.total.toFixed(2)}</td>
                  <td className="p-4 text-slate-500">{o.payment}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        o.status === "Delivered"
                          ? "bg-emerald-50 text-emerald-600"
                          : o.status === "Confirmed"
                          ? "bg-cyan-50 text-cyan-600"
                          : o.status === "Processing"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" /> {o.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectOrder(o)}
                      className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold hover:border-cyan-500 cursor-pointer"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ImpactNode>
    </div>
  );
}

function OrderDetailDrawerStaging({
  order,
  onClose,
  onUpdateStatus,
  showToast,
}: {
  order: any;
  onClose: () => void;
  onUpdateStatus: (s: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl animate-in slide-in-from-right duration-200 text-slate-900 dark:text-slate-100 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg text-cyan-600 dark:text-cyan-400">{order.id}</span>
            <span className="bg-cyan-500/15 text-cyan-500 font-bold px-2 py-0.5 rounded text-[11px]">
              {order.status}
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="size-5" />
          </button>
        </div>

        {/* Action Status Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUpdateStatus("Confirmed")}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 cursor-pointer"
          >
            Mark Confirmed
          </button>
          <button
            type="button"
            onClick={() => onUpdateStatus("Delivered")}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 cursor-pointer"
          >
            Mark Delivered
          </button>
          <button
            type="button"
            onClick={() => onUpdateStatus("Cancelled")}
            className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-500 font-semibold hover:bg-red-50 cursor-pointer"
          >
            Cancel Order
          </button>
        </div>

        {/* Customer Information Card */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Customer & Shipping Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">NAME</span>
              <div className="font-bold text-slate-800 dark:text-slate-200">{order.customer}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">PHONE</span>
              <div className="font-mono text-slate-800 dark:text-slate-200">{order.phone}</div>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">SHIPPING ADDRESS</span>
            <div className="text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{order.address}</div>
          </div>
        </div>

        {/* Line Items Breakdown */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Ordered Items</h4>
          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{order.items}</span>
              <span className="font-bold">RM {order.subtotal?.toFixed(2) || (order.total - 7.5).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Shipping Fee (EasyParcel West MY)</span>
              <span>RM {order.shipping?.toFixed(2) || "7.50"}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
              <span>Grand Total</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-black">RM {order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Fulfillment Tracking */}
        {order.awbNo && (
          <div className="p-4 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-500 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-cyan-600 font-bold uppercase">EASYPARCEL TRACKING</span>
              <div className="font-mono font-bold text-slate-900 dark:text-white">{order.awbNo}</div>
            </div>
            <button
              type="button"
              onClick={() => showToast("info", "Mở trang tra cứu EasyParcel tracking")}
              className="px-3 py-1 bg-[#06b6d4] text-white font-bold rounded-lg text-[11px]"
            >
              Track AWB
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Dashboard Screen (Using Exact `.dash-revamp` Structure & Styles)
// ═════════════════════════════════════════════════════════════════════════════

function DashboardScreen({
  ImpactNode,
  openInspector,
  onOpenCustomize,
  onOpenAiFix,
  onNavigateEditor,
  showToast,
}: {
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  onOpenCustomize: () => void;
  onOpenAiFix: () => void;
  onNavigateEditor: () => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [timePeriod, setTimePeriod] = useState<"today" | "7d" | "30d">("7d");

  return (
    <div className="dash-revamp max-w-7xl mx-auto space-y-6">
      {/* Top Greeting */}
      <div className="mb-2">
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome to Web Store Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track your store&apos;s performance and run your online business from one place.
        </p>
      </div>

      {/* Toolbar */}
      <div className="dt-toolbar">
        <div className="dt-left">
          <h2 className="dt-title">Dashboard</h2>
          <span className="dt-sub">Daily · 14 – 20 Aug 2026</span>
        </div>

        <div className="dt-right">
          <div className="segmented">
            <button
              type="button"
              onClick={() => setTimePeriod("today")}
              className={timePeriod === "today" ? "active" : ""}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod("7d")}
              className={timePeriod === "7d" ? "active" : ""}
            >
              7 days
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod("30d")}
              className={timePeriod === "30d" ? "active" : ""}
            >
              30 days
            </button>
          </div>

          <ImpactNode targetId="dashboard-preferences-sync" label="Customize Dashboard Modal">
            <button
              type="button"
              onClick={onOpenCustomize}
              className="btn btn-secondary"
            >
              <SlidersHorizontal className="size-3.5" /> Customize
            </button>
          </ImpactNode>
        </div>
      </div>

      {/* Stream Container */}
      <div className="stream">
        {/* Onboarding Checklist Card (75%) */}
        <div className="onb">
          <div className="onb-top">
            <div className="onb-ring">
              <svg width="48" height="48">
                <circle cx="24" cy="24" r="21" fill="none" stroke="var(--dr-surface-3)" strokeWidth="5" />
                <circle
                  cx="24"
                  cy="24"
                  r="21"
                  fill="none"
                  stroke="url(#onbGradReal)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="98.96 131.94"
                  transform="rotate(-90 24 24)"
                />
                <defs>
                  <linearGradient id="onbGradReal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#2dd4bf" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="pct">75%</span>
            </div>
            <div className="onb-titles">
              <h3>Finish setting up your store</h3>
              <p>Complete 1 more step to launch your website.</p>
            </div>
          </div>

          <div className="onb-steps">
            {/* Step 1: Verify products */}
            <div className="onb-step done">
              <span className="step-tick">
                <Check className="size-3.5" />
              </span>
              <div className="step-body">
                <div className="step-name">Verify your products</div>
                <div className="step-desc">AI added demo items. Please check inventory, prices, and variations.</div>
              </div>
              <button
                type="button"
                onClick={() => showToast("info", "Đang mở danh mục sản phẩm")}
                className="btn btn-ghost btn-sm"
              >
                <Eye className="size-3.5" /> Review
              </button>
            </div>

            {/* Step 2: Customize design (Active) */}
            <div className="onb-step next">
              <span className="step-tick" />
              <div className="step-body">
                <div className="step-name">Customize your design</div>
                <div className="step-desc">Update images, text, and colors to match your personal brand.</div>
              </div>
              <button
                type="button"
                onClick={onNavigateEditor}
                className="btn btn-primary btn-sm"
              >
                Edit →
              </button>
            </div>

            {/* Step 3: Shipping */}
            <div className="onb-step done">
              <span className="step-tick">
                <Check className="size-3.5" />
              </span>
              <div className="step-body">
                <div className="step-name">Set up shipping fees</div>
                <div className="step-desc">Current default is COD & Free delivery. Update rates to avoid shipping losses.</div>
              </div>
              <button
                type="button"
                onClick={() => showToast("info", "Mở cài đặt vận chuyển")}
                className="btn btn-ghost btn-sm"
              >
                <Eye className="size-3.5" /> Set up
              </button>
            </div>

            {/* Step 4: Publish */}
            <div className="onb-step done">
              <span className="step-tick">
                <Check className="size-3.5" />
              </span>
              <div className="step-body">
                <div className="step-name">Publish your website</div>
                <div className="step-desc">Ready to sell? Make your store live and start accepting orders today.</div>
              </div>
              <button
                type="button"
                onClick={() => showToast("success", "Website đã online!")}
                className="btn btn-ghost btn-sm"
              >
                <Eye className="size-3.5" /> Publish
              </button>
            </div>
          </div>
        </div>

        {/* At a glance section */}
        <div className="section">
          <div className="section-head">
            <div className="sh-left">
              <span className="sh-icon">
                <Grid className="size-4" />
              </span>
              <div>
                <h3 className="sh-title">At a glance</h3>
                <span className="sh-sub">Daily · 14 – 20 Aug 2026</span>
              </div>
            </div>
          </div>

          <div className="stat-grid">
            {/* Stat 1: Page views */}
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-top-left">
                  <span className="stat-ic" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>
                    <Eye className="size-4" />
                  </span>
                  <span className="stat-label">Page views</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  ↗ +100.0%
                </span>
              </div>
              <div className="stat-bottom">
                <span className="stat-val text-3xl font-extrabold text-slate-900 dark:text-white">3</span>
                <span className="delta-note text-xs text-slate-400">vs prev 7d</span>
              </div>
            </div>

            {/* Stat 2: Leads */}
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-top-left">
                  <span className="stat-ic" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>
                    <MousePointerClick className="size-4" />
                  </span>
                  <span className="stat-label">Leads</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  — 0.0%
                </span>
              </div>
              <div className="stat-bottom">
                <span className="stat-val text-3xl font-extrabold text-slate-900 dark:text-white">0</span>
                <span className="delta-note text-xs text-slate-400">vs prev 7d</span>
              </div>
            </div>

            {/* Stat 3: Engagement */}
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-top-left">
                  <span className="stat-ic" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                    <ShoppingBag className="size-4" />
                  </span>
                  <span className="stat-label">Engagement</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  — 0.0%
                </span>
              </div>
              <div className="stat-bottom">
                <span className="stat-val text-3xl font-extrabold text-slate-900 dark:text-white">0</span>
                <span className="delta-note text-xs text-slate-400">vs prev 7d</span>
              </div>
            </div>

            {/* Stat 4: Revenue */}
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-top-left">
                  <span className="stat-ic" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    <DollarSign className="size-4" />
                  </span>
                  <span className="stat-label">Revenue</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  — 0.0%
                </span>
              </div>
              <div className="stat-bottom">
                <span className="stat-val text-2xl font-extrabold text-slate-900 dark:text-white">RM 0.00</span>
                <span className="delta-note text-xs text-slate-400">vs prev 7d</span>
              </div>
            </div>
          </div>
        </div>

        {/* Traffic & Performance Card */}
        <ImpactNode targetId="traffic-performance-client" label="Traffic & Performance">
          <div className="card card-pad space-y-4">
            <div className="section-head">
              <div className="sh-left">
                <span className="sh-icon">
                  <TrendingUp className="size-4 text-[#06b6d4]" />
                </span>
                <div>
                  <h3 className="sh-title">Traffic & performance</h3>
                  <span className="sh-sub">Daily pageviews and what&apos;s driving them</span>
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              <b className="text-slate-900 dark:text-white text-base font-bold">3</b> total pageviews · last 7 days
            </div>

            <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800 px-4">
              {["14 Aug", "15 Aug", "16 Aug", "17 Aug", "18 Aug", "19 Aug", "20 Aug (Today)"].map((day, i) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                  <div
                    style={{ height: i === 6 ? "80%" : "2px" }}
                    className={`w-full max-w-[48px] rounded-t-md transition-all ${i === 6 ? "bg-[#3b82f6] group-hover:bg-[#2563eb]" : "bg-slate-100 dark:bg-slate-800"}`}
                  />
                  <span className="text-[11px] text-slate-400 font-medium">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </ImpactNode>

        {/* SEO Health Card */}
        <ImpactNode targetId="seo-tools-automation" label="SEO Health Widget">
          <div className="card card-pad space-y-6">
            <div className="section-head">
              <div className="sh-left">
                <span className="sh-icon">
                  <Globe className="size-4 text-[#06b6d4]" />
                </span>
                <div>
                  <h3 className="sh-title">SEO health</h3>
                  <span className="sh-sub">How discoverable your store is on search engines</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="flex flex-col items-center justify-center p-4">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-28 h-28 -rotate-90">
                    <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" fill="none" />
                    <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" strokeDasharray="301" strokeDashoffset="198" strokeLinecap="round" className="text-[#ef4444]" fill="none" />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">34</span>
                    <span className="text-xs text-slate-400 block font-bold">/ 100</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#ef4444] mt-2">At risk</span>
              </div>

              <div className="md:col-span-2 space-y-3">
                {[
                  { name: "Business Data", pct: "35%", status: "Needs work" },
                  { name: "Schema", pct: "10%", status: "Needs work" },
                  { name: "AI Discoverability", pct: "45%", status: "Needs work" },
                  { name: "Technical Health", pct: "75%", status: "Needs work" },
                ].map((bar, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{bar.name}</span>
                      <span className="text-amber-500 text-[11px] font-bold">{bar.status}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: bar.pct }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                <span>Most critical issue: 3 pages missing meta descriptions. Fixing these will lift your score.</span>
              </div>
              <button
                type="button"
                onClick={onOpenAiFix}
                className="btn btn-ai btn-sm"
              >
                <Sparkles className="size-3.5" /> AI Fix Issues
              </button>
            </div>
          </div>
        </ImpactNode>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Products List (Screenshot 0)
// ═════════════════════════════════════════════════════════════════════════════

function ProductsScreenStaging({
  products,
  setProducts,
  onOpenAdd,
  onOpenAiDrafts,
  ImpactNode,
  openInspector,
  showToast,
}: {
  products: any[];
  setProducts: React.Dispatch<React.SetStateAction<any[]>>;
  onOpenAdd: () => void;
  onOpenAiDrafts: () => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"all" | "active" | "draft" | "archived">("all");
  const [search, setSearch] = useState("");
  const [aiText, setAiText] = useState("");

  const filtered = products.filter((p) => {
    if (tab === "active" && !p.status) return false;
    if (tab === "draft" && p.status) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* AI Chat Banner (Screenshot 0) */}
      <ImpactNode targetId="products-ai-description" label="AI Product Bulk Generator">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-cyan-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">AI chat: create several products fast</h3>
          </div>
          <p className="text-xs text-slate-500">Describe your products in plain text — AI will draft them for you to review before publishing.</p>

          <div className="relative">
            <textarea
              rows={2}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="e.g. Leather jacket, RM 500, 10 in stock; Baseball cap, RM 50, 30 in stock"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white resize-none pb-10"
            />
            <div className="absolute bottom-2.5 left-3 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              <span className="border border-slate-300 dark:border-slate-700 px-1 rounded">Enter</span> to generate · <span className="border border-slate-300 dark:border-slate-700 px-1 rounded">Shift + Enter</span> new line
            </div>
            <button
              type="button"
              onClick={onOpenAiDrafts}
              className="absolute bottom-2.5 right-3 px-3 py-1 rounded-lg bg-[#3b82f6] hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Sparkles className="size-3" /> Generate Drafts
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 flex-wrap">
            <span>💡 Try one of these:</span>
            <button type="button" onClick={() => setAiText("3 summer dresses, RM 120 each")} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-[11px] cursor-pointer">
              + 3 summer dresses, RM 120 each
            </button>
            <button type="button" onClick={() => setAiText("Sports set bundle, RM 89")} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-[11px] cursor-pointer">
              + Sports set bundle
            </button>
            <button type="button" onClick={() => setAiText("Bulk cosmetics pack, RM 250")} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-[11px] cursor-pointer">
              + Bulk cosmetics
            </button>
          </div>
        </div>
      </ImpactNode>

      {/* Main Title & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
          <p className="text-xs text-slate-500">Manage your store products</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => showToast("info", "Mở quản lý danh mục Category")}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Tag className="size-3.5" /> Category
          </button>
          <ImpactNode targetId="products-crud-publish-guard" label="Add Product">
            <button
              type="button"
              onClick={onOpenAdd}
              className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" /> Add product
            </button>
          </ImpactNode>
        </div>
      </div>

      {/* Tabs Row (Screenshot 0) */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {[
          { id: "all", label: "All", count: products.length },
          { id: "active", label: "Active", count: products.filter(p => p.status).length },
          { id: "draft", label: "Draft", count: 0 },
          { id: "archived", label: "Archived", count: 0 },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`pb-3 flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === t.id
                ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>{t.label}</span>
            <span className="text-[11px] font-bold opacity-80">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <span>Sort : Latest</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <Filter className="size-3.5 text-slate-400" />
          <span>Filter</span>
        </button>
      </div>

      {/* Products Table (Screenshot 0) */}
      <ImpactNode targetId="products-list-search-filter" label="Products Table">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-4 w-12">IMAGE</th>
                <th className="p-4">NAME</th>
                <th className="p-4">PRICE (RM)</th>
                <th className="p-4">STOCK</th>
                <th className="p-4">WEIGHT</th>
                <th className="p-4">CREATED ↓</th>
                <th className="p-4">STATUS</th>
                <th className="p-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Package className="size-4" />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</div>
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">RM {p.price.toFixed(2)}</td>
                  <td className="p-4">
                    {p.stock > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {p.stock}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> 0
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500">{p.weight}</td>
                  <td className="p-4 text-slate-500">{p.created}</td>
                  <td className="p-4">
                    <div
                      onClick={() => {
                        setProducts((prev) => prev.map(item => item.id === p.id ? { ...item, status: !item.status } : item));
                        showToast("info", `Đã ${!p.status ? "bật" : "tắt"} hiển thị sản phẩm ${p.name}`);
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors ${
                        p.status ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </div>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button type="button" onClick={() => showToast("info", `Sửa sản phẩm ${p.name}`)} className="p-1 text-slate-400 hover:text-cyan-500 cursor-pointer">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProducts((prev) => prev.filter(item => item.id !== p.id));
                        showToast("info", `Đã xóa sản phẩm ${p.name}`);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Add Product Page (Screenshot 2)
// ═════════════════════════════════════════════════════════════════════════════

function AddProductScreenStaging({
  onBack,
  onSave,
  ImpactNode,
  openInspector,
  showToast,
}: {
  onBack: () => void;
  onSave: (p: any) => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [hasVariants, setHasVariants] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = fd.get("name") as string;
        const price = parseFloat(fd.get("price") as string) || 0;
        const sku = (fd.get("sku") as string) || "SKU-001";
        const stock = parseInt(fd.get("stock") as string) || 0;
        onSave({ id: `p-${Date.now()}`, name, sku, price, stock, weight: "0.4 kg", created: "Today", status: true });
      }}
      className="max-w-7xl mx-auto space-y-6 text-xs"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Add product</h1>
          <p className="text-slate-500 text-[11px]">Fill in the full product details</p>
        </div>
      </div>

      {/* General Information Card (Screenshot 2) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">General information</h3>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Product name *</label>
          <input required name="name" placeholder="Enter product name" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs" />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Category *</label>
          <select name="category" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-500">
            <option>Select categories...</option>
            <option>Food</option>
            <option>Drinks</option>
            <option>Dessert</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Images (up to 5, each under 5MB)</label>
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 gap-1 cursor-pointer hover:border-cyan-500">
            <Upload className="size-5" />
            <span className="text-[10px]">Upload</span>
          </div>
        </div>
      </div>

      {/* Variants & Inventory Card (Screenshot 2) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Variants & inventory</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Price (RM) *</label>
            <input required type="number" step="0.5" name="price" defaultValue="0" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs" />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Compare-at price (RM)</label>
            <input type="number" step="0.5" defaultValue="0" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">SKU code *</label>
            <input required name="sku" defaultValue="SKU-001" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono" />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Inventory *</label>
            <input required type="number" name="stock" defaultValue="0" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-300">This product has multiple options or variants</span>
          <div
            onClick={() => setHasVariants(!hasVariants)}
            className={`w-9 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors ${
              hasVariants ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
          Cancel
        </button>
        <button type="submit" className="px-6 py-2.5 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold shadow cursor-pointer">
          Save Product
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Discounts List (Screenshot 3)
// ═════════════════════════════════════════════════════════════════════════════

function DiscountsScreenStaging({
  discounts,
  setDiscounts,
  onOpenAdd,
  ImpactNode,
  openInspector,
  showToast,
}: {
  discounts: any[];
  setDiscounts: React.Dispatch<React.SetStateAction<any[]>>;
  onOpenAdd: () => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"codes" | "history">("codes");
  const [search, setSearch] = useState("");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Title & Action Bar (Screenshot 3) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Discount codes</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Create and manage promo codes for this store. Customers apply one code at checkout, and usage is tracked against each code&apos;s limit. Deleting a code keeps its usage history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => showToast("success", "Đã xuất file CSV danh sách mã giảm giá!")}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
          <ImpactNode targetId="discount-rules-coupons" label="Create Discount">
            <button
              type="button"
              onClick={onOpenAdd}
              className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" /> Create discount
            </button>
          </ImpactNode>
        </div>
      </div>

      {/* Tabs (Screenshot 3) */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("codes")}
          className={`pb-3 flex items-center gap-2 cursor-pointer ${
            tab === "codes" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <Percent className="size-3.5" />
          <span>Discount codes</span>
          <span className="bg-cyan-500/15 text-[#06b6d4] text-[10px] px-1.5 py-0.2 rounded-full font-bold">999+</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`pb-3 flex items-center gap-2 cursor-pointer ${
            tab === "history" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <Clock className="size-3.5" />
          <span>Usage history</span>
          <span className="text-slate-400 text-[10px]">0</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or description..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <Clock className="size-3.5 text-slate-400" />
          <span>Status : All</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <Tag className="size-3.5 text-slate-400" />
          <span>Type : All</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </div>

      {/* Discounts Table (Screenshot 3) */}
      <ImpactNode targetId="discount-rules-coupons" label="Discounts Table">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-4">CODE ⇅</th>
                <th className="p-4">TYPE ⇅</th>
                <th className="p-4">VALUE ⇅</th>
                <th className="p-4">USAGE ⇅</th>
                <th className="p-4">EXPIRES ⇅</th>
                <th className="p-4">STATUS ⇅</th>
                <th className="p-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{d.code}</td>
                  <td className="p-4">
                    <span className="bg-cyan-50 dark:bg-cyan-950/60 text-[#06b6d4] font-bold px-2.5 py-0.5 rounded-md text-[11px]">
                      {d.type}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{d.value}</td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="text-slate-900 dark:text-white font-semibold">0 / ∞ <span className="text-[#06b6d4]">Unlimited</span></div>
                      <div className="w-36 bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden" />
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{d.expires}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {d.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button type="button" onClick={() => showToast("info", `Sửa mã ${d.code}`)} className="p-1 text-slate-400 hover:text-cyan-500 cursor-pointer">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscounts((prev) => prev.filter(item => item.id !== d.id));
                        showToast("info", `Đã xóa mã ${d.code}`);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Footer (Screenshot 3) */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>Showing <b className="text-slate-900 dark:text-white">1–10</b> of <b className="text-slate-900 dark:text-white">1245</b> codes</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-xs">
                  <option>10</option>
                  <option>25</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800">&lt;</button>
                <button type="button" className="px-2.5 py-1 rounded bg-[#06b6d4] text-white font-bold">1</button>
                <button type="button" className="px-2.5 py-1 rounded hover:bg-slate-100">2</button>
                <button type="button" className="px-2.5 py-1 rounded hover:bg-slate-100">3</button>
                <span>...</span>
                <button type="button" className="px-2 py-1 rounded hover:bg-slate-100">125</button>
                <button type="button" className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Create Discount (Screenshot 4)
// ═════════════════════════════════════════════════════════════════════════════

function CreateDiscountScreenStaging({
  onBack,
  onSave,
  ImpactNode,
  openInspector,
  showToast,
}: {
  onBack: () => void;
  onSave: (d: any) => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [code, setCode] = useState("SUMMER50");
  const [type, setType] = useState<"% Percentage" | "Fixed amount">("% Percentage");
  const [value, setValue] = useState("50");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: `d-${Date.now()}`,
          code: code.toUpperCase(),
          type,
          value: type === "% Percentage" ? `${value}%` : `RM ${value}`,
          usage: "0 / ∞ Unlimited",
          expires: "—",
          status: "Active",
        });
      }}
      className="max-w-7xl mx-auto space-y-6 text-xs"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create discount</h1>
          <p className="text-slate-500 text-[11px]">New code · aryhibye-01</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Form Card (Screenshot 4) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Code *</label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Unique per store · UPPERCASE · not case-sensitive at checkout.</span>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Status</label>
              <select className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs">
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Inactive codes won&apos;t work at checkout, and buyers won&apos;t see why.</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Description (optional · ≤ 500)</label>
            <textarea
              rows={3}
              placeholder="e.g. Summer campaign — sitewide"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Type *</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setType("% Percentage")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  type === "% Percentage" ? "bg-[#06b6d4] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Percent className="size-3.5" /> % Percentage
              </button>
              <button
                type="button"
                onClick={() => setType("Fixed amount")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  type === "Fixed amount" ? "bg-[#06b6d4] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Banknote className="size-3.5" /> Fixed amount
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Value *</label>
            <div className="flex items-center gap-2">
              <input
                required
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-32 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold"
              />
              <span className="text-slate-400">% 0–100</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Percent off the subtotal.</span>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Usage limit</label>
            <input placeholder="Leave blank for unlimited" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs" />
            <span className="text-[10px] text-slate-400 mt-1 block">Leave blank for unlimited uses.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Starts at</label>
              <input type="text" placeholder="mm/dd/yyyy" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs" />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Expires at</label>
              <input type="text" placeholder="mm/dd/yyyy" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs" />
            </div>
          </div>
        </div>

        {/* Right Live Preview Cards (Screenshot 4) */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LIVE PREVIEW</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded text-xs text-slate-900 dark:text-white">
                {code || "CODE"}
              </span>
              <span className="bg-cyan-50 dark:bg-cyan-950 text-[#06b6d4] font-bold px-2 py-0.5 rounded text-[11px]">
                {type}
              </span>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">USAGE</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">0 / ∞ <span className="text-[#06b6d4]">Unlimited</span></div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">ACTIVE DATES</div>
              <div className="text-xs text-slate-500">Always available</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-[#06b6d4]">
              <ShieldCheck className="size-4" />
              <span>YOUR STORE ONLY</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This code only works in aryhibye-01. The same code can be used by other stores without any clash. Discount applies to the subtotal only.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold text-xs shadow cursor-pointer"
          >
            Create Discount Code
          </button>
        </div>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: All Customers (Screenshot 5)
// ═════════════════════════════════════════════════════════════════════════════

function CustomersScreenStaging({
  customers,
  onSelectCustomer,
  ImpactNode,
  openInspector,
  showToast,
}: {
  customers: any[];
  onSelectCustomer: (id: string) => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [search, setSearch] = useState("");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Title & Action Bar (Screenshot 5) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">All customers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Buyer records for this store. Customers are added automatically from new orders. You can edit their details, manage addresses, and see linked orders here.
          </p>
        </div>

        <button
          type="button"
          onClick={() => showToast("success", "Đã xuất file CSV khách hàng!")}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name or phone..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <Tag className="size-3.5 text-slate-400" />
          <span>Rank: All ranks</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <Clock className="size-3.5 text-slate-400" />
          <span>Created: Any time</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </div>

      {/* Table (Screenshot 5) */}
      <ImpactNode targetId="shop-customers-directory" label="Customers CRM">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-4">EMAIL ⇅</th>
                <th className="p-4">NAME ⇅</th>
                <th className="p-4">RANK ⇅</th>
                <th className="p-4">PHONE ⇅</th>
                <th className="p-4">ORDERS ⇅</th>
                <th className="p-4">LAST ORDER ⇅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelectCustomer(c.id)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${c.color} text-white font-bold flex items-center justify-center text-xs shrink-0`}>
                        {c.initials}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{c.email}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{c.name}</td>
                  <td className="p-4">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                      {c.rank}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-600 dark:text-slate-300">{c.phone}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{c.orders}</td>
                  <td className="p-4 text-slate-400">{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>Showing <b className="text-slate-900 dark:text-white">1–10</b> of <b className="text-slate-900 dark:text-white">48</b> customers</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-xs">
                  <option>10</option>
                  <option>25</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800">&lt;</button>
                <button type="button" className="px-2.5 py-1 rounded bg-[#06b6d4] text-white font-bold">1</button>
                <button type="button" className="px-2.5 py-1 rounded hover:bg-slate-100">2</button>
                <button type="button" className="px-2.5 py-1 rounded hover:bg-slate-100">3</button>
                <span>...</span>
                <button type="button" className="px-2 py-1 rounded hover:bg-slate-100">5</button>
                <button type="button" className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Customer Detail (Screenshot 6)
// ═════════════════════════════════════════════════════════════════════════════

function CustomerDetailScreenStaging({
  customer,
  onBack,
  ImpactNode,
  openInspector,
  showToast,
}: {
  customer: any;
  onBack: () => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"details" | "orders">("details");

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-amber-800 text-white font-bold flex items-center justify-center text-sm">
          {customer.initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{customer.name}</span>
          </h1>
          <p className="text-slate-500 text-[11px] font-mono">
            {customer.email} · ID <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{customer.id}</span> · Updated 27d ago
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("details")}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
            tab === "details" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <Users className="size-3.5" /> Details
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
            tab === "orders" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <ShoppingCart className="size-3.5" /> Orders <span className="text-[10px] text-slate-400">0</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Customer Info Form (Screenshot 6) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Email *</label>
              <input defaultValue={customer.email} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono" />
              <span className="text-[10px] text-slate-400 mt-1 block">Saved in lowercase with spaces removed. Used to match incoming orders.</span>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Name *</label>
              <input defaultValue={customer.name} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Phone</label>
              <input disabled defaultValue={customer.phone} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500" />
              <span className="text-[10px] text-slate-400 mt-1 block">Synced from the latest order. You can&apos;t edit this here.</span>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Rank</label>
              <select className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs">
                <option>Unranked</option>
                <option>VIP Gold</option>
                <option>VIP Silver</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Set manually for now. Automatic ranking by spend is coming in v2.</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Address</label>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              SA36-06 UNA Residensi - RESIDENSI PEEL, Lorong Peel, Maluri, Bukit Bintang, Kuala Lumpur, 55100, Malaysia
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Synced automatically from the order&apos;s shipping address. You can&apos;t edit it here.</span>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Notes (internal — your customer won&apos;t see this)</label>
            <textarea
              rows={3}
              placeholder="Anything the team should know — preferences, dietary needs, B2B details..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-400 block">Latest order ⓘ</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">23 Jul 2026, 04:50 pm</span>
            </div>
            <div>
              <span className="text-slate-400 block">Oldest order ⓘ</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">23 Jul 2026, 04:50 pm</span>
            </div>
            <div>
              <span className="text-slate-400 block">Last updated</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">23 Jul 2026, 04:50 pm</span>
            </div>
            <div>
              <span className="text-slate-400 block">Customer ID</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{customer.id}</span>
            </div>
          </div>
        </div>

        {/* Right Stats Card (Screenshot 6) */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL ORDERS</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">0</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL SPENDING</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">RM 0.00</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">COMPLETED RATE</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">0%</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FAILED RATE</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">0%</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#06b6d4]">
              <Info className="size-4" />
              <span>AUTO-LINK ON</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              New orders with this phone number attach to this customer automatically via the <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">autoLinkCustomer</code> hook.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Contact Leads Empty State (Screenshot 7)
// ═════════════════════════════════════════════════════════════════════════════

function ContactLeadsScreenStaging({
  ImpactNode,
  openInspector,
  showToast,
}: {
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contact leads</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track and manage customer inquiries submitted through your website forms.</p>
        </div>

        <button
          type="button"
          onClick={() => showToast("success", "Đã tải CSV liên hệ")}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <span>Status : All</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>

        <button type="button" className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
          <span>Source & site : All sourc...</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </div>

      {/* Empty State Box (Screenshot 7) */}
      <ImpactNode targetId="contact-form-delivery" label="Contact Leads">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 flex flex-col items-center justify-center text-center space-y-3 shadow-xs min-h-[380px]">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Users className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No customers yet. They&apos;ll show up here once someone fills in your contact form or signs up for your newsletter.</h3>
          <p className="text-xs text-slate-500 max-w-lg">
            When a visitor submits a contact or registration form on your website, their details will appear here — allowing you to track and manage potential leads.
          </p>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Payments Screen (Screenshot 8)
// ═════════════════════════════════════════════════════════════════════════════

function PaymentsScreenStaging({
  ImpactNode,
  openInspector,
  showToast,
}: {
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [stripeCardEnabled, setStripeCardEnabled] = useState(true);
  const [stripeFpxEnabled, setStripeFpxEnabled] = useState(true);
  const [codEnabled, setCodEnabled] = useState(true);

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-[#06b6d4] flex items-center justify-center">
          <CreditCard className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payment methods</h1>
          <p className="text-slate-500 text-xs">Choose how customers pay at checkout. Turn on the methods you accept.</p>
        </div>
      </div>

      <ImpactNode targetId="payment-methods-checkout" label="Payment Gateways">
        <div className="space-y-6">
          {/* Section 1: STRIPE PAYMENT METHODS (Screenshot 8) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" /> STRIPE PAYMENT METHODS
              </span>
              <span className="text-slate-400 font-normal">Powered by Stripe Checkout</span>
            </div>

            {/* Connected Stripe Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold text-[10px]">✓</span>
                <span className="font-bold text-slate-900 dark:text-white">Stripe account connected</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-600 dark:text-slate-400">acct_1PWG25IppSQg2SFv</span>
                <span className="text-slate-400">partner@primecommerce.asia</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => showToast("info", "Mở dashboard Stripe")} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                  <ExternalLink className="size-3.5" /> Manage in Stripe
                </button>
                <button type="button" onClick={() => showToast("info", "Đã gửi yêu cầu ngắt kết nối")} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                  <RotateCcw className="size-3.5" /> Disconnect
                </button>
              </div>
            </div>

            {/* Credit / Debit Card Item */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Credit / debit card</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Take Visa, Mastercard and American Express through Stripe Checkout. Money goes straight to your linked Stripe account.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full text-[10px]">✓ Active</span>
                    <span className="text-slate-400 text-[11px]">MYR · International cards accepted</span>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setStripeCardEnabled(!stripeCardEnabled)}
                className={`w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors shrink-0 ${
                  stripeCardEnabled ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>

            {/* FPX Online Banking Item */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <Landmark className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">FPX online banking</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Let buyers pay straight from their Malaysian bank account. MYR only, with 15+ local banks supported.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full text-[10px]">✓ Active</span>
                    <span className="text-slate-400 text-[11px]">15 banks supported</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {["Maybank2u", "CIMB Clicks", "Public Bank", "RHB", "Hong Leong", "AmBank", "Bank Islam", "OCBC", "HSBC", "Standard Chartered", "+5 more"].map(b => (
                      <span key={b} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-medium">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div
                onClick={() => setStripeFpxEnabled(!stripeFpxEnabled)}
                className={`w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors shrink-0 ${
                  stripeFpxEnabled ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          </div>

          {/* Section 2: XENDIT PAYMENT METHODS (Screenshot 8) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" /> XENDIT PAYMENT METHODS
              </span>
              <span className="text-slate-400 font-normal">Powered by Xendit Checkout</span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold text-[10px]">✓</span>
                <span className="font-bold text-slate-900 dark:text-white">Xendit account connected</span>
                <span className="text-slate-400">API key connected · Payments active</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => showToast("info", "Mở dashboard Xendit")} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                  <ExternalLink className="size-3.5" /> Manage in Xendit
                </button>
                <button type="button" onClick={() => showToast("info", "Đã gửi yêu cầu ngắt kết nối")} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                  <RotateCcw className="size-3.5" /> Disconnect
                </button>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">SUPPORTED PAYMENT METHODS</span>
              <div className="flex flex-wrap gap-2">
                {["TNG eWallet", "GrabPay", "ShopeePay", "DuitNow QR", "FPX", "Credit / Debit Card"].map(m => (
                  <span key={m} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-semibold">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: MANUAL METHODS (Screenshot 8) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" /> MANUAL METHODS
              </span>
              <span className="text-slate-400 font-normal">You confirm the payment yourself after the order comes in</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                  <Banknote className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Cash on delivery (COD)</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    The buyer pays cash when the courier delivers. Confirm you received the payment in the order before it&apos;s marked paid.
                  </p>
                </div>
              </div>
              <div
                onClick={() => setCodEnabled(!codEnabled)}
                className={`w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors shrink-0 ${
                  codEnabled ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Shipping Screen (Screenshot 9)
// ═════════════════════════════════════════════════════════════════════════════

function ShippingScreenStaging({
  ImpactNode,
  openInspector,
  showToast,
}: {
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"flat" | "easyparcel">("easyparcel");
  const [epEnabled, setEpEnabled] = useState(true);

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shipping</h1>
        <p className="text-slate-500 text-xs mt-0.5">Set up flat-rate shipping for Malaysian buyers. Free shipping starts once the buyer&apos;s subtotal reaches your threshold.</p>
      </div>

      {/* Tabs (Screenshot 9) */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("flat")}
          className={`pb-3 flex items-center gap-2 cursor-pointer ${
            tab === "flat" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <Calculator className="size-3.5" />
          <span>Flat Rate</span>
          <span className="bg-amber-500/15 text-amber-500 text-[10px] px-1.5 py-0.2 rounded-full font-bold">FALLBACK</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("easyparcel")}
          className={`pb-3 flex items-center gap-2 cursor-pointer ${
            tab === "easyparcel" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <Truck className="size-3.5" />
          <span>EasyParcel</span>
          <span className="bg-emerald-500/15 text-emerald-500 text-[10px] px-1.5 py-0.2 rounded-full font-bold">● Connected</span>
        </button>
      </div>

      <ImpactNode targetId="shipping-zones-matrix" label="Shipping EasyParcel">
        <div className="space-y-6">
          {/* Connect EasyParcel Card (Screenshot 9) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Package className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Connect EasyParcel</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Each store uses its own EasyParcel account. Charges are deducted directly from your wallet with no platform markup.</p>
                </div>
              </div>
              <div
                onClick={() => setEpEnabled(!epEnabled)}
                className={`w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors shrink-0 ${
                  epEnabled ? "bg-[#06b6d4] justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>

            {/* Connected Account Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                <Lock className="size-3.5 text-slate-400" />
                <span>Prime Commerce</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => showToast("success", "Đã đồng bộ số dư từ EasyParcel!")} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1 cursor-pointer">
                  <RotateCcw className="size-3" /> Sync from EasyParcel
                </button>
                <button type="button" onClick={() => showToast("info", "Đã gửi yêu cầu ngắt kết nối EasyParcel")} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 font-semibold flex items-center gap-1 cursor-pointer">
                  <RotateCcw className="size-3" /> Disconnect
                </button>
              </div>
            </div>

            {/* Wallet Balance Banner (Screenshot 9) */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between text-amber-900 dark:text-amber-200 font-bold">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-amber-500" />
                <span>Wallet balance: MYR 22.38</span>
              </div>
              <a href="#topup" onClick={(e) => { e.preventDefault(); showToast("info", "Mở trang nạp tiền EasyParcel"); }} className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                Top up <ExternalLink className="size-3" />
              </a>
            </div>

            {/* Pickup Addresses Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Pickup addresses · <span className="text-slate-400 font-normal">origin</span></h4>
                  <p className="text-[11px] text-slate-500">Saved warehouse and pickup locations used to calculate charges and arrange courier collection.</p>
                </div>
                <button type="button" onClick={() => showToast("info", "Mở thêm địa chỉ kho")} className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-500 flex items-center gap-1 cursor-pointer">
                  <Plus className="size-3.5" /> Add address
                </button>
              </div>

              {/* Warehouse Card (Screenshot 9) */}
              <div className="p-4 bg-cyan-50/40 dark:bg-cyan-950/20 border-2 border-[#06b6d4] rounded-2xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-md bg-[#06b6d4] text-slate-950 flex items-center justify-center font-bold text-xs mt-0.5">
                    ✓
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>ECH warehouse</span>
                      <span className="text-[10px] text-[#06b6d4] font-bold">☆ Default</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">VO6-06-08, Signature 2 Office VO6, Jalan Shelley Sunway Velocity, Bukit Bintang, 55100, Kuala Lumpur</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => showToast("info", "Sửa địa chỉ kho")} className="p-1 text-slate-400 hover:text-cyan-500 cursor-pointer">
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => showToast("info", "Không thể xóa kho mặc định")} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Domains Management (Screenshot 12)
// ═════════════════════════════════════════════════════════════════════════════

function DomainsScreenStaging({
  primaryDomain,
  onOpenAddDomain,
  onOpenSelectPrimary,
  ImpactNode,
  openInspector,
  showToast,
}: {
  primaryDomain: string;
  onOpenAddDomain: () => void;
  onOpenSelectPrimary: () => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [domainPrefix, setDomainPrefix] = useState("chin-muoi");

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-[#06b6d4] flex items-center justify-center">
          <Globe className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Domain management</h1>
          <p className="text-slate-500 text-xs">Manage custom domains for your web store</p>
        </div>
      </div>

      <ImpactNode targetId="custom-domain-dns-guard" label="Domain Management">
        <div className="space-y-6">
          {/* Add a domain to your store Card (Screenshot 12) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Add a domain to your store</h3>
              <p className="text-slate-500 text-xs mt-0.5">Connect your own domain so people can reach your store</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenSelectPrimary}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Select primary domain
              </button>
              <button
                type="button"
                onClick={onOpenAddDomain}
                className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold text-xs shadow cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> Add custom domain
              </button>
            </div>
          </div>

          {/* Subdomain Editor Card (Screenshot 12) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center bg-slate-50 dark:bg-slate-950 font-mono text-xs">
                  <input
                    type="text"
                    value={domainPrefix}
                    onChange={(e) => setDomainPrefix(e.target.value)}
                    className="bg-transparent border-none text-slate-900 dark:text-white font-bold focus:outline-none w-28"
                  />
                  <span className="text-slate-400">.web-v2.dev.ecommercehub.my</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDomainPrefix("chin-muoi")}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => showToast("success", `✓ Đã lưu tên miền ${domainPrefix}.web-v2.dev.ecommercehub.my`)}
                  className="px-4 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold cursor-pointer shadow"
                >
                  Save changes
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Connected</span>
            </div>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Email Templates List (Screenshot 13)
// ═════════════════════════════════════════════════════════════════════════════

function EmailTemplatesScreenStaging({
  onSelectTemplate,
  ImpactNode,
  openInspector,
  showToast,
}: {
  onSelectTemplate: (id: string) => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"buyer" | "seller">("buyer");

  const templates = [
    { id: "order-confirmation", title: "Order Confirmation", desc: "Sent the moment checkout succeeds — receipt, items, and shipping details.", enabled: true, edited: "Never", icon: Mail },
    { id: "order-delivered", title: "Order Delivered", desc: "Confirms delivery once the order has arrived.", enabled: true, edited: "Never", icon: CheckCircle2 },
    { id: "order-cancelled", title: "Order Cancelled", desc: "Tells the buyer their order has been cancelled.", enabled: true, edited: "Never", icon: Package },
    { id: "order-expired", title: "Order Expired", desc: "Tells the buyer their unpaid order has expired.", enabled: true, edited: "Never", icon: Clock },
    { id: "order-refunded", title: "Order Refunded", desc: "Tells the buyer their order has been refunded.", enabled: true, edited: "Never", icon: RotateCcw },
    { id: "payment-reminder", title: "Payment Reminder (Bank Transfer)", desc: "Reminds the buyer to finish their bank transfer — the order is cancelled automatically after 24 hours.", enabled: true, edited: "Never", icon: Clock },
    { id: "payment-confirmed", title: "Payment Confirmed", desc: "Confirms payment was received and the order is being processed.", enabled: true, edited: "Never", icon: CheckCircle2 },
    { id: "payment-rejected", title: "Payment Rejected", desc: "Tells the buyer their payment was rejected.", enabled: true, edited: "Never", icon: XCircle },
    { id: "order-waiting", title: "Order Waiting", desc: "Reminds the buyer to finish paying when an order is placed but checkout isn't complete.", enabled: true, edited: "Never", icon: Clock },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email templates</h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Customize the order and account emails your store sends to buyers and to you. Changes apply to your store only — defaults stay safe and you can revert anytime.
        </p>
      </div>

      {/* Tabs Row (Screenshot 13) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setTab("buyer")}
            className={`pb-3 flex items-center gap-2 cursor-pointer ${
              tab === "buyer" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
            }`}
          >
            <Users className="size-3.5" />
            <span>Buyer emails</span>
            <span className="bg-cyan-500/15 text-[#06b6d4] text-[10px] px-1.5 py-0.2 rounded-full font-bold">9</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("seller")}
            className={`pb-3 flex items-center gap-2 cursor-pointer ${
              tab === "seller" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
            }`}
          >
            <Building className="size-3.5" />
            <span>Seller emails</span>
            <span className="text-slate-400 text-[10px]">3</span>
          </button>
        </div>
        <span className="text-slate-400 text-[11px] pb-3">0 of 9 customised</span>
      </div>

      <ImpactNode targetId="notifications-read-stream" label="Email Templates Table">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-4">TEMPLATE</th>
                <th className="p-4">STATUS</th>
                <th className="p-4">LAST EDITED</th>
                <th className="p-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {templates.map((t) => {
                const Icon = t.icon;
                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTemplate(t.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-[#06b6d4] flex items-center justify-center shrink-0">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{t.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-4.5 rounded-full bg-[#06b6d4] p-0.5 flex items-center justify-end">
                          <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
                        </div>
                        <span className="text-emerald-600 font-bold text-[11px]">● Enabled</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">{t.edited}</td>
                    <td className="p-4 text-right">
                      <button type="button" className="p-1 text-slate-400 hover:text-cyan-500 cursor-pointer">
                        <Pencil className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-2">
            <Info className="size-4 text-slate-400 shrink-0" />
            <span>
              <b>Changes apply to your store only.</b> Turning off a template stops it sending from your store only — global defaults still serve other stores. You can reset any template to default anytime from the edit view.
            </span>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Email Template Edit View (Screenshot 14)
// ═════════════════════════════════════════════════════════════════════════════

function EmailTemplateEditScreenStaging({
  templateId,
  onBack,
  ImpactNode,
  openInspector,
  showToast,
}: {
  templateId: string;
  onBack: () => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [subject, setSubject] = useState("{brandName} - Your order has been placed - {orderNumber}");
  const [greeting, setGreeting] = useState("Hi {customerName}");
  const [cta, setCta] = useState("Track order");
  const [closing, setClosing] = useState("Best regards,");

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#06b6d4] text-white flex items-center justify-center shadow-md">
            <Mail className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Order Confirmation</h1>
            <p className="text-slate-500 text-[11px] font-mono">Buyer-facing · Never · <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">tpl_order-confirmation</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => showToast("success", "Đã gửi email test mẫu!")} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer">
            <Send className="size-3.5" /> Send test
          </button>
          <button type="button" onClick={() => showToast("info", "Mở xem trước tab mới")} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer">
            <ExternalLink className="size-3.5" /> Open in new tab
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Form (Screenshot 14) */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white">Sending status</h4>
              <p className="text-slate-400 text-[11px]">Live — this email is sent to buyers.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-5 rounded-full bg-[#06b6d4] p-0.5 flex items-center justify-end">
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </div>
              <span className="font-bold text-emerald-600 text-xs">Enabled</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">Content language</span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded bg-[#06b6d4] text-white">🇬🇧 EN</span>
                <span className="px-2 py-0.5 text-slate-500">🇲🇾 MS</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-700 dark:text-slate-300">
                <span>Subject</span>
                <span className="text-slate-400 text-[10px]">56/200</span>
              </div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono" />
              <span className="text-[10px] text-slate-400 mt-1 block">Shown in the inbox preview. Keep it under 60 characters for mobile.</span>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-700 dark:text-slate-300">
                <span>Greeting *</span>
                <span className="text-slate-400 text-[10px]">17/500</span>
              </div>
              <textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs" />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setGreeting(greeting + " {customerName}")} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-cyan-600">+{'{customerName}'}</button>
                <button type="button" onClick={() => setGreeting(greeting + " {brandName}")} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-cyan-600">+{'{brandName}'}</button>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-700 dark:text-slate-300">
                <span>CTA label</span>
                <span className="text-slate-400 text-[10px]">11/100</span>
              </div>
              <input value={cta} onChange={(e) => setCta(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs" />
              <span className="text-[10px] text-slate-400 mt-1 block">Button text. Use a strong verb — &ldquo;Track order&rdquo;, &ldquo;Confirm&rdquo;, &ldquo;Open inbox&rdquo;.</span>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-700 dark:text-slate-300">
                <span>Closing</span>
                <span className="text-slate-400 text-[10px]">13/2000</span>
              </div>
              <textarea rows={2} value={closing} onChange={(e) => setClosing(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs" />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setClosing(closing + " {brandName}")} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-cyan-600">+{'{brandName}'}</button>
                <button type="button" onClick={() => setClosing(closing + " {supportEmail}")} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-cyan-600">+{'{supportEmail}'}</button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[11px]">All changes saved</span>
              <button
                type="button"
                onClick={() => showToast("success", "✓ Đã lưu mẫu email thành công!")}
                className="px-5 py-2 rounded-xl bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold cursor-pointer shadow"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>

        {/* Right Live Preview (Screenshot 14) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> LIVE PREVIEW
            </span>
            <div className="flex items-center gap-2 text-slate-400">
              <Monitor className="size-4 text-[#06b6d4]" />
              <Smartphone className="size-4" />
              <RotateCcw className="size-4" />
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <Mail className="size-3.5 inline mr-1 text-[#06b6d4]" /> <b>SUBJECT:</b> Aurora Batik - Your order has been placed - DEMO-001
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 shadow-md text-slate-800 dark:text-slate-100">
            <div className="text-center font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Aurora Batik</div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm">Hi John Doe,</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Thanks for your order. Here&apos;s a summary of what&apos;s on its way.
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="font-bold text-xs">Recipient information</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div>Full name: <span className="font-semibold text-slate-800 dark:text-slate-200">John Doe</span></div>
                <div>Address: <span className="font-semibold text-slate-800 dark:text-slate-200">—</span></div>
                <div>Phone: <span className="font-semibold text-slate-800 dark:text-slate-200">—</span></div>
                <div>Email: <span className="font-semibold text-slate-800 dark:text-slate-200">john.doe@example.com</span></div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="font-bold text-xs">Order information — ID: DEMO-001</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div>Order status: <span className="text-emerald-500 font-bold">Order placed</span></div>
                <div>Order date: <span className="font-semibold text-slate-800 dark:text-slate-200">Tuesday, 26 May 2026 at 10:00</span></div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button type="button" className="px-6 py-2.5 rounded-xl bg-[#06b6d4] text-white font-bold text-xs shadow-md">
                {cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Team & Account (Screenshot 15)
// ═════════════════════════════════════════════════════════════════════════════

function TeamAccountScreenStaging({
  ImpactNode,
  openInspector,
  showToast,
}: {
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  const [tab, setTab] = useState<"profile" | "staff">("profile");

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team & account</h1>
        <p className="text-slate-500 text-xs mt-0.5">Manage your personal profile and your team members.</p>
      </div>

      {/* Tabs (Screenshot 15) */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("profile")}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
            tab === "profile" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <Users className="size-3.5" /> Account profile
        </button>
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
            tab === "staff" ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
          }`}
        >
          <UsersRound className="size-3.5" /> Staff
        </button>
      </div>

      <ImpactNode targetId="identity-login-otp" label="Team Staff Management">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Account Card (Screenshot 15) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="flex items-center gap-4">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow-md"
                />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>LT 1783499647901 hibye-01</span>
                    <span className="bg-cyan-500/15 text-[#06b6d4] font-bold px-2 py-0.5 rounded text-[10px]">OWNER</span>
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">EMAIL ADDRESS</label>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">aryhibye-01@yopmail.com</div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PHONE NUMBER</label>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">0914391809102053</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PASSWORD</label>
                <div className="font-mono text-slate-400 text-sm tracking-widest">••••••••••••</div>
              </div>
            </div>

            {/* Right SSO Protected Account Card (Screenshot 15) */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
                <Lock className="size-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">SSO Protected Account</h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                Your personal profile fields, password, and security configurations are managed centrally by the Single Sign-On system. Changes made there will sync here automatically.
              </p>
              <button
                type="button"
                onClick={() => showToast("info", "Chuyển tới cổng SSO")}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                Go to SSO Portal <ExternalLink className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Danger Zone (Screenshot 15) */}
          <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-red-600 text-sm">Danger zone</h4>
              <span className="text-[11px] text-slate-400">Staging only — hidden in production</span>
            </div>
            <div className="space-y-1">
              <h5 className="font-bold text-slate-900 dark:text-white">Reset account</h5>
              <p className="text-slate-500 text-xs">
                This deletes ALL your data — tenants, sites, products, orders, media, templates, and analytics — and you&apos;ll start onboarding again. Your email and password stay the same.
              </p>
              <span className="text-red-500 font-bold block text-xs">This can&apos;t be undone.</span>
            </div>
            <button
              type="button"
              onClick={() => showToast("error", "Đã khóa tính năng reset trên Sandbox review")}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow cursor-pointer"
            >
              Reset account
            </button>
          </div>
        </div>
      </ImpactNode>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: Help Center (Screenshot 16, 17, 18)
// ═════════════════════════════════════════════════════════════════════════════

function HelpCenterScreenStaging({
  activeTab,
  setActiveTab,
  guideSubTab,
  setGuideSubTab,
  ImpactNode,
  openInspector,
  showToast,
}: {
  activeTab: "overview" | "qna" | "guides";
  setActiveTab: (t: "overview" | "qna" | "guides") => void;
  guideSubTab: "dashboard" | "builder" | "blog" | "settings";
  setGuideSubTab: (t: "dashboard" | "builder" | "blog" | "settings") => void;
  ImpactNode: React.FC<{ targetId: string; children: React.ReactNode; className?: string; label?: string }>;
  openInspector: (id: string) => void;
  showToast: (t: "success" | "error" | "info", msg: string) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Help center</h1>
        <p className="text-slate-500 text-xs mt-0.5">Learn how to use your website management system.</p>
      </div>

      {/* Tabs (Screenshot 16, 17, 18) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
            activeTab === "overview" ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#06b6d4] font-bold shadow-xs" : "text-slate-500"
          }`}
        >
          <FileText className="size-3.5" /> Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("qna")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
            activeTab === "qna" ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#06b6d4] font-bold shadow-xs" : "text-slate-500"
          }`}
        >
          <QuestionIcon className="size-3.5" /> Q&A
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("guides")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
            activeTab === "guides" ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#06b6d4] font-bold shadow-xs" : "text-slate-500"
          }`}
        >
          <BookOpenIcon className="size-3.5" /> Module guides
        </button>
      </div>

      <ImpactNode targetId="builder-help-assistant" label="Help Assistant">
        {activeTab === "overview" ? (
          /* Overview Tab (Screenshot 16) */
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 shadow-xs">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Welcome to EchPrime!</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  EchPrime helps you build and manage your professional website — from creating sites with AI and writing SEO-optimized blog posts to tracking traffic and engagement. Here&apos;s an overview of the main features.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Key features</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: "Dashboard", desc: "See real-time website traffic, leads, and engagement at a glance.", icon: LayoutDashboard },
                    { title: "AI website builder", desc: "Build a professional website in just 5 minutes with AI.", icon: Bot },
                    { title: "Blog", desc: "Write SEO-friendly blog posts to bring in more customers.", icon: Pencil },
                    { title: "Settings", desc: "Set up your domain and invite admin staff.", icon: Settings },
                  ].map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <div key={i} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 hover:border-cyan-500 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between text-[#06b6d4]">
                          <Icon className="size-5" />
                          <ExternalLink className="size-3 text-slate-400" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">{f.title}</h4>
                        <p className="text-slate-500 text-[11px] leading-relaxed">{f.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Need more help?</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">Can&apos;t find the answer? Contact our support team on WhatsApp or by email.</p>
                </div>
                <a href="mailto:support@echprime.com" className="px-4 py-2 bg-[#06b6d4] hover:bg-cyan-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs">
                  <Mail className="size-3.5" /> support@echprime.com
                </a>
              </div>
            </div>
          </div>
        ) : activeTab === "qna" ? (
          /* Q&A Tab (Screenshot 17) */
          <div className="space-y-6">
            <div className="relative max-w-xl">
              <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search questions..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Accordions */}
            {[
              {
                category: "Dashboard",
                icon: LayoutDashboard,
                questions: [
                  "What metrics show up on the dashboard?",
                  "How do I customise the dashboard layout?",
                  "What is the SEO health widget?",
                ],
              },
              {
                category: "AI website builder",
                icon: Bot,
                questions: [
                  "How do I build a website with AI?",
                  "Can I edit the website AI builds for me?",
                  "Does the AI website work well on mobile?",
                ],
              },
              {
                category: "Blog",
                icon: Pencil,
                questions: [
                  "How do I create a new blog post?",
                  "How does the AI blog assistant work?",
                  "How do I optimise blog posts for SEO?",
                ],
              },
            ].map((sec) => {
              const Icon = sec.icon;
              return (
                <div key={sec.category} className="space-y-2">
                  <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Icon className="size-3.5 text-[#06b6d4]" /> {sec.category}
                  </h3>
                  <div className="space-y-2">
                    {sec.questions.map((q, idx) => (
                      <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 hover:border-cyan-500 cursor-pointer transition-colors">
                        <span>{q}</span>
                        <ChevronDown className="size-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Module Guides Tab (Screenshot 18) */
          <div className="space-y-6">
            <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "builder", label: "AI website builder", icon: Bot },
                { id: "blog", label: "Blog", icon: Pencil },
                { id: "settings", label: "Settings", icon: Settings },
              ].map(sub => {
                const Icon = sub.icon;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setGuideSubTab(sub.id as any)}
                    className={`pb-3 flex items-center gap-1.5 cursor-pointer ${
                      guideSubTab === sub.id ? "border-b-2 border-[#06b6d4] text-[#06b6d4] font-bold" : "text-slate-500"
                    }`}
                  >
                    <Icon className="size-3.5" /> {sub.label}
                  </button>
                );
              })}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#06b6d4] text-slate-950 font-bold flex items-center justify-center text-xs">1</span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Dashboard Overview</h3>
                </div>
                <p className="text-slate-500 text-xs">The dashboard displays key metrics: website traffic, leads, engagement, and SEO health score.</p>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative group">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000&auto=format&fit=crop&q=80"
                  alt="Dashboard Overview"
                  className="w-full h-72 object-cover"
                />
                <div className="p-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-slate-500 text-xs">
                  <span>Dashboard Overview</span>
                  <span className="text-[#06b6d4] flex items-center gap-1 font-semibold cursor-pointer"><Search className="size-3" /> Click to zoom</span>
                </div>
              </div>

              {/* Step by step guide */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BookOpenIcon className="size-4 text-[#06b6d4]" /> Step-by-step guide
                </h4>
                <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#06b6d4]">1.</span>
                    <span>Navigate to the <b>Dashboard</b> from the sidebar — this is your home screen after logging in.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#06b6d4]">2.</span>
                    <span>The <b>Overview tab</b> shows key metrics: total website views (Traffic), link clicks (Leads), and user engagement.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#06b6d4]">3.</span>
                    <span>Use the <b>Period Selector</b> (Today / 7 days / 30 days) at the top right to change the time range for analytics.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#06b6d4]">4.</span>
                    <span>Click <b>Customize</b> to drag-and-drop, show/hide metrics cards to personalize your dashboard layout.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#06b6d4]">5.</span>
                    <span>The <b>SEO Health Widget</b> displays your site&apos;s SEO score out of 100 with actionable warnings — click &ldquo;AI Fix Issues&rdquo; to auto-optimize.</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </ImpactNode>
    </div>
  );
}

function BookOpenIcon(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
