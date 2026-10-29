/**
 * A pictures question the merchant skipped ("Skip, add later") means no new photos for now. The model must not then
 * draw an AI picture for that item in the same run (an image call the merchant just declined, and an illustration
 * that reads as a product photo) unless the merchant's own words ask for a generated picture.
 */

/** The merchant asks for a generated / AI picture (English, Malay, Vietnamese). */
const GENERATED_PICTURE_ASKED =
	/\b(generate|generated|generating|ai[- ]?(image|picture|photo|generated)|illustrat\w*|draw|jana\w*|lukis\w*)\b|\b(create|make|buat)\s+(me\s+)?(an?\s+)?(image|picture|photo|gambar|imej)\b|tạo ảnh|vẽ/iu;

/** What the model is told when it asks for a picture after the merchant skipped the pictures question; null = go ahead. */
export function picturesSkippedRefusal(skipped: boolean | undefined, merchantText: string): { images: []; error: { code: string; message: string } } | null {
	if (!skipped || GENERATED_PICTURE_ASKED.test(merchantText)) return null;
	return {
		images: [],
		error: {
			code: "pictures_skipped",
			message:
				"The merchant skipped the pictures question: no new pictures for now. Do not generate a picture in this request. Continue without photos (a placeholder shows until they add their own) and say so in one line; they can ask for a generated picture later.",
		},
	};
}
