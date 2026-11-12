/**
 * The words of the questions the platform builds itself (family, variants,
 * photos) — in the language of the merchant's message, like the model's own
 * questions and reply. A Malay chat got English cards ("Which family is this
 * product in?", "Colours and sizes") between Malay sentences.
 */

export type FlowLanguage = "en" | "ms" | "vi";

export const FLOW_LANGUAGES: readonly FlowLanguage[] = ["en", "ms", "vi"];

type Copy = {
	family: { label: string; title: string; why: string };
	variants: { label: string; title: string; why: string; none: string; color: string; size: string; colorSize: string };
	photos: { label: string; productTitle: string; productWhy: string; postTitle: string; postWhy: string; count: (n: number) => string };
};

const COPY: Record<FlowLanguage, Copy> = {
	en: {
		family: {
			label: "Family",
			title: "Which family is this product in?",
			why: "The family decides which attributes are required to publish. From your catalog:",
		},
		variants: {
			label: "Variants",
			title: "Does it come in variants?",
			why: "Each variant gets its own SKU, price and stock. Type the options to list them.",
			none: "No, a single product",
			color: "Colours",
			size: "Sizes",
			colorSize: "Colours and sizes",
		},
		photos: {
			label: "Photos",
			productTitle: "Add product photos?",
			productWhy: "Products publish with at least one photo. Pick one from this chat or your library, or upload your own.",
			postTitle: "Which photos should the post use?",
			postWhy: "Pick a few, or upload your own. The first one becomes the cover.",
			count: (n) => (n === 1 ? "1 photo" : `${n} photos`),
		},
	},
	ms: {
		family: {
			label: "Keluarga",
			title: "Produk ini dalam keluarga yang mana?",
			why: "Keluarga menentukan atribut yang wajib diisi untuk disiarkan. Daripada katalog anda:",
		},
		variants: {
			label: "Varian",
			title: "Adakah produk ini mempunyai varian?",
			why: "Setiap varian ada SKU, harga dan stok sendiri. Taip pilihannya untuk menyenaraikannya.",
			none: "Tidak, satu produk sahaja",
			color: "Warna",
			size: "Saiz",
			colorSize: "Warna dan saiz",
		},
		photos: {
			label: "Foto",
			productTitle: "Tambah foto produk?",
			productWhy: "Produk disiarkan dengan sekurang-kurangnya satu foto. Pilih daripada sembang ini atau pustaka anda, atau muat naik sendiri.",
			postTitle: "Foto mana yang patut digunakan dalam catatan?",
			postWhy: "Pilih beberapa, atau muat naik sendiri. Foto pertama menjadi kulit.",
			count: (n) => `${n} foto`,
		},
	},
	vi: {
		family: {
			label: "Nhóm sản phẩm",
			title: "Sản phẩm này thuộc nhóm nào?",
			why: "Nhóm quyết định những thuộc tính bắt buộc để đăng bán. Từ danh mục của bạn:",
		},
		variants: {
			label: "Biến thể",
			title: "Sản phẩm có biến thể không?",
			why: "Mỗi biến thể có SKU, giá và tồn kho riêng. Gõ các lựa chọn để liệt kê.",
			none: "Không, một sản phẩm",
			color: "Màu",
			size: "Size",
			colorSize: "Màu và size",
		},
		photos: {
			label: "Ảnh",
			productTitle: "Thêm ảnh sản phẩm?",
			productWhy: "Sản phẩm cần ít nhất một ảnh để đăng. Chọn ảnh trong cuộc trò chuyện này hoặc thư viện, hoặc tải ảnh của bạn lên.",
			postTitle: "Bài viết dùng những ảnh nào?",
			postWhy: "Chọn vài ảnh, hoặc tải ảnh của bạn lên. Ảnh đầu tiên làm ảnh bìa.",
			count: (n) => `${n} ảnh`,
		},
	},
};

/** The language a flow speaks: what the model said the merchant writes in, else the UI locale, else English. */
export function flowLanguage(declared: string | null | undefined, uiLocale: string | undefined): FlowLanguage {
	const pick = (value: string | null | undefined) => {
		const code = value?.slice(0, 2).toLowerCase();
		return FLOW_LANGUAGES.find((language) => language === code);
	};
	return pick(declared) ?? pick(uiLocale) ?? "en";
}

export function flowCopy(language: FlowLanguage | undefined): Copy {
	return COPY[language ?? "en"];
}
