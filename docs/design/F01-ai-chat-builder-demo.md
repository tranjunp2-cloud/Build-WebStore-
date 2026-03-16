# Phân tích & Demo UI Flow: F01 - AI Chat Builder

Dựa vào **PRD F01** và **Design Workflow** của PrimeWeb, dưới đây là phân tích chi tiết về UI/UX Flow và cấu trúc UI Components (sử dụng shadcn/ui) cho tính năng AI Chat Builder.

## 1. Phân tích UI Layout & 4 States Bắt Buộc

Theo chuẩn Desktop & Mobile-first, Grid chia làm 2 phần chính:
- **Left Panel (Chat):** Cố định 380px (Desktop) hoặc Full-width (Mobile). Nơi user tương tác với AI.
- **Right Panel (Preview):** Hiển thị kết quả website realtime. (Mobile sẽ ẩn đi và dùng nút Toggle).

### 🚦 4 Trạng thái (States) theo Design Rules

| State | Chat Panel (Left) | Preview Panel (Right) | Shadcn Components |
|-------|-------------------|-----------------------|-------------------|
| **Empty** (Chưa nhập gì) | Lời chào của AI + 3 Buttons Gợi ý (Ví dụ: "Shop thời trang"). Input sẵn sàng. | Trống hoặc hiển thị illustration "Hãy bắt đầu mô tả shop của bạn". | `Input`, `Button (variant="outline")`, `Card` |
| **Loading** (Đang tạo Web) | Input bị disable. Trạng thái "Đang phân tích...". Các bước tiến trình hiện ra dạng checklist/progress. | **Skeleton** nhấp nháy mô phỏng cấu trúc website (Navbar, Hero, Products). KHÔNG dùng spinner. | `Skeleton`, `Progress`, `Input (disabled=true)` |
| **Success** (Tạo xong) | Lời chúc mừng "Done! 🎉" + 2 CTA `[Tinh chỉnh →]` và `[Publish ngay]`. | Website hoàn chỉnh với dữ liệu thật (Màu sắc theo ngành hàng, Badge Halal nếu có). `Badge` "Draft". | `Button (Primary/Secondary)`, `Badge (variant="secondary")` |
| **Error** (Lỗi/Hết lượt) | Giữ nguyên câu prompt đã chat. Hiện **Toast đỏ**. Có nút `[Thử lại]` hoặc `[Nâng cấp]`. | Giữ trạng thái Empty hoặc Skeleton của bản nháp đang tạo dở. | `Toast (variant="destructive")`, `Button (destructive/outline)` |

---

## 2. Demo UI Components Flow (React / shadcn)

Dưới đây là Demo mô phỏng Layout và logic chuyển đổi 4 states của F01. Dev có thể bám sát sườn này để dựng UI.

```tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Eye, MessageSquare, Loader2 } from "lucide-react";

export default function F01AIChatBuilderDemo() {
  // Trạng thái: 'empty' | 'loading' | 'success' | 'error'
  const [state, setState] = useState<'empty' | 'loading' | 'success' | 'error'>('empty');
  const [prompt, setPrompt] = useState("");
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');

  const handleGenerate = () => {
    setState('loading');
    // Giả lập AI call API
    setTimeout(() => {
      // Tuỳ điều kiện có thể set 'error' hoặc 'success'
      setState('success');
    }, 4000);
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      
      {/* Nút Toggle cho Mobile (< 768px) */}
      <div className="md:hidden absolute top-4 left-0 right-0 flex justify-center z-50 gap-2">
         <Button variant={mobileView === 'chat' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView('chat')}>
            <MessageSquare className="w-4 h-4 mr-2" /> Chat
         </Button>
         <Button variant={mobileView === 'preview' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView('preview')}>
            <Eye className="w-4 h-4 mr-2" /> Preview
         </Button>
      </div>

      {/* --- CỘT TRÁI: CHAT PANEL (380px) --- */}
      <div className={`w-full md:w-[380px] h-full border-r border-border bg-card flex flex-col p-4 transition-all
        ${mobileView === 'preview' ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="flex-1 overflow-y-auto pt-10 md:pt-0">
          <h2 className="text-xl font-bold mb-6 text-foreground">AI Builder</h2>
          
          {/* Trạng thái 1: Empty */}
          {state === 'empty' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-muted p-3 rounded-lg text-sm text-foreground">
                Xin chào! Tôi là AI Builder. Hãy mô tả cửa hàng của bạn để tôi tạo website trong 1 phút nhé!
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => setPrompt("Shop thời trang nữ, màu hồng")}>👚 Thời trang nữ</Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => setPrompt("Quán cafe chill, màu nâu")}>☕ Quán Cafe</Badge>
              </div>
            </div>
          )}

          {/* Trạng thái 2: Loading (Streaming) */}
          {state === 'loading' && (
            <div className="space-y-4 pt-4">
              <div className="bg-primary/10 text-primary p-3 rounded-lg text-sm self-end inline-block">
                {prompt}
              </div>
              <div className="text-sm text-muted-foreground flex flex-col gap-2 mt-4 ml-2">
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Đang phân tích yêu cầu...</span>
                <span className="opacity-50 text-xs pl-6">↳ Chọn bảng màu hợp phong thủy: Đã xong</span>
                <span className="opacity-50 text-xs pl-6">↳ Tạo layout cho trang chủ: Đang xử lý...</span>
              </div>
            </div>
          )}

          {/* Trạng thái 3: Success */}
          {state === 'success' && (
            <div className="space-y-6 pt-4 animate-in slide-in-from-bottom-2">
              <div className="bg-success/20 text-success-foreground p-4 rounded-lg text-sm font-medium border border-success/30">
                🎉 Website của bạn đã sẵn sàng!
              </div>
              <div className="flex flex-col gap-3">
                <Button className="w-full">Publish ngay</Button>
                <Button variant="outline" className="w-full">Tinh chỉnh lại →</Button>
              </div>
            </div>
          )}
        </div>

        {/* Khung Input AI */}
        <div className="pt-4 mt-auto border-t border-border flex gap-2">
          <Input 
            placeholder="Ví dụ: Tôi bán trà sữa, quán tên là..." 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={state === 'loading' || state === 'success'}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && prompt && handleGenerate()}
          />
          <Button 
            disabled={!prompt || state === 'loading' || state === 'success'} 
            onClick={handleGenerate}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>


      {/* --- CỘT PHẢI: LIVE PREVIEW PANEL --- */}
      <div className={`flex-1 h-full bg-muted p-4 md:p-8 overflow-y-auto relative
        ${mobileView === 'chat' ? 'hidden md:block' : 'block'}
      `}>
         {/* Phù hiệu trạng thái Draft */}
        <Badge variant="secondary" className="absolute top-4 right-4 z-10 shadow-sm">
          {state === 'success' ? 'Draft' : 'Preview'}
        </Badge>
        
        {/* Khung mô phỏng Website */}
        <Card className="w-full min-h-[800px] max-w-[1000px] mx-auto shadow-lg overflow-hidden border-border transition-all duration-500">
          
          {/* Trạng thái Empty: Chưa làm gì */}
          {state === 'empty' && (
            <div className="h-full min-h-[800px] flex items-center justify-center text-muted-foreground text-sm">
              Xem trước website sẽ hiển thị tại đây...
            </div>
          )}

          {/* Trạng thái Loading: Hiển thị Skeleton */}
          {state === 'loading' && (
            <CardContent className="p-0 animate-in fade-in">
              <Skeleton className="w-full h-16 rounded-none mb-2" /> {/* Navbar */}
              <Skeleton className="w-full h-[400px] rounded-none mb-8" /> {/* Hero */}
              <div className="px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-[250px] rounded-xl" />
                <Skeleton className="h-[250px] rounded-xl" />
                <Skeleton className="h-[250px] rounded-xl" />
              </div>
            </CardContent>
          )}

          {/* Trạng thái Success: Render Website Component */}
          {state === 'success' && (
            <CardContent className="p-0 animate-in fade-in duration-700">
               {/* Mô phỏng UI website thời trang */}
              <div className="bg-pink-50 h-16 border-b flex items-center px-8 justify-between font-bold text-pink-900 border-pink-100">
                <span>Shop Của Bạn</span>
                <span className="text-sm font-normal">Trang chủ • Sản phẩm • Liên hệ</span>
              </div>
              <div className="bg-pink-100 w-full h-[400px] flex items-center justify-center flex-col gap-4 text-pink-950">
                <h1 className="text-4xl font-extrabold text-center mx-4">Thời trang thanh lịch & Hiện đại</h1>
                <Button className="bg-pink-600 hover:bg-pink-700 text-white rounded-full">Mua sắm ngay</Button>
              </div>
              <div className="px-8 py-12">
                <h2 className="text-xl font-bold mb-6 text-foreground">Sản phẩm nổi bật</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1,2,3].map(i => (
                    <div key={i} className="border rounded-xl p-4 bg-card shadow-sm">
                      <div className="bg-muted w-full h-[180px] rounded-md mb-4 flex items-center justify-center text-xs text-muted-foreground">Image</div>
                      <h3 className="font-semibold text-foreground">Váy Hoa Mùa Hè {i}</h3>
                      <p className="text-primary font-bold mt-2">RM 89.00</p>
                      <div className="mt-2 text-xs text-success flex items-center gap-1 font-medium bg-success/10 w-fit px-2 py-1 rounded">✅ Halal</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}

        </Card>
      </div>
    </div>
  );
}
```

## 3. Các Checklist Handoff / Coding cần chú ý cho F01

1. **Skeleton (Loading State):** 
   Đảm bảo quá trình AI render tạo cảm giác realtime bằng việc *thay thế dần* Skeleton thành Block thật (Navbar -> Hero -> Products). Không hiển thị spinner vòng tròn chán ngắt.
2. **Clarifying Questions (Luồng làm rõ):**
   Khi người dùng thiếu `businessName` hoặc `category`. AI sẽ hỏi ngược lại trên Chat (dùng component Message thông thường, Input vẫn mở).
3. **Mobile First View:**
   Luôn bắt đầu vẽ ở 375px. Dùng 1 Floating Button Group ở trên cùng (hoặc thanh bar dưới) để user CHUYỂN ĐỔI giữa View Chat và View Preview. (Trên Demo Code tôi đã dùng nút điều hướng trên cùng form Mobile).
4. **Theme Detection:**
   Dựa vào NLP prompt của user -> Đẩy cấu hình CSS Variables (Ví dụ: config `--primary` thành màu Pink/Rose nếu bán thời trang nữ). Điều này diễn ra vào giai đoạn cuối của `Loading State`.
