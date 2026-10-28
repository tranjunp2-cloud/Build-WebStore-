import type { WorkLocale } from "./work-format";

/**
 * Words of the merchant's work queue in en / ms / vi. Templates only: every
 * `{}` comes from the item's facts. Rules (design §5, §5b): the raise line
 * (`say`) is facts + one question, never "I noticed", no emoji, no "!".
 */

/** Orders waiting to be confirmed: the oldest one carries the facts. */
export interface OrderVars {
	count: number;
	/** order number without "#" */
	no: string;
	customer?: string | null;
	/** "RM 86.00" */
	amount: string;
	/** "3 h" */
	age: string;
}

/** Products out of / low on stock. */
export interface StockVars {
	count: number;
	/** "Kopi O, Teh Tarik and 3 more" */
	names: string;
	/** the one product's name when count is 1 */
	first?: string;
}

export interface ShopKindCopy<V> {
	title: (v: V) => string;
	detail: (v: V) => string;
	fact: (v: V) => string;
	say: (v: V) => string;
	short: (v: V) => string;
	/** the message the assistant runs when the main button is pressed */
	prompt: string;
	promptLabel: string;
	linkLabel: string;
	taskTitle: (v: V) => string;
}

export interface WorkCopy {
	area: { orders: string; inventory: string; assistant: string; website: string; products: string; blog: string; customers: string };
	ordersToConfirm: ShopKindCopy<OrderVars>;
	outOfStock: ShopKindCopy<StockVars>;
	lowStock: ShopKindCopy<StockVars>;
	review: { title: (t: string) => string; detail: (n: number) => string; say: (t: string, n: number) => string; short: (t: string) => string; label: string };
	/** the run paused on a question: the question is the title and the message; the chat it came from is the detail */
	question: { title: (q: string) => string; detail: (t: string) => string; say: (t: string, q: string) => string; short: (t: string) => string; label: string };
	openEditor: string;
	/** what approving a waiting draft does, by the kind of change — the coloured fact of the row */
	approve: Record<ApproveKind, string>;
	/** a run paused on a question */
	waitsForAnswer: string;
	discounts: string;
}

/** The kinds of waiting drafts the queue words differently (from the change set's action kind). */
export type ApproveKind = "email" | "order" | "discount" | "category" | "product" | "blog" | "theme" | "website" | "other";

const who = (v: OrderVars, from: string) => (v.customer ? ` ${from} ${v.customer}` : "");
const facts = (v: OrderVars) => [`#${v.no}`, v.customer, v.amount].filter(Boolean).join(" · ");

