export type ImagePreview = {
  path: string;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
};
const imageKeys = new Set([
  "image",
  "backgroundImage",
  "logo",
  "avatar",
  "posterImage",
  "ogImage",
  "favicon",
]);
export function imagePreviews(
  field: string,
  serialized: string,
): ImagePreview[] {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    value = serialized;
  }
  const results: ImagePreview[] = [];
  function visit(value: unknown, path: string, isImage: boolean) {
    if (isImage) {
      const object =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      const raw = typeof value === "string" ? value : object.url;
      const url =
        typeof raw === "string" &&
        (/^https?:\/\//i.test(raw) || /^\/(?!\/)/.test(raw))
          ? raw
          : null;
      results.push({
        path,
        url,
        alt: typeof object.alt === "string" ? object.alt : "",
        width: typeof object.width === "number" ? object.width : null,
        height: typeof object.height === "number" ? object.height : null,
      });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, false));
      return;
    }
    if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value))
        visit(item, `${path}.${key}`, imageKeys.has(key));
  }
  visit(value, "$", imageKeys.has(field.split(".").at(-1) ?? ""));
  return results;
}
