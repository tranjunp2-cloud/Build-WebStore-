# Tai Lieu Kiem Thu: F10 - Quan Ly Don Hang (Orders Management)
> **Phien ban:** 7.0 (v2.2 — Manual Payment Verification) | **Cap nhat:** 2026-05-15 | **Thuc hien:** QA Team
> **Nguon:** PRD F10 v2.2, User Stories US-F10-01 -> US-F10-07 (24 FRs, 13 BRs, 9 ACs)
> **Ky thuat:** BVA, State Transition (State Machine), Error Guessing, Concurrency/Idempotency, UI/UX States (10-Point)
> **Decisions:** [PD-018](../decisions/decisions-log.md#pd-018--manual-payment-bank-transfer-verification-flow) - Issue [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004)

---

## 1. Muc Tieu Kiem Thu

Vet can toan bo AC va Business Rules cua F10, dac biet la: tinh toan ven State Machine don hang, bao mat (IDOR, XSS, Price Spoofing), Idempotency chong nhan ban kho, Race Condition, va trai nghiem Mobile. Moi AC Happy Path co it nhat 3 case Negative/Edge tuong ung.

---

## 2. Moi Truong Kiem Thu

| Thong so | Yeu cau |
|---|---|
| Moi truong | Staging / Localhost voi > 10,000 don hang ao |
| Phan quyen | Owner (Merchant), Staff Custom, Guest Customer |
| Mui gio | Cross-timezone: Khach UTC-5 (US), Cua hang UTC+8 (MY) |
| SLA | API response < 60s notification, Idempotency key, Rate Limit Bulk |

---

## 3. Ma Tran Test Case Theo User Story

### US-F10-01: Quan Ly & Cap Nhat Trang Thai Don Hang

#### Nhom 1A — Thong Bao & Tong Quan Danh Sach

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-01-01** | `[Positive]` | Thong bao don hang moi trong vong 60 giay | 1. Khach hoan tat dat hang (COD hoac QR).<br>2. Admin dang mo trang `/orders`. | - Don moi xuat hien **trong < 60 giay** (SSE hoac WebSocket).<br>- Toast thong bao don moi hien thi goc tren phai. | Critical | [ ] |
| **TC-F10-01-02** | `[Positive]` | Gui Email xac nhan tu dong toi khach | 1. Khach hoan tat thanh toan 1 don hang. | - He thong day task gui email (qua Payload SMTP) toi dia chi cua khach.<br>- Email chua tom tat don va link tra cuu. | Blocker | [x] |
| **TC-F10-01-03** | `[Positive]` | Gui Email thong bao Merchant khi co don moi | 1. Khach dat hang thanh cong. | - Email gui toi Email dang ky cua Merchant.<br>- Noi dung: Ma don, ten khach, tong tien, phuong thuc thanh toan. | High | [ ] |
| **TC-F10-01-04** | `[UI State]` | Empty State — Chua co don hang nao | 1. Admin vao `/orders` khi chua co don nao. | - Hien thi minh hoa dung theo UI Design ("Chua co don hang nao").<br>- Layout khong bi lech. Co nut huong dan chia se link store. | Low | [x] |
| **TC-F10-01-05** | `[UI State]` | Loading Skeleton khi trang Orders dang fetch | 1. Lam cham mang (Devtools Throttle).<br>2. Mo trang `/orders`. | - Hien thi skeleton loader (Table skeleton lines).<br>- Khong trang trang, khong flash layout. | Medium | [ ] |
| **TC-F10-01-06** | `[Positive]` | Stats Bar hien thi dung so lieu theo trang thai | 1. Co san cac don o nhieu trang thai Pending, Confirmed, Shipped.<br>2. Mo trang `/orders`. | - Thanh Stats Bar hien thi dung so luong don moi trang thai.<br>- Click vao tung o loc dung theo trang thai do. | High | [ ] |
| **TC-F10-01-07** | `[Perf]` | Stats Bar render nhanh voi 1,000+ don | 1. Them 1,000 don ao vao staging.<br>2. Reload trang Orders. | - 4 the thong ke render dung va nhanh.<br>- Dung Cache Layer, khong bi N+1 Query goi tung don. | Medium | [ ] |

#### Nhom 1B — State Machine Luong Trang Thai Don Hang

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-01-08** | `[State]` | Flow day du: Pending -> Confirmed -> Ready -> Shipped -> Completed | 1. Chuyen don qua tung trang thai theo dung thu tu.<br>2. Kiem tra Timeline UI sau moi buoc. | - Moi chuyen tiep thanh cong.<br>- Timeline sang dung moc hien tai, cac moc sau van mo. | Blocker | [x] |
| **TC-F10-01-09** | `[Negative]` | State Machine: Chan di lui trang thai qua UI | 1. Mo don dang "Shipped".<br>2. Kiem tra dropdown/nut trang thai. | - Khong co option "Pending", "Confirmed" trong danh sach.<br>- Chi cho phep tien toi "Completed" hoac "Cancel/Refund". | Blocker | [x] |
| **TC-F10-01-10** | `[Security]` | API chan downgrade trang thai (Backend Enforcement) | 1. Dung Postman goi `PATCH /api/orders/:id` doi `status: "completed"` ve `status: "pending"`. | - API tra ve **HTTP 400** "Invalid State Transition".<br>- DB khong bi thay doi. | Blocker | [x] |
| **TC-F10-01-11** | `[State]` | Email khach tu dong gui khi Confirmed | 1. Chuyen don tu Pending -> Confirmed. | - Email "Don hang da duoc xac nhan" gui toi khach ngay lap tuc (FR-07). | High | [x] |
| **TC-F10-01-12** | `[State]` | Email khach tu dong gui khi Shipped | 1. Chuyen don tu Ready to Ship -> Shipped. | - Email "Don hang dang duoc giao" gui toi dia chi khach hang. | High | [x] |
| **TC-F10-01-13** | `[State]` | Progress Timeline UI cap nhat dung moc | 1. Chuyen trang thai don sang "Ready to Ship".<br>2. Mo lai chi tiet don. | - Thanh Timeline sang dung o moc "Ready to Ship", cac moc truoc do cung sang ke thua. | High | [ ] |
| **TC-F10-01-14** | `[Negative]` | Chan chuyen trang thai don da Cancelled/Completed | 1. Mo don da o trang thai "Cancelled".<br>2. Tim nut Update Status. | - Tat ca nut thay doi trang thai bi disable hoac an.<br>- Trang thai cuoi (Completed, Cancelled) la Terminal State. | Blocker | [x] |

#### Nhom 1C — Xem Chi Tiet Don Hang

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-01-15** | `[Positive]` | Chi tiet don hien thi day du thong tin | 1. Nhan vao ma don hang bat ky. | - Drawer/Page hien thi: Ten khach, SDT, Dia chi, Danh sach san pham, Subtotal, SST 6%, Shipping, Grand Total, Phuong thuc TT. | High | [ ] |
| **TC-F10-01-16** | `[Positive]` | Xem & phong to anh bien lai QR (Lightbox) | 1. Mo chi tiet don thanh toan QR.<br>2. Nhap vao anh bien lai. | - Anh mo dang Modal Lightbox toan man hinh.<br>- Co the zoom, khong tran/vo layout. | High | [ ] |
| **TC-F10-01-17** | `[Val]` | Kiem tra phep tinh Subtotal + SST + Shipping = Total | 1. Mo chi tiet don hang bat ky.<br>2. Tinh thu cong: Subtotal + Shipping + SST 6% = Total. | - Ket qua tinh chinh xac tuyet doi.<br>- Khong bi loi lam tron float trong DB. | Blocker | [ ] |
| **TC-F10-01-18** | `[Edge]` | Mui gio tren don hang hien thi dung Merchant TZ | 1. Khach UTC-5 dat hang luc 01:00 AM.<br>2. Merchant UTC+8 mo Orders. | - Thoi gian dat hang duoc quy doi sang **UTC+8** (gio cua Merchant). | High | [ ] |
| **TC-F10-01-19** | `[Security]` | Chan XSS trong ghi chu cua khach | 1. Khach nhap ghi chu: `<script>alert("XSS")</script>`.<br>2. Merchant xem Orders tren CMS. | - Text duoc sanitize hoan toan, khong thuc thi JS.<br>- DOM hien thi chuoi literal an toan. | Blocker | [x] |
| **TC-F10-01-20** | `[Security]` | Chan IDOR — Khong truy cap don cua tenant khac | 1. Dung Auth Token cua Store A.<br>2. Goi `GET /api/orders/{OrderID_of_Store_B}`. | - Tra ve **HTTP 403 Forbidden**.<br>- Khong lo bat ky du lieu cua Store B. | Blocker | [x] |

#### Nhom 1D — Refund & Hoan Tien

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-01-21** | `[Negative]` | Khoa nut Refund khi don chua Shipped | 1. Mo don o trang thai "Pending" hoac "Confirmed". | - Nut "Refund" bi Disabled.<br>- Chi co the dung "Huy don (Cancel)". | High | [ ] |
| **TC-F10-01-22** | `[Positive]` | Mo khoa nut Refund khi don Shipped/Completed | 1. Mo don o trang thai "Shipped" hoac "Completed". | - Nut "Refund" duoc kich hoat.<br>- Nhan -> Modal nhap so tien hoan hien ra. | High | [ ] |
| **TC-F10-01-23** | `[Negative]` | Chan Refund vuot tong gia tri don | 1. Nhap so tien Refund lon hon Grand Total cua don. | - Validation highlight do ngay lap tuc.<br>- API tu choi voi loi "So tien hoan vuot qua tong don hang". | Blocker | [ ] |
| **TC-F10-01-24** | `[BVA]` | Refund dung bang 100% tong don (Full Refund) | 1. Nhap so tien Refund bang dung Grand Total.<br>2. Xac nhan. | - Refund thanh cong.<br>- Trang thai don chuyen sang "Refunded". | High | [ ] |
| **TC-F10-01-25** | `[Cancel]` | Huy Modal Refund giua chung | 1. Nhan nut Refund, Modal nhap so tien mo ra.<br>2. Nhan Cancel hoac dong Modal. | - Modal dong lai.<br>- Don hang **khong bi thay doi trang thai**. | Medium | [ ] |

#### Nhom 1E — Bulk Action Chinh Trang Thai Hang Loat

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-01-26** | `[Positive]` | Bulk Confirm 5 don hang cung luc | 1. Chon 5 don o trang thai "Pending".<br>2. Nhan "Xac nhan hang loat". | - 5 don chuyen sang "Confirmed" thanh cong.<br>- 5 email xac nhan duoc gui toi tung khach doc lap. | Blocker | [x] |
| **TC-F10-01-27** | `[Negative]` | Bulk Confirm khi chon lan don trang thai khac | 1. Chon 3 don Pending + 2 don Shipped.<br>2. Nhan "Confirm hang loat". | - He thong chi thay doi 3 don Pending.<br>- 2 don Shipped skip qua hoac bao loi ro "Khong the Confirm vi da Shipped". | High | [ ] |
| **TC-F10-01-28** | `[Perf]` | Bulk Update 1,000 don khong gay OOM | 1. Chon 1,000 don ao.<br>2. Thuc thi Bulk Confirm. | - Backend dung `UpdateMany` + Job Queue.<br>- Khong gay Out-Of-Memory Node.js, khong N+1 Query. | Blocker | [ ] |
| **TC-F10-01-29** | `[Negative]` | Bulk Action khi khong chon don nao | 1. Khong chon don nao.<br>2. Tim nut Bulk Action. | - Nut Bulk Action bi disable hoac an khi khong co selection.<br>- Khong cho phep submit rong. | Medium | [ ] |

#### Nhom 1F — Race Condition & SPA UX

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-01-30** | `[Concurrency]` | Race Condition: 2 Admin cung Confirm 1 don | 1. Admin A va B cung nhan "Xac nhan" cung 1 don trong 0.1 giay. | - Optimistic Lock trong DB.<br>- Admin nhan sau nhan loi: "Don da duoc cap nhat boi nguoi khac". | Blocker | [ ] |
| **TC-F10-01-31** | `[Concurrency]` | Spam nut Update Status nhieu lan nhanh | 1. Nhan nut chuyen trang thai 5-10 lan nhanh. | - Nut chuyen sang Loading/Disabled sau lan nhan dau.<br>- Chi 1 PATCH request duoc gui. | Medium | [ ] |
| **TC-F10-01-32** | `[Network Drop]` | Mat mang khi dang cap nhat trang thai | 1. Nhan nut Confirm order.<br>2. Ngay sau do ngat mang. | - Toast loi "Cap nhat that bai, vui long thu lai".<br>- Trang thai don **khong bi thay doi mot nua** (Atomic). | High | [ ] |
| **TC-F10-01-33** | `[UX]` | SPA Navigation khong flash trang | 1. Tu Tab San pham chuyen sang Tab Orders qua Sidebar. | - Chuyen man nhanh (SPA Routing).<br>- Sidebar va Header khong bi reload hoac nhap nhay trang. | High | [ ] |

---

### US-F10-02: Luong Checkout Cua Khach Hang

#### Nhom 2A — Checkout COD

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-02-01** | `[Positive]` | Guest Checkout thanh cong bang COD | 1. Khong dang nhap (Guest).<br>2. Them hang vao gio, chon COD, dien dia chi va Email.<br>3. Nhan Dat Hang. | - Don tao thanh cong.<br>- Redirect ve `/order/{id}/confirm` hien thi tom tat don.<br>- Email xac nhan gui toi email khai bao. | Blocker | [x] |
| **TC-F10-02-02** | `[Positive]` | Trang xac nhan don hien thi day du thong tin | 1. Sau khi Checkout thanh cong, xem trang `/order/{id}/confirm`. | - Hien thi: Ma don, danh sach san pham, dia chi giao hang, phuong thuc thanh toan, ngay giao du kien. | High | [ ] |
| **TC-F10-02-03** | `[Negative]` | Guest Checkout thieu Email — Bi chan | 1. Dien form Checkout nhung de trong o Email.<br>2. Nhan Submit. | - Field Email do, hien bao bat buoc.<br>- Khong tao don hang. | High | [ ] |
| **TC-F10-02-04** | `[Negative]` | San pham het hang giua chung (In-flight OOS) | 1. Khach dang o trang Checkout.<br>2. Backend cap nhat ton kho ve 0.<br>3. Khach nhan Dat Hang. | - Toast loi "San pham X da het hang".<br>- Gio hang duoc bao toan de khach tiep tuc chinh sua. | Blocker | [x] |
| **TC-F10-02-05** | `[Concurrency]` | Double-click Submit Checkout — Chong tao 2 don trung | 1. Double-click nut "Dat Hang" trong < 0.2 giay. | - Nut Disabled ngay sau lan click dau.<br>- Chi 1 POST request duoc gui.<br>- Khong tao 2 don hang trung. | Blocker | [ ] |
| **TC-F10-02-06** | `[BVA]` | Dia chi nhan hang — Nhap toi da 200 ky tu | 1. Nhap chuoi 2,000 ky tu rac vao o Dia Chi. | - Validation cat tai gioi han hoac bao "Dia chi qua dai".<br>- Khong luu chuoi vuot gioi han vao DB. | High | [ ] |
| **TC-F10-02-07** | `[Security]` | Chan Price Spoofing tu Client | 1. Dung Postman gui Order request voi `total_price: 1` (sua payload). | - Backend tinh lai tong tu DB, phat hien sai lech.<br>- Tra ve **HTTP 400** "Price Integrity Check Failed".<br>- Don khong duoc tao. | Blocker | [x] |

#### Nhom 2B — Checkout QR Banking

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-02-08** | `[Positive]` | QR Payment: Hien thi ma QR cua hang | 1. Chon "QR Banking" tai trang Checkout. | - Ma QR cua Merchant hien thi ro rang (anh QR da cai dat o F19).<br>- Nut "Xac nhan dat hang" bi disable cho den khi upload bien lai. | Blocker | [ ] |
| **TC-F10-02-09** | `[Positive]` | Upload bien lai chuyen khoan hop le | 1. Upload anh bien lai JPG < 2MB dung chuan. | - Anh preview hien thi.<br>- Nut "Xac nhan dat hang" duoc kich hoat. | High | [ ] |
| **TC-F10-02-10** | `[Negative]` | Chan upload bien lai file sai dinh dang | 1. Upload file `.pdf`, `.exe`, hoac anh > 25MB. | - Tu choi file, bao loi dinh dang/dung luong.<br>- Nut dat hang van disable. | High | [ ] |
| **TC-F10-02-11** | `[Negative]` | Gia mao file (Magic Byte) — chong upload exe gia jpg | 1. Doi ten file `.exe` thanh `.jpg`.<br>2. Upload vao o bien lai. | - Server phat hien Magic Bytes khong phai JPEG.<br>- Tra ve HTTP 400. Khong luu file doc hai. | Blocker | [x] |
| **TC-F10-02-12** | `[BVA]` | Upload anh bien lai dung 2MB (bien tren) | 1. Upload file JPG dung 2048KB. | - Can lam ro: `< 2MB` hay `<= 2MB`.<br>- He thong xu ly nhat quan. | Medium | [ ] |
| **TC-F10-02-13** | `[Edge]` | Inventory Reservation het han sau 30 phut (BR-07) | 1. Khach bat dau Checkout nhung khong hoan tat trong 30 phut.<br>2. Kiem tra ton kho sau do. | - He thong tu dong release reservation cua san pham sau 30 phut.<br>- Ton kho duoc khoi phuc de khach khac mua duoc. | High | [ ] |
| **TC-F10-02-14** | `[Mobile]` | Checkout hien thi dung tren man 375px | 1. Tai trang Checkout tren dien thoai 375px. | - Form chuyen sang layout Stack Column (1 cot).<br>- Khong co thanh cuon ngang. | High | [ ] |

---

### US-F10-03: Huy Don & Hoan Kho Tu Dong

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-03-01** | `[Positive]` | Huy don Pending thanh cong — Co ly do | 1. Mo don trang thai "Pending".<br>2. Nhan Huy, nhap ly do ro rang.<br>3. Xac nhan. | - Trang thai doi sang "Cancelled".<br>- Email huy gui toi khach hang ngay lap tuc. | Blocker | [x] |
| **TC-F10-03-02** | `[Positive]` | Huy don Confirmed thanh cong | 1. Mo don trang thai "Confirmed".<br>2. Nhan Huy, nhap ly do.<br>3. Xac nhan. | - Trang thai doi sang "Cancelled".<br>- Kho duoc hoan tu dong (Restock). | Blocker | [x] |
| **TC-F10-03-03** | `[Negative]` | Bat buoc nhap ly do huy — Khong de trong | 1. Nhan Huy don.<br>2. De trong o "Ly do huy".<br>3. Nhan Submit. | - Required validation bat len tren field ly do.<br>- API khong gui khi chua co ly do. | Blocker | [ ] |
| **TC-F10-03-04** | `[Negative]` | Chan huy don da Shipped | 1. Mo don o trang thai "Shipped".<br>2. Tim nut "Huy don". | - Nut Cancel bi an hoac disable.<br>- Chi co the dung "Refund". | High | [ ] |
| **TC-F10-03-05** | `[Data]` | Restock ton kho sau khi huy don | 1. Ton kho ban dau: SP A = 5.<br>2. Dat don mua 2 SP A (ton con 3).<br>3. Huy don do. | - He thong cong lai SP A = +2.<br>- Ton kho cuoi: SP A = 5 (dung). | Blocker | [x] |
| **TC-F10-03-06** | `[Edge]` | Restock skip san pham da bi xoa khoi DB | 1. Don hang chua San pham B da bi hard delete trong DB.<br>2. Huy don do. | - Luong huy hoan thanh binh thuong.<br>- Buoc Restock skip qua SP da xoa (khong crash HTTP 500). | Blocker | [x] |
| **TC-F10-03-07** | `[Security]` | Idempotency: Spam API huy don — Kho khong bi nhan ban | 1. Dung Postman gui lien tuc 10 request huy cung Order ID. | - He thong check idempotency key.<br>- Job Restock chi chay **1 lan duy nhat**.<br>- Ton kho khong bi cong ao nhieu lan. | Blocker | [ ] |
| **TC-F10-03-08** | `[Cancel]` | Huy Modal Huy Don — Nhan Cancel trong Modal | 1. Nhan vao nut "Huy Don".<br>2. Modal xac nhan xuat hien -> nhan "Khong, quay lai". | - Modal dong lai.<br>- Don hang **khong bi huy**, trang thai giu nguyen. | Medium | [ ] |
| **TC-F10-03-09** | `[Email]` | Email huy don gui toi khach chua ly do | 1. Huy don voi ly do "Khach yeu cau doi dia chi". | - Email gui toi khach co noi dung ly do huy cu the.<br>- Khong gui email voi ly do trong. | High | [x] |
| **TC-F10-03-10** | `[UI State]` | Modal huy mo ta ro rang ve Restock tu dong | 1. Nhan "Huy Don" tren bat ky don nao. | - Modal hien thi canh bao: "Huy don se tu dong hoan lai ton kho san pham."<br>- Giup Admin tu tin thao tac. | Medium | [ ] |
| **TC-F10-03-11** | `[BVA]` | Ly do huy don vuot Max Length | 1. Nhap chuoi ly do huy dai hon 500 ky tu.<br>2. Nhan Submit. | - Validation cat hoac bao loi do dai.<br>- Khong luu chuoi vuot gioi han vao DB. | Medium | [ ] |

---

### US-F10-04: Loc, Tim Kiem & Sap Xep Don Hang

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-04-01** | `[Positive]` | Tim don theo Ma don hang | 1. Nhap ma don chinh xac vao o tim kiem. | - Danh sach loc con dung 1 don hang tuong ung.<br>- Ket qua nhanh, khong lag. | High | [x] |
| **TC-F10-04-02** | `[Positive]` | Tim don theo Ten khach hang (mot phan) | 1. Nhap "Nguyen" (mot phan ten) vao o tim kiem. | - Danh sach loc ra tat ca don cua khach ten chua "Nguyen". | High | [x] |
| **TC-F10-04-03** | `[Positive]` | Multi-Filter: Ket hop Ngay + Phuong thuc TT | 1. Chon filter "Hom nay" + "COD". | - Ket qua khop chinh xac ca 2 dieu kien (AND logic). | High | [ ] |
| **TC-F10-04-04** | `[Positive]` | Sort theo Tong tien Cao -> Thap | 1. Nhan Sort "Tong tien Cao -> Thap". | - Sap xep dung theo gia tri so hoc, khong bi loi so sanh chuoi nhu "20" < "9". | Blocker | [ ] |
| **TC-F10-04-05** | `[Positive]` | Sort theo Ngay Moi Nhat -> Cu Nhat | 1. Nhan Sort "Moi nhat". | - Don hang moi nhat theo timestamp hien thi dau tien. | High | [ ] |
| **TC-F10-04-06** | `[UI State]` | Empty State khi Filter khong co ket qua | 1. Loc theo ngay "Hom qua" nhung khong co don trong ngay do. | - Hien thi man trong co thong bao: "Khong tim thay don nao phu hop".<br>- Khong crash hoac hang trang ma khong co gi. | Medium | [ ] |
| **TC-F10-04-07** | `[UX]` | Giu nguyen Filter khi chuyen trang phan trang | 1. Dang o trang 2 cua danh sach da filter "COD".<br>2. Click sang trang 3. | - Bo loc COD van giu nguyen trong URL query params.<br>- Ket qua dung, khong reset ve tat ca. | High | [ ] |
| **TC-F10-04-08** | `[Edge]` | Tim kiem voi ky tu Unicode, Emoji | 1. Nhap emoji hoac ky tu dac biet vao o tim kiem. | - Server decode UTF-8 dung, khong crash.<br>- Tra ve ket qua hop le hoac danh sach rong. | High | [ ] |
| **TC-F10-04-09** | `[Security]` | Chan XSS trong thanh tim kiem Orders | 1. Nhap `<a onmouseover="alert('xss')">test</a>` vao o tim kiem. | - Escape HTML, DOM khong render tag.<br>- API khong bi anh huong. | Blocker | [x] |
| **TC-F10-04-10** | `[BVA]` | Tim kiem voi o trong / chi dau cach | 1. Nhap toan bo khoang trang vao o tim kiem.<br>2. Nhan Enter. | - Danh sach hien thi toan bo don hang (khong filter).<br>- Khong goi API voi search query rong gay loi. | Medium | [ ] |
| **TC-F10-04-11** | `[Perf]` | Tim kiem Debounce — Khong spam API moi ky tu | 1. Go nhanh "Nguyen Van A" tung ky tu lien tiep. | - API tim kiem chi goi sau khi nguoi dung ngung go ~300ms (Debounce).<br>- Khong gui 10 request cho 10 ky tu go lien tiep. | Medium | [ ] |

---

### US-F10-05: Giao Dien Mobile (< 768px)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-05-01** | `[Positive]` | Table Orders chuyen thanh Card Stack tren 320px | 1. Mo trang `/orders` tren thiet bi 320px. | - Table an, thay bang Card doc (Ma don, Ten khach, Tong tien, Trang thai).<br>- Khong co thanh cuon ngang. | Blocker | [ ] |
| **TC-F10-05-02** | `[Positive]` | Chi tiet don mo dang Full-Screen tren Mobile | 1. Tap vao mot don hang tren Mobile. | - Detail mo Full-Screen (thay vi Drawer ben phai).<br>- Co nut dong (X) ro rang, de dieu huong. | High | [ ] |
| **TC-F10-05-03** | `[Positive]` | Nut Action Sticky o day man hinh | 1. Mo chi tiet don tren Mobile, cuon xuong. | - Cac nut Confirm/Ship/Cancel Sticky o day man hinh khi cuon.<br>- De tap bang ngon cai. | Critical | [ ] |
| **TC-F10-05-04** | `[Edge]` | Ghi chu dai khong tran Card tren Mobile | 1. Xem don co ghi chu 200+ ky tu tren Mobile. | - CSS word-break xu ly dung, text khong phinh Card, khong tran ngang. | High | [ ] |
| **TC-F10-05-05** | `[UI State]` | Loading skeleton tren Mobile | 1. Lam cham mang, mo Orders tren Mobile. | - Skeleton Card hien thi thay vi trang trang. | Medium | [ ] |
| **TC-F10-05-06** | `[Mobile]` | Stats Bar responsive tren Mobile | 1. Xem trang Orders tren man 375px. | - Stats Bar cac the (Pending, Confirmed...) co gian hoac xep thanh 2 hang, khong tran ngang. | Medium | [ ] |

#### Nhom 6 — Checkout API Security (F14 Bug Fixes)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F10-06-01** | `[Security]` | Chan cross-tenant product trong checkout | 1. Goi `POST /api/orders/checkout` voi productId thuoc site khac. | - Tra ve **HTTP 404 PRODUCT_NOT_FOUND**.<br>- Khong lo thong tin product ton tai o tenant khac. | Blocker | [x] |
| **TC-F10-06-02** | `[Security]` | Dedup items — ngan vuot stock qua split quantity | 1. Goi checkout voi 2 dong cung productId, moi dong qty=2, stock=3.<br>2. Tong qty=4 > stock=3. | - Tra ve **HTTP 422 OUT_OF_STOCK**.<br>- Khong cho dat hang voi tong so luong vuot stock. | Blocker | [x] |
| **TC-F10-06-03** | `[Func]` | Dedup items — gop thanh 1 dong trong order | 1. Goi checkout voi 2 dong cung productId qty=2 va qty=3, stock=10. | - Don tao ra chi co **1 dong** cho product do voi quantity=5.<br>- Tong tien tinh dung. | High | [x] |

---

## 4. Bien Ban Kiem Dinh — 10-Point Checklist (Sign-Off)

| # | Tieu Chi | Trang Thai |
|:---:|:---|:---:|
| 1 | **Tenant Isolation (IDOR 403):** Token Store A khong GET/PATCH don cua Store B. | [ ] |
| 2 | **Price Integrity:** Backend tu tinh tong tu DB, tu choi `total_price` gia mao tu Client. | [ ] |
| 3 | **State Machine Forward-Only:** Pending->Confirmed->Ready->Shipped->Completed chi tien, API chan 400 khi downgrade. | [ ] |
| 4 | **Restock An Toan:** Huy don chua SP deleted van chay binh thuong, skip Restock SP hong, khong crash 500. | [ ] |
| 5 | **Idempotency Chong Nhan Ban Kho:** API Huy/Restock du spam chi chay **1 lan**. | [ ] |
| 6 | **Inventory Reservation Release (BR-07):** Reservation tu het han sau 30 phut neu Checkout khong hoan tat. | [ ] |
| 7 | **Bulk Action Job Queue:** Bulk Update 1,000+ dung UpdateMany + Queue, khong OOM Node.js. | [ ] |
| 8 | **Mobile Breakpoint 320px:** Table -> Stack Card, khong scroll ngang. Sticky CTA o day. | [ ] |
| 9 | **MIME & Capacity Validation:** Chan file > 2MB hoac gia mao dinh dang (Magic Byte) tai QR Upload. | [ ] |
| 10 | **XSS & Input Sanitization:** Ghi chu khach hang, thanh tim kiem deu duoc escape khi hien thi tren CMS. | [ ] |

---

## 4.1. [v2.2] Manual Payment Verification — Test Cases (US-F10-06, US-F10-07)

### Nhom 6A — Bank Transfer Place Order (Step 1)

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-01** | `[Positive]` | Place Order Bank Transfer KHONG can upload proof | 1. Buyer chon Bank Transfer + dien form.<br>2. Bam Place Order. | - Order tao thanh cong voi paymentStatus = `awaiting_payment`.<br>- KHONG yeu cau upload tai checkout (D-04). | Blocker | [ ] |
| **TC-F10-06-02** | `[Positive]` | Reference Code auto-generate | 1. Place Order Bank Transfer. | - paymentReference format `BT-XXXXXX` (6 chars uppercase alphanum, exclude 0/O/I/1).<br>- Unique per tenant. | High | [ ] |
| **TC-F10-06-03** | `[Positive]` | paymentExpiresAt = createdAt + 24h | 1. Place Order luc 14:00.<br>2. Check DB. | - paymentExpiresAt = 14:00 + 24h (next day). | High | [ ] |
| **TC-F10-06-04** | `[Positive]` | Stock reserved (NOT decremented) | 1. Place Order Bank Transfer.<br>2. Check stock cua product trong order. | - Stock count KHONG thay doi (chua decrement). | Blocker | [ ] |
| **TC-F10-06-05** | `[Negative]` | Place Order khi tenant tat Bank Transfer | 1. F19: tenant.payment_bank_transfer = false.<br>2. Buyer load checkout page. | - Radio Bank Transfer KHONG hien thi (REQ-F19-08.2). | Blocker | [ ] |
| **TC-F10-06-06** | `[Negative]` | Place Order khi tenant thieu bank details | 1. F19: bank_transfer ON nhung thieu account_number.<br>2. Buyer checkout. | - Backend reject create order voi error `INCOMPLETE_BANK_CONFIG`. | High | [ ] |

### Nhom 6B — Magic Link & Post-Order Upload (Step 2)

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-07** | `[Positive]` | Email confirmation co magic link | 1. Place Order Bank Transfer. | - Email gui trong < 60s.<br>- Link format `/sites/{slug}/orders/{id}?token={JWT}`.<br>- Link mo duoc va land tren Post-Order Upload page. | Blocker | [ ] |
| **TC-F10-06-08** | `[Security]` | Magic link JWT signed verify | 1. Sua token (replace 1 char).<br>2. Mo link. | - Hien thi error state "Invalid link".<br>- KHONG cho phep upload. | Blocker | [ ] |
| **TC-F10-06-09** | `[Security]` | Magic link expiry | 1. Cho order qua paymentExpiresAt + 1s.<br>2. Mo magic link. | - Hien thi "Order expired" state.<br>- KHONG cho phep upload. | Blocker | [ ] |
| **TC-F10-06-10** | `[Security]` | Magic link CROSS-tenant access | 1. Lay token cua order tenant A.<br>2. Goi voi tenant B context. | - HTTP 403 hoac error invalid token.<br>- KHONG lo thong tin order. | Blocker | [ ] |
| **TC-F10-06-11** | `[Positive]` | Upload proof <=2MB JPG/PNG/PDF | 1. Mo magic link.<br>2. Upload file proof 1.5MB JPG. | - Upload thanh cong.<br>- paymentStatus chuyen sang `pending_verification`.<br>- Seller nhan notification. | Blocker | [ ] |
| **TC-F10-06-12** | `[Negative]` | Upload file > 2MB | 1. Upload file 5MB. | - Toast error "File qua lon. Max 2MB".<br>- File khong duoc luu. | High | [ ] |
| **TC-F10-06-13** | `[Negative]` | Upload file gia mao MIME (Magic Byte) | 1. Upload `.exe` doi duoi thanh `.jpg`. | - Server detect Magic Byte mismatch.<br>- HTTP 400. | Blocker | [ ] |
| **TC-F10-06-14** | `[State]` | Re-upload (replace) khi awaiting_payment | 1. Mo link.<br>2. Upload proof 1.<br>3. (status: pending_verification) Mo lai link.<br>4. Upload proof 2 (replace). | - File proof 2 duoc luu thay the file 1.<br>- paymentStatus van `pending_verification`. | High | [ ] |
| **TC-F10-06-15** | `[Positive]` | Reference Code display + copy button | 1. Mo magic link state awaiting_payment. | - Reference Code `BT-XXXXXX` hien thi font mono, copy button hoat dong.<br>- Instruction "Vui long nhap BT-XXXXXX vao ghi chu" hien thi. | High | [ ] |
| **TC-F10-06-17** | `[Mobile]` | Post-Order Upload page mobile 375px | 1. Mo link tren mobile viewport 375px. | - Layout stack day du.<br>- QR centered, max 280x280.<br>- Upload button full-width sticky bottom. | High | [ ] |

### Nhom 6C — Seller Verification (Step 3) — Approve

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-18** | `[Positive]` | Approve happy path | 1. Mo order pending_verification.<br>2. Bam Approve. | - paymentStatus = `paid`.<br>- paymentVerifiedAt set = now.<br>- paymentVerifiedBy set = currentUserId.<br>- orderStatus auto-promote `pending` -> `confirmed`.<br>- Stock decrement (commit). | Blocker | [ ] |
| **TC-F10-06-19** | `[Positive]` | Email buyer "Payment Confirmed" sau Approve | 1. Approve don. | - Buyer nhan email `Payment Confirmed - Order #XXX`. | High | [ ] |
| **TC-F10-06-20** | `[Negative]` | Khong cho Approve khi paymentStatus != pending_verification | 1. Mo order `awaiting_payment`.<br>2. Goi API Approve. | - HTTP 400 `INVALID_STATE_TRANSITION`. | Blocker | [ ] |
| **TC-F10-06-21** | `[UI]` | Awaiting Verification filter chip | 1. Tao 3 don pending_verification.<br>2. Vao /orders. | - Chip "Awaiting Verification (3)" mau amber hien thi.<br>- Click -> list loc dung. | High | [ ] |
| **TC-F10-06-22** | `[UI]` | Audit trail visible | 1. Mo don da `paid` qua manual verify. | - Drawer hien thi paymentVerifiedAt + paymentVerifiedBy. | High | [ ] |

### Nhom 6D — Seller Verification — Reject

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-23** | `[Positive]` | Reject voi reason enum (Anh mo) | 1. Mo order pending_verification.<br>2. Bam Reject -> chon "Anh mo" -> Submit. | - paymentRejectionReason = `image_blurry`.<br>- paymentRejectionDetail = null.<br>- paymentStatus revert `awaiting_payment`.<br>- paymentExpiresAt extends + 24h.<br>- magicLinkSecret rotated (old link invalidated).<br>- Email buyer "Payment Rejected: Anh mo" voi link moi. | Blocker | [ ] |
| **TC-F10-06-24** | `[Positive]` | Reject voi reason "Khac" + freetext | 1. Reject -> chon "Khac" -> nhap 15 chars detail -> Submit. | - paymentRejectionReason = `other`.<br>- paymentRejectionDetail saved. | High | [ ] |
| **TC-F10-06-25** | `[Negative]` | Khac freetext < 10 chars bi chan | 1. Reject -> chon "Khac" -> nhap 5 chars -> bam Submit. | - Submit button disabled hoac error "Detail phai >=10 chars". | High | [ ] |
| **TC-F10-06-26** | `[Negative]` | Reject KHONG chon reason | 1. Mo modal Reject -> KHONG chon gi -> bam Submit. | - Submit disabled. | High | [ ] |
| **TC-F10-06-27** | `[Security]` | Old magic link invalidated sau Reject | 1. Save magic link cu.<br>2. Reject don.<br>3. Mo link cu. | - Link cu hien thi "Invalid link".<br>- Buyer phai dung link moi tu email Rejection. | Blocker | [ ] |
| **TC-F10-06-28** | `[State]` | Buyer re-upload sau Reject (khang cao) | 1. Reject don.<br>2. Buyer mo email moi -> link moi.<br>3. Upload proof khac. | - paymentStatus = `pending_verification`.<br>- Seller thay proof moi + history rejection.<br>- Cycle Approve/Reject lap lai duoc. | High | [ ] |

### Nhom 6E — TTL Auto-Cancel (Background Job)

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-29** | `[Positive]` | Auto-cancel order awaiting_payment qua han | 1. Tao order awaiting_payment.<br>2. Set paymentExpiresAt < now (manual DB).<br>3. Cho job chay (<= 15 phut). | - orderStatus = `cancelled`.<br>- paymentStatus = `cancelled`.<br>- Stock restock.<br>- Email "Order Expired" gui buyer. | Blocker | [ ] |
| **TC-F10-06-30** | `[Positive]` | Auto-cancel order pending_verification qua han | 1. Order pending_verification, paymentExpiresAt < now (seller quen verify).<br>2. Cho job chay. | - Order van bi cancel + restock.<br>- Email gui ca buyer va seller. | High | [ ] |
| **TC-F10-06-31** | `[Negative]` | KHONG cancel order da `paid` | 1. Order da approved (paymentStatus paid), paymentExpiresAt < now.<br>2. Job chay. | - Order van paid + confirmed.<br>- Job skip don nay. | Blocker | [ ] |
| **TC-F10-06-32** | `[Concurrency]` | Job chay song song (race) | 1. Spawn 2 job instance simultaneously voi same order. | - Chi 1 instance cancel order.<br>- DB consistency (no double restock). | Blocker | [ ] |
| **TC-F10-06-33** | `[Perf]` | Job hieu nang 10k orders | 1. Tao 10,000 orders awaiting_payment expired.<br>2. Run job. | - Job complete < 5 phut.<br>- Khong OOM. | Medium | [ ] |

### Nhom 6F — Reference Code Edge Cases

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-34** | `[Val]` | Reference Code khong chua 0/O/I/1 | 1. Tao 100 orders.<br>2. Kiem tra paymentReference. | - Khong ky tu `0`, `O`, `I`, `1` xuat hien trong 6 chars (anti-confusion). | High | [ ] |
| **TC-F10-06-35** | `[Concurrency]` | Reference Code unique per tenant | 1. Tao 10,000 orders simultaneously cung tenant. | - Khong co duplicate paymentReference.<br>- DB unique constraint enforce. | Blocker | [ ] |
| **TC-F10-06-36** | `[Positive]` | Custom prefix tu F19 | 1. F19: set paymentReferencePrefix = `ECH`.<br>2. Tao Bank Transfer order. | - paymentReference format `ECH-XXXXXX`. | Medium | [ ] |

### Nhom 6G — [D-13] Wave 8+ Backward-Compat Schema Fields

> Wave 6 chua implement Auto-verify Open Banking nhung schema pre-build 3 fields. TCs nay verify defaults + nullable.

| TC ID | Loai | Tieu De | Buoc | Ket Qua Mong Doi | Mức | Trạng Thái |
|---|---|---|---|---|---|---|
| **TC-F10-06-37** | `[Schema]` | `verificationSource` default = `manual` | 1. Tao Bank Transfer order moi. | - DB column `verification_source` = 'manual'. | High | [ ] |
| **TC-F10-06-38** | `[Schema]` | `autoVerifiedAt` nullable, default NULL | 1. Tao Bank Transfer order.<br>2. Seller Approve manual. | - `auto_verified_at` van NULL.<br>- `payment_verified_at` set. | High | [ ] |
| **TC-F10-06-39** | `[Schema]` | `bankTransactionId` nullable, default NULL | 1. Tao + verify manual Bank Transfer order. | - `bank_transaction_id` NULL ca chu ky Wave 6. | High | [ ] |
| **TC-F10-06-40** | `[Schema]` | `verificationSource` enum constraint | 1. Try insert `verification_source = 'invalid'` qua SQL. | - DB reject voi enum constraint error. | Medium | [ ] |

---

## 5. Quality Gates

| Nhom | Trang Thai | Ghi Chu |
|---|---|---|
| **1. State Machine & Logic** | [ ] Not Run | FSM Forward-Only, Bulk Confirm, Refund Lock, Email per status |
| **2. Security** | [ ] Not Run | IDOR 403, XSS, Price Spoofing, MIME Magic Byte, Tenant Isolation |
| **3. Concurrency & Idempotency** | [ ] Not Run | Race Condition DB Lock, Idempotency Restock, Double Submit, Inventory Release |
| **4. Performance** | [ ] Not Run | Notification < 60s, Bulk OOM, Search Debounce, Stats Bar Cache |
| **5. Mobile UX** | [ ] Not Run | 320px Cards, Sticky CTA, Word-wrap, Loading Skeleton |
| **6. [v2.2] Manual Payment Verification** | [ ] Not Run | 3-step async flow, magic link JWT, TTL auto-cancel, Reject reason, Reference Code |

> **Khuyen Nghi Release:** Tat ca 10 diem Checklist va 5 Quality Gates phai dat **100% Passed** truoc khi trien khai Production. Dac biet P0 Blockers: State Machine, IDOR, Idempotency, Price Integrity, Inventory Release.

---
**PHE DUYET BOI:** .................................... **NGAY:** ..../..../2026