const EN: WorkCopy = {
	area: { orders: "Orders", inventory: "Inventory", assistant: "Assistant", website: "Website", products: "Products", blog: "Blog", customers: "Customers" },
	ordersToConfirm: {
		title: (v) => (v.count === 1 ? `Order #${v.no} waiting to be confirmed` : `${v.count} orders waiting to be confirmed`),
		detail: (v) => (v.count === 1 ? facts(v) : `Oldest ${facts(v)}`),
		fact: (v) => `waiting ${v.age}`,
		say: (v) =>
			v.count === 1
				? `Order #${v.no}${who(v, "from")} (${v.amount}) has waited ${v.age}. Confirm it and let them know when it ships?`
				: `${v.count} orders are waiting to be confirmed. The oldest, #${v.no}${who(v, "from")}, has waited ${v.age}. Confirm them and let buyers know when they ship?`,
		short: (v) => (v.count === 1 ? `Confirm order #${v.no}, waiting ${v.age}` : `Confirm ${v.count} orders, oldest waiting ${v.age}`),
		prompt: "Show the orders waiting to be confirmed, oldest first, and help me confirm them.",
		promptLabel: "Help me confirm",
		linkLabel: "Open orders",
		taskTitle: (v) => (v.count === 1 ? `Confirm order #${v.no}` : `Confirm ${v.count} orders`),
	},
	outOfStock: {
		title: (v) => (v.count === 1 ? `${v.first ?? "1 product"} is out of stock` : `${v.count} products out of stock`),
		detail: (v) => v.names,
		fact: () => "buyers can't order",
		say: (v) =>
			v.count === 1 && v.first
				? `${v.first} is out of stock, so buyers see it but can't order. Restock it, or hide it for now?`
				: `${v.count} products on your store are out of stock, so buyers see them but can't order. Restock them, or hide them for now?`,
		short: (v) => (v.count === 1 && v.first ? `Restock or hide ${v.first}` : `Restock or hide ${v.count} products`),
		prompt: "Show my products that are out of stock and help me restock them, or hide the ones I won't restock.",
		promptLabel: "Help me restock",
		linkLabel: "Open stock",
		taskTitle: (v) => (v.count === 1 && v.first ? `Restock ${v.first}` : `Restock ${v.count} products`),
	},
	lowStock: {
		title: (v) => (v.count === 1 ? `${v.first ?? "1 product"} is running low` : `${v.count} products running low`),
		detail: (v) => v.names,
		fact: () => "10 or fewer left",
		say: (v) =>
			v.count === 1 && v.first
				? `${v.first} has 10 or fewer left. Want to see how fast it sells?`
				: `${v.count} products have 10 or fewer left. Want the list with how fast each sells?`,
		short: (v) => `Check ${v.count === 1 && v.first ? v.first : `${v.count} products`} running low`,
		prompt: "Show my products with 10 or fewer left, with how fast each one sells, so I can decide what to restock.",
		promptLabel: "Show the list",
		linkLabel: "Open stock",
		taskTitle: (v) => (v.count === 1 && v.first ? `Check stock of ${v.first}` : `Check ${v.count} products running low`),
	},
	review: {
		title: (t) => `Approve: ${t}`,
		detail: (n) => (n === 1 ? "1 change to approve" : `${n} changes to approve`),
		say: (t, n) =>
			n === 1
				? `${t} is ready. It goes out only after you approve it. Review it now?`
				: `${t} is ready, ${n} changes. They go out only after you approve them. Review them now?`,
		short: (t) => `Approve: ${t}`,
		label: "Review",
	},
	question: {
		title: (q) => q,
		detail: (t) => `In “${t}”`,
		say: (_t, q) => q,
		short: (t) => `A question in “${t}”`,
		label: "Answer",
	},
	openEditor: "Open editor",
	approve: {
		email: "the email is sent when you approve",
		order: "the buyer is waiting",
		discount: "goes live when you approve",
		category: "your shop changes when you approve",
		product: "not on your shop until you approve",
		blog: "not published until you approve",
		theme: "changes the live site when you approve",
		website: "nothing changes until you approve",
		other: "nothing changes until you approve",
	},
	waitsForAnswer: "the assistant is waiting for your answer",
	discounts: "Discounts",
};

