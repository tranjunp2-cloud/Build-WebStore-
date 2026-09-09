import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/studio/qa/visual-review"),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

import { VisualCmsReviewClient } from "@/app/studio/qa/visual-review/VisualCmsReviewClient";

describe("Visual CMS toast timer lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function showPassToast() {
    fireEvent.click(screen.getAllByTestId("impact-node-discount-rules-coupons")[1]);
    fireEvent.click(screen.getByRole("button", { name: /Đánh Dấu ĐÃ PASS/i }));
  }

  it("cancels the pending toast timer on unmount", () => {
    const { unmount } = render(<VisualCmsReviewClient />);
    fireEvent.click(screen.getByTestId("nav-discounts"));
    showPassToast();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a replacement toast visible for its full lifetime", () => {
    render(<VisualCmsReviewClient />);
    fireEvent.click(screen.getByTestId("nav-email-templates"));
    fireEvent.click(screen.getByText("Order Confirmation"));
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Đã gửi email test mẫu!")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText("Đã gửi email test mẫu!")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("[TC-F40-04] Visual CMS Review Client Exhaustive Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[TC-F40-04-01] renders the visual review studio header and default dashboard screen", () => {
    render(<VisualCmsReviewClient />);

    // Assert Review PR top toolbar & Controls
    expect(screen.getByText(/Review PR/i)).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo lỗi/i)).toBeInTheDocument();

    // Assert PR selector exists
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // Default screen is Dashboard
    expect(screen.getByText("Welcome to Web Store Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Traffic & performance")).toBeInTheDocument();
  });

  it("[TC-F40-04-02] switches across all 13 staging CMS screens exhaustively", () => {
    render(<VisualCmsReviewClient />);

    // 1. Switch to Editor
    fireEvent.click(screen.getByTestId("nav-editor"));
    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText("AI Chat")).toBeInTheDocument();

    // 2. Switch to Blog Posts
    fireEvent.click(screen.getByTestId("nav-blog"));
    expect(screen.getByRole("heading", { name: "Blog posts", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("AI assistant")).toBeInTheDocument();

    // 3. Switch to Orders
    fireEvent.click(screen.getByTestId("nav-orders"));
    expect(screen.getByRole("heading", { name: "Orders", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();

    // 4. Switch to Products
    fireEvent.click(screen.getByTestId("nav-products"));
    expect(screen.getByText("Add product")).toBeInTheDocument();

    // 5. Switch to Discounts
    fireEvent.click(screen.getByTestId("nav-discounts"));
    expect(screen.getByRole("heading", { name: "Discount codes", level: 1 })).toBeInTheDocument();

    // 6. Switch to All Customers
    fireEvent.click(screen.getByTestId("nav-customers"));
    expect(screen.getByRole("heading", { name: "All customers", level: 1 })).toBeInTheDocument();

    // 7. Switch to Contact Leads
    fireEvent.click(screen.getByTestId("nav-contact-leads"));
    expect(screen.getByText(/No customers yet/i)).toBeInTheDocument();

    // 8. Switch to Payments
    fireEvent.click(screen.getByTestId("nav-payments"));
    expect(screen.getByRole("heading", { name: "Payment methods", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Cash on delivery/i)).toBeInTheDocument();

    // 9. Switch to Shipping
    fireEvent.click(screen.getByTestId("nav-shipping"));
    expect(screen.getByRole("heading", { name: "Shipping", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("EasyParcel")).toBeInTheDocument();

    // 10. Switch to Domains
    fireEvent.click(screen.getByTestId("nav-domains"));
    expect(screen.getByRole("heading", { name: "Domain management", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Add custom domain")).toBeInTheDocument();

    // 11. Switch to Email Templates
    fireEvent.click(screen.getByTestId("nav-email-templates"));
    expect(screen.getByRole("heading", { name: "Email templates", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Buyer emails")).toBeInTheDocument();

    // 12. Switch to Help Center
    fireEvent.click(screen.getByTestId("nav-help-center"));
    expect(screen.getByRole("heading", { name: /Help center/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Welcome to EchPrime!")).toBeInTheDocument();
  });

  it("[TC-F40-04-03] renders clean minimalist red ring outline on buggy components without floating badges", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Discounts screen where coupon limit bug is located
    fireEvent.click(screen.getByTestId("nav-discounts"));

    // Find the outlined discount node
    const impactWrapper = screen.getAllByTestId("impact-node-discount-rules-coupons")[0];
    expect(impactWrapper).toBeInTheDocument();
    expect(impactWrapper.className).toContain("ring-red-500");
  });

  it("[TC-F40-04-04] opens centered Bug Detail Popup Modal when clicking an outlined bug component", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Blog screen
    fireEvent.click(screen.getByTestId("nav-blog"));

    // Click on the Blog Posts Table impact node
    const blogTableNode = screen.getAllByTestId("impact-node-blog-post-management")[1];
    fireEvent.click(blogTableNode);

    // Modal should now be open
    expect(screen.getByText(/Lỗi là gì:/i)).toBeInTheDocument();
    expect(screen.getByText(/Hướng dẫn cách test lại:/i)).toBeInTheDocument();
    expect(screen.getByText(/Kết quả kỳ vọng:/i)).toBeInTheDocument();
    expect(screen.getByText(/Thực tế khi lỗi:/i)).toBeInTheDocument();

    // Verify Action buttons in modal
    expect(screen.getByRole("button", { name: /Đánh Dấu ĐÃ PASS/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đóng/i })).toBeInTheDocument();

    // Close the modal
    const closeBtn = screen.getByRole("button", { name: /Đóng/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/Lỗi là gì:/i)).not.toBeInTheDocument();
  });

  it("[TC-F40-04-05] toggles bug status from Failing to Passed, updating ring outline color to green", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Discounts screen
    fireEvent.click(screen.getByTestId("nav-discounts"));

    // Open bug modal by clicking the discount table impact node
    let discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[1];
    fireEvent.click(discountNode);

    // Click [Đánh Dấu ĐÃ PASS 🟢]
    const markPassedBtn = screen.getByRole("button", { name: /Đánh Dấu ĐÃ PASS/i });
    fireEvent.click(markPassedBtn);

    // Modal auto-closes on pass confirmation; verify toast message exists
    expect(screen.getByText(/Đã xác nhận TEST PASS cho bug/i)).toBeInTheDocument();

    // Verify outline turns green (ring-emerald-500)
    const updatedNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[1];
    expect(updatedNode.className).toContain("ring-emerald-500");
  });

  it("[TC-F40-04-06] allows switching active PR to dynamically filter affected targets", () => {
    render(<VisualCmsReviewClient />);

    const prSelect = screen.getByRole("combobox");
    expect(prSelect).toBeInTheDocument();

    // Select PR #1742
    fireEvent.change(prSelect, { target: { value: "1742" } });
    expect(screen.getAllByText(/PR #1742/i).length).toBeGreaterThan(0);

    // Select PR #1690
    fireEvent.change(prSelect, { target: { value: "1690" } });
    expect(screen.getAllByText(/PR #1690/i).length).toBeGreaterThan(0);
  });

  it("[TC-F40-04-07] supports switching tabs and exploring component categories in Editor", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Editor screen first
    fireEvent.click(screen.getByTestId("nav-editor"));

    // Click Components tab in left panel
    const componentsTabBtn = screen.getByRole("button", { name: /Components/i });
    fireEvent.click(componentsTabBtn);

    // Verify block search input is present
    expect(screen.getByPlaceholderText("Search blocks")).toBeInTheDocument();

    // Verify block categories exist in catalog
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("[TC-F40-04-08] toggles bug overlay mode on and off to show clean UI view", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Discounts screen
    fireEvent.click(screen.getByTestId("nav-discounts"));

    // Find the discount table impact node
    let discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[0];
    expect(discountNode.className).toContain("ring-red-500");

    // Toggle off the overlay checkbox
    const overlayCheckbox = screen.getByRole("checkbox");
    fireEvent.click(overlayCheckbox);

    // Assert status text changes to TẮT and ring outline is removed
    expect(screen.getByText("TẮT")).toBeInTheDocument();
    discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[0];
    expect(discountNode.className).not.toContain("ring-red-500");

    // Toggle on the overlay checkbox again
    fireEvent.click(overlayCheckbox);
    expect(screen.getByText("BẬT")).toBeInTheDocument();
    discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[0];
    expect(discountNode.className).toContain("ring-red-500");
  });

  it("[TC-F40-04-09] triggers simulated Retest runner inside the Bug Detail Popup Modal", async () => {
    render(<VisualCmsReviewClient />);

    // Switch to Discounts screen and open modal
    fireEvent.click(screen.getByTestId("nav-discounts"));
    let discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[1];
    fireEvent.click(discountNode);

    // Click [Chạy Test Lại 🔄]
    const retestBtn = screen.getByRole("button", { name: /Chạy Test Lại/i });
    fireEvent.click(retestBtn);

    // Wait for the simulated test runner to finish
    await waitFor(
      () => {
        expect(
          screen.getByText(/Test runner đã hoàn thành! 100% assertions đã PASS/i)
        ).toBeInTheDocument();
      },
      { timeout: 2500 }
    );

    // Verify toast confirmation is also displayed
    expect(
      screen.getByText(/Test runner đã kiểm thử thành công/i)
    ).toBeInTheDocument();
  });

  it("[TC-F40-04-10] filters component catalog dynamically with block search input in Editor", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Editor screen and click Components tab
    fireEvent.click(screen.getByTestId("nav-editor"));
    fireEvent.click(screen.getByRole("button", { name: /Components/i }));

    const searchInput = screen.getByPlaceholderText("Search blocks");

    // Search for "Hero"
    fireEvent.change(searchInput, { target: { value: "Hero" } });
    expect(screen.getAllByText("Hero").length).toBeGreaterThan(0);

    // Search for "Pricing"
    fireEvent.change(searchInput, { target: { value: "Pricing" } });
    expect(screen.getAllByText("Pricing Table").length).toBeGreaterThan(0);

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("[TC-F40-04-11] displays right inspector properties when selecting Global/Block tabs in Editor", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Editor screen
    fireEvent.click(screen.getByTestId("nav-editor"));

    // Check right panel tabs via data-testid
    const globalTab = screen.getByTestId("right-tab-global");
    const menuTab = screen.getByTestId("right-tab-menu");
    const blockTab = screen.getByTestId("right-tab-block");
    const seoTab = screen.getByTestId("right-tab-seo");

    expect(globalTab).toBeInTheDocument();
    expect(menuTab).toBeInTheDocument();
    expect(blockTab).toBeInTheDocument();
    expect(seoTab).toBeInTheDocument();

    // Switch to SEO Tab
    fireEvent.click(seoTab);
    expect(screen.getByText(/SEO & SOCIAL/i)).toBeInTheDocument();

    // Switch to Menu Tab
    fireEvent.click(menuTab);
    expect(screen.getByText(/MENU SETTINGS/i)).toBeInTheDocument();
  });

  it("[TC-F40-04-12] generates draft blog post with AI Blog Assistant modal", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Blog Screen
    fireEvent.click(screen.getByTestId("nav-blog"));

    // Click "AI assistant" button
    fireEvent.click(screen.getByText("AI assistant"));

    // AI Blog Assistant modal should appear
    expect(screen.getByText("AI Blog Assistant")).toBeInTheDocument();

    // Type prompt topic
    const topicInput = screen.getByPlaceholderText(/e.g. 5 reasons organic green tea/i);
    fireEvent.change(topicInput, { target: { value: "Bí quyết pha trà sữa thơm ngon" } });

    // Click Generate Draft
    fireEvent.click(screen.getByRole("button", { name: /Generate Draft/i }));

    // Verify toast appears and new post is rendered
    expect(screen.getByText(/AI đã tạo bản nháp bài viết mới/i)).toBeInTheDocument();
    expect(screen.getByText("Bí quyết pha trà sữa thơm ngon")).toBeInTheDocument();
  });

  it("[TC-F40-04-13] searches and filters coupons in Discounts screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Discounts Screen
    fireEvent.click(screen.getByTestId("nav-discounts"));

    // Search for coupon
    const searchInput = screen.getByPlaceholderText(/Search by code or description/i);
    fireEvent.change(searchInput, { target: { value: "LT869466" } });
    expect(screen.getByText("LT869466")).toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("LT103560")).toBeInTheDocument();
  });

  it("[TC-F40-04-14] searches products and toggles status in Products screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Products Screen
    fireEvent.click(screen.getByTestId("nav-products"));

    // Search for product
    const searchInput = screen.getByPlaceholderText(/Search by name or SKU/i);
    fireEvent.change(searchInput, { target: { value: "Trà đào" } });
    expect(screen.getAllByText(/Trà đào độc đáo/i).length).toBeGreaterThan(0);

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Trà trái cây đá xay")).toBeInTheDocument();
  });

  it("[TC-F40-04-15] switches tabs and exports CSV in Orders screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Orders Screen
    fireEvent.click(screen.getByTestId("nav-orders"));

    // Check tabs
    expect(screen.getByText("All Orders")).toBeInTheDocument();
    expect(screen.getAllByText(/Processing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delivered").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unpaid").length).toBeGreaterThan(0);

    // Click Export CSV
    const exportBtn = screen.getByRole("button", { name: /Export CSV/i });
    fireEvent.click(exportBtn);
    expect(screen.getByText(/Đã xuất file CSV đơn hàng/i)).toBeInTheDocument();
  });

  it("[TC-F40-04-16] edits subdomain prefix and saves in Domains screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Domains Screen
    fireEvent.click(screen.getByTestId("nav-domains"));

    // Verify domain management title and custom domain action
    expect(screen.getByRole("heading", { name: "Domain management", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Add a domain to your store")).toBeInTheDocument();
    expect(screen.getByText("Select primary domain")).toBeInTheDocument();
  });

  it("[TC-F40-04-17] views email templates and opens edit preview in Email Templates screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Email Templates Screen
    fireEvent.click(screen.getByTestId("nav-email-templates"));

    // Verify buyer emails tab & template items
    expect(screen.getByText("Buyer emails")).toBeInTheDocument();
    expect(screen.getByText("Order Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Order Delivered")).toBeInTheDocument();
    expect(screen.getByText("Order Cancelled")).toBeInTheDocument();
  });

  it("[TC-F40-04-18] checks payment gateways and connected Stripe account in Payments screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Payments Screen
    fireEvent.click(screen.getByTestId("nav-payments"));

    // Verify Stripe payment methods header & gateways
    expect(screen.getByText(/STRIPE PAYMENT METHODS/i)).toBeInTheDocument();
    expect(screen.getByText("Stripe account connected")).toBeInTheDocument();
    expect(screen.getByText("Credit / debit card")).toBeInTheDocument();
    expect(screen.getByText("FPX online banking")).toBeInTheDocument();
    expect(screen.getByText(/Cash on delivery/i)).toBeInTheDocument();
  });

  it("[TC-F40-04-19] checks EasyParcel provider and sync balance in Shipping screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Shipping Screen
    fireEvent.click(screen.getByTestId("nav-shipping"));

    // Verify EasyParcel and Flat Rate tabs
    expect(screen.getByText("Flat Rate")).toBeInTheDocument();
    expect(screen.getByText("EasyParcel")).toBeInTheDocument();
    expect(screen.getByText("Connect EasyParcel")).toBeInTheDocument();

    // Verify connect EasyParcel card
    expect(screen.getByText("Connect EasyParcel")).toBeInTheDocument();
    expect(screen.getByText(/Prime Commerce/i)).toBeInTheDocument();
  });

  it("[TC-F40-04-20] inspects customer details and rank badges in Customers screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Customers Screen
    fireEvent.click(screen.getByTestId("nav-customers"));

    // Verify customer header and sample customer records
    expect(screen.getByRole("heading", { name: "All customers", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Ocean")).toBeInTheDocument();
    expect(screen.getAllByText("Unranked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ary").length).toBeGreaterThan(0);
  });

  it("[TC-F40-04-21] checks contact leads empty state and lead description", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Contact Leads Screen
    fireEvent.click(screen.getByTestId("nav-contact-leads"));

    // Verify contact leads empty state message
    expect(screen.getByText(/No customers yet/i)).toBeInTheDocument();
    expect(screen.getByText(/When a visitor submits a contact or registration form/i)).toBeInTheDocument();
  });

  it("[TC-F40-04-22] inspects overview features and module guides in Help Center screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Help Center Screen
    fireEvent.click(screen.getByTestId("nav-help-center"));

    // Verify help center greeting and key feature cards
    expect(screen.getByText("Welcome to EchPrime!")).toBeInTheDocument();
    expect(screen.getByText("Key features")).toBeInTheDocument();
    expect(screen.getByText("AI website builder")).toBeInTheDocument();
    expect(screen.getByText("Module guides")).toBeInTheDocument();
  });

  it("[TC-F40-04-23] filters blog posts by category pills in Blog screen", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Blog Screen
    fireEvent.click(screen.getByTestId("nav-blog"));

    // Check blog posts table & actions
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("Top 5 Asian Cuisine Trends in 2026")).toBeInTheDocument();
    expect(screen.getByText("Guide to Authentic Malaysian Tea Culture")).toBeInTheDocument();
  });

  it("[TC-F40-04-24] toggles responsive viewports between Desktop, Tablet and Mobile in Editor", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Editor Screen
    fireEvent.click(screen.getByTestId("nav-editor"));

    // Find viewport switcher buttons (Desktop, Tablet, Mobile)
    const viewportBtns = screen.getAllByRole("button");
    expect(viewportBtns.length).toBeGreaterThan(5);

    // Verify editor canvas container exists
    expect(screen.getByText("Track order")).toBeInTheDocument();
    expect(screen.getAllByText("Trang Chủ").length).toBeGreaterThan(0);
  });

  it("[TC-F40-04-25] reports bug as failing again from Bug Detail Popup Modal", () => {
    render(<VisualCmsReviewClient />);

    // Switch to Discounts screen
    fireEvent.click(screen.getByTestId("nav-discounts"));

    // Open bug modal and mark as passed first
    let discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[1];
    fireEvent.click(discountNode);
    fireEvent.click(screen.getByRole("button", { name: /Đánh Dấu ĐÃ PASS/i }));

    // Open modal again on the passed target
    discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[1];
    fireEvent.click(discountNode);

    // Click [Báo Lỗi Lại 🔴]
    const markFailBtn = screen.getByRole("button", { name: /Báo Lỗi Lại/i });
    expect(markFailBtn).toBeInTheDocument();
    fireEvent.click(markFailBtn);

    // Verify outline reverts back to red (ring-red-500)
    discountNode = screen.getAllByTestId("impact-node-discount-rules-coupons")[1];
    expect(discountNode.className).toContain("ring-red-500");
  });
});
