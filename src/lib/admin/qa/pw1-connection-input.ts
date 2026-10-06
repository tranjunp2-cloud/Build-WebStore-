/** Only test credentials against the PW1 endpoint already approved on the server. */
export function parsePw1ConnectionInput(input: unknown, configuredUrl: string | undefined) {
  if (!configuredUrl) throw new Error("Server chưa cấu hình PW1_DATABASE_URL.");
  const approved = new URL(configuredUrl);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Thông tin kết nối không hợp lệ.");
  }
  const value = input as Record<string, unknown>;
  let host: unknown = value.host;
  let port: unknown = value.port ?? 3306;
  let user: unknown = value.user;
  let password: unknown = value.password ?? "";
  let database: unknown = value.database;
  if (typeof value.url === "string") {
    const url = new URL(value.url);
    if (url.protocol !== "mysql:" || url.search || url.hash) {
      throw new Error("URL phải có dạng mysql://user:password@host:port/database, không có query hoặc fragment.");
    }
    host = url.hostname;
    port = Number(url.port || 3306);
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  }
  if (typeof host !== "string" || host.toLowerCase() !== approved.hostname.toLowerCase() || port !== Number(approved.port || 3306)) {
    throw new Error("Host và Port phải khớp endpoint PW1 đã cấu hình trên server. Liên hệ quản trị viên nếu cần đổi server DB.");
  }
  if (typeof user !== "string" || !user || user.length > 256 || typeof password !== "string" || password.length > 2048 || typeof database !== "string" || !database || database.length > 64) {
    throw new Error("Vui lòng nhập User, Password hợp lệ và tên Database.");
  }
  return { host: approved.hostname, port: Number(approved.port || 3306), user, password, database };
}