const MS: WorkCopy = {
	area: { orders: "Pesanan", inventory: "Inventori", assistant: "Pembantu", website: "Laman web", products: "Produk", blog: "Blog", customers: "Pelanggan" },
	ordersToConfirm: {
		title: (v) => (v.count === 1 ? `Pesanan #${v.no} menunggu pengesahan` : `${v.count} pesanan menunggu pengesahan`),
		detail: (v) => (v.count === 1 ? facts(v) : `Paling lama ${facts(v)}`),
		fact: (v) => `menunggu ${v.age}`,
		say: (v) =>
			v.count === 1
				? `Pesanan #${v.no}${who(v, "daripada")} (${v.amount}) sudah menunggu ${v.age}. Sahkan dan beritahu mereka bila ia dihantar?`
				: `${v.count} pesanan menunggu pengesahan. Yang paling lama, #${v.no}${who(v, "daripada")}, sudah menunggu ${v.age}. Sahkan dan beritahu pembeli bila ia dihantar?`,
		short: (v) => (v.count === 1 ? `Sahkan pesanan #${v.no}, menunggu ${v.age}` : `Sahkan ${v.count} pesanan, paling lama ${v.age}`),
		prompt: "Tunjukkan pesanan yang menunggu pengesahan, yang paling lama dahulu, dan bantu saya mengesahkannya.",
		promptLabel: "Bantu saya sahkan",
		linkLabel: "Buka pesanan",
		taskTitle: (v) => (v.count === 1 ? `Sahkan pesanan #${v.no}` : `Sahkan ${v.count} pesanan`),
	},
	outOfStock: {
		title: (v) => (v.count === 1 ? `${v.first ?? "1 produk"} kehabisan stok` : `${v.count} produk kehabisan stok`),
		detail: (v) => v.names,
		fact: () => "pembeli tidak boleh pesan",
		say: (v) =>
			v.count === 1 && v.first
				? `${v.first} kehabisan stok, jadi pembeli nampak tetapi tidak boleh pesan. Tambah stok, atau sembunyikan buat masa ini?`
				: `${v.count} produk di kedai anda kehabisan stok, jadi pembeli nampak tetapi tidak boleh pesan. Tambah stok, atau sembunyikan buat masa ini?`,
		short: (v) => (v.count === 1 && v.first ? `Tambah stok atau sembunyikan ${v.first}` : `Tambah stok atau sembunyikan ${v.count} produk`),
		prompt: "Tunjukkan produk saya yang kehabisan stok dan bantu saya tambah stok, atau sembunyikan yang saya tidak akan tambah.",
		promptLabel: "Bantu saya tambah stok",
		linkLabel: "Buka stok",
		taskTitle: (v) => (v.count === 1 && v.first ? `Tambah stok ${v.first}` : `Tambah stok ${v.count} produk`),
	},
	lowStock: {
		title: (v) => (v.count === 1 ? `${v.first ?? "1 produk"} hampir habis` : `${v.count} produk hampir habis`),
		detail: (v) => v.names,
		fact: () => "tinggal 10 atau kurang",
		say: (v) =>
			v.count === 1 && v.first
				? `${v.first} tinggal 10 atau kurang. Mahu lihat kelajuan jualannya?`
				: `${v.count} produk tinggal 10 atau kurang. Mahu senarai dengan kelajuan jualan setiap satu?`,
		short: (v) => `Semak ${v.count === 1 && v.first ? v.first : `${v.count} produk`} yang hampir habis`,
		prompt: "Tunjukkan produk saya yang tinggal 10 atau kurang, dengan kelajuan jualan setiap satu, supaya saya boleh tentukan apa yang perlu ditambah.",
		promptLabel: "Tunjukkan senarai",
		linkLabel: "Buka stok",
		taskTitle: (v) => (v.count === 1 && v.first ? `Semak stok ${v.first}` : `Semak ${v.count} produk hampir habis`),
	},
	review: {
		title: (t) => `Luluskan: ${t}`,
		detail: (n) => `${n} perubahan untuk diluluskan`,
		say: (t, n) =>
			n === 1
				? `${t} sudah siap. Ia hanya digunakan selepas anda meluluskannya. Semak sekarang?`
				: `${t} sudah siap, ${n} perubahan. Ia hanya digunakan selepas anda meluluskannya. Semak sekarang?`,
		short: (t) => `Luluskan: ${t}`,
		label: "Semak",
	},
	question: {
		title: (q) => q,
		detail: (t) => `Dalam “${t}”`,
		say: (_t, q) => q,
		short: (t) => `Soalan dalam “${t}”`,
		label: "Jawab",
	},
	openEditor: "Buka editor",
	approve: {
		email: "e-mel dihantar selepas anda luluskan",
		order: "pembeli sedang menunggu",
		discount: "aktif selepas anda luluskan",
		category: "kedai berubah selepas anda luluskan",
		product: "belum di kedai sehingga anda luluskan",
		blog: "belum diterbitkan sehingga anda luluskan",
		theme: "laman langsung berubah selepas anda luluskan",
		website: "tiada perubahan sehingga anda luluskan",
		other: "tiada perubahan sehingga anda luluskan",
	},
	waitsForAnswer: "pembantu menunggu jawapan anda",
	discounts: "Diskaun",
};

