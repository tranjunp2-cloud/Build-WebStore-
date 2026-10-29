import type { ChatSuggestion } from "@ech/agent-ui";

type Starters = Record<string, ChatSuggestion[]>;

/**
 * ≤3 starters per page on a new chat; the first one is what that page is for.
 * Static on purpose: no model call, and only things the copilot's tools can do
 * (blog posts, the shop's own products, pictures). Keyed by the page's module.
 */
const STORE_EN: ChatSuggestion[] = [
	{ icon: "image-plus", label: "Create a product from photos", prompt: "Create a product from the photos I attach." },
	{ icon: "package", label: "Which products have no photos?" },
	{ icon: "package", label: "Which products have no description?" },
];
const STORE_MS: ChatSuggestion[] = [
	{ icon: "image-plus", label: "Cipta produk daripada foto", prompt: "Cipta produk daripada foto yang saya lampirkan." },
	{ icon: "package", label: "Produk mana yang belum ada foto?" },
	{ icon: "package", label: "Produk mana yang belum ada penerangan?" },
];
const STORE_VI: ChatSuggestion[] = [
	{ icon: "image-plus", label: "Tạo sản phẩm từ ảnh", prompt: "Tạo sản phẩm từ những ảnh mình đính kèm." },
	{ icon: "package", label: "Sản phẩm nào chưa có ảnh?" },
	{ icon: "package", label: "Sản phẩm nào chưa có mô tả?" },
];

const STARTERS: Record<"en" | "ms" | "vi", Starters> = {
	en: {
		blog: [
			{ icon: "newspaper", label: "Write a blog post with images" },
			{ icon: "newspaper", label: "Write a blog post about caring for batik fabric" },
			{ icon: "images", label: "Use pictures from my library in a post" },
		],
		store: STORE_EN,
		products: STORE_EN,
		default: [
			{ icon: "image-plus", label: "Create a product from photos", prompt: "Create a product from the photos I attach." },
			{ icon: "newspaper", label: "Write a blog post with images" },
		],
	},
	ms: {
		blog: [
			{ icon: "newspaper", label: "Tulis catatan blog bersama gambar" },
			{ icon: "newspaper", label: "Tulis catatan blog tentang penjagaan kain batik" },
			{ icon: "images", label: "Guna gambar daripada pustaka saya dalam catatan" },
		],
		store: STORE_MS,
		products: STORE_MS,
		default: [
			{ icon: "image-plus", label: "Cipta produk daripada foto", prompt: "Cipta produk daripada foto yang saya lampirkan." },
			{ icon: "newspaper", label: "Tulis catatan blog bersama gambar" },
		],
	},
	vi: {
		blog: [
			{ icon: "newspaper", label: "Viết bài blog kèm hình ảnh" },
			{ icon: "newspaper", label: "Viết bài blog về cách bảo quản vải batik" },
			{ icon: "images", label: "Dùng ảnh trong thư viện của mình cho bài viết" },
		],
		store: STORE_VI,
		products: STORE_VI,
		default: [
			{ icon: "image-plus", label: "Tạo sản phẩm từ ảnh", prompt: "Tạo sản phẩm từ những ảnh mình đính kèm." },
			{ icon: "newspaper", label: "Viết bài blog kèm hình ảnh" },
		],
	},
};

/** Starters for the page the merchant is on, in their UI language. */
export function agentStarters(module: string, locale: string): ChatSuggestion[] {
	const table = STARTERS[locale.slice(0, 2) as keyof typeof STARTERS] ?? STARTERS.en;
	return table[module] ?? table.default ?? [];
}