const VI: WorkCopy = {
	area: { orders: "Đơn hàng", inventory: "Tồn kho", assistant: "Trợ lý", website: "Website", products: "Sản phẩm", blog: "Blog", customers: "Khách hàng" },
	ordersToConfirm: {
		title: (v) => (v.count === 1 ? `Đơn #${v.no} chờ xác nhận` : `${v.count} đơn chờ xác nhận`),
		detail: (v) => (v.count === 1 ? facts(v) : `Cũ nhất ${facts(v)}`),
		fact: (v) => `chờ ${v.age}`,
		say: (v) =>
			v.count === 1
				? `Đơn #${v.no}${who(v, "của")} (${v.amount}) đã chờ ${v.age}. Xác nhận và báo ngày giao nhé?`
				: `${v.count} đơn đang chờ xác nhận. Đơn lâu nhất, #${v.no}${who(v, "của")}, đã chờ ${v.age}. Xác nhận và báo ngày giao cho khách nhé?`,
		short: (v) => (v.count === 1 ? `Xác nhận đơn #${v.no}, chờ ${v.age}` : `Xác nhận ${v.count} đơn, lâu nhất chờ ${v.age}`),
		prompt: "Cho tôi xem các đơn đang chờ xác nhận, đơn cũ nhất trước, và giúp tôi xác nhận.",
		promptLabel: "Giúp tôi xác nhận",
		linkLabel: "Mở đơn hàng",
		taskTitle: (v) => (v.count === 1 ? `Xác nhận đơn #${v.no}` : `Xác nhận ${v.count} đơn`),
	},
	outOfStock: {
		title: (v) => (v.count === 1 ? `${v.first ?? "1 sản phẩm"} đã hết hàng` : `${v.count} sản phẩm hết hàng`),
		detail: (v) => v.names,
		fact: () => "khách không đặt được",
		say: (v) =>
			v.count === 1 && v.first
				? `${v.first} đã hết hàng, khách thấy mà không đặt được. Nhập thêm hay tạm ẩn?`
				: `${v.count} sản phẩm trên web đã hết hàng, khách thấy mà không đặt được. Nhập thêm hay tạm ẩn?`,
		short: (v) => (v.count === 1 && v.first ? `Nhập thêm hoặc ẩn ${v.first}` : `Nhập thêm hoặc ẩn ${v.count} sản phẩm`),
		prompt: "Cho tôi xem các sản phẩm đã hết hàng và giúp tôi nhập thêm, hoặc tạm ẩn những sản phẩm không nhập nữa.",
		promptLabel: "Giúp tôi nhập hàng",
		linkLabel: "Mở tồn kho",
		taskTitle: (v) => (v.count === 1 && v.first ? `Nhập thêm ${v.first}` : `Nhập thêm ${v.count} sản phẩm`),
	},
	lowStock: {
		title: (v) => (v.count === 1 ? `${v.first ?? "1 sản phẩm"} sắp hết` : `${v.count} sản phẩm sắp hết`),
		detail: (v) => v.names,
		fact: () => "còn 10 cái trở xuống",
		say: (v) =>
			v.count === 1 && v.first
				? `${v.first} còn 10 cái trở xuống. Xem tốc độ bán nhé?`
				: `${v.count} sản phẩm còn 10 cái trở xuống. Xem danh sách kèm tốc độ bán nhé?`,
		short: (v) => `Xem ${v.count === 1 && v.first ? v.first : `${v.count} sản phẩm`} sắp hết`,
		prompt: "Cho tôi xem các sản phẩm còn 10 cái trở xuống, kèm tốc độ bán của từng sản phẩm, để tôi quyết định nhập thêm.",
		promptLabel: "Xem danh sách",
		linkLabel: "Mở tồn kho",
		taskTitle: (v) => (v.count === 1 && v.first ? `Xem tồn kho ${v.first}` : `Xem ${v.count} sản phẩm sắp hết`),
	},
	review: {
		title: (t) => `Duyệt: ${t}`,
		detail: (n) => `${n} thay đổi cần duyệt`,
		say: (t, n) =>
			n === 1
				? `${t} đã soạn xong. Chỉ áp dụng khi bạn duyệt. Xem luôn nhé?`
				: `${t} đã soạn xong, ${n} thay đổi. Chỉ áp dụng khi bạn duyệt. Xem luôn nhé?`,
		short: (t) => `Duyệt: ${t}`,
		label: "Xem",
	},
	question: {
		title: (q) => q,
		detail: (t) => `Trong “${t}”`,
		say: (_t, q) => q,
		short: (t) => `Câu hỏi trong “${t}”`,
		label: "Trả lời",
	},
	openEditor: "Mở trình sửa",
	approve: {
		email: "email được gửi khi bạn duyệt",
		order: "khách đang chờ",
		discount: "chạy ngay khi bạn duyệt",
		category: "cửa hàng đổi khi bạn duyệt",
		product: "chưa lên cửa hàng cho tới khi bạn duyệt",
		blog: "chưa đăng cho tới khi bạn duyệt",
		theme: "đổi web đang chạy khi bạn duyệt",
		website: "chưa đổi gì cho tới khi bạn duyệt",
		other: "chưa đổi gì cho tới khi bạn duyệt",
	},
	waitsForAnswer: "trợ lý đang chờ bạn trả lời",
	discounts: "Giảm giá",
};

const COPY: Record<WorkLocale, WorkCopy> = { en: EN, ms: MS, vi: VI };

export function workCopy(locale: WorkLocale): WorkCopy {
	return COPY[locale] ?? EN;
}
