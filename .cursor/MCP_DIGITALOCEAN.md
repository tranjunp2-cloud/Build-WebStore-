# DigitalOcean MCP — Cài đặt cho Cursor

MCP (Model Context Protocol) của DigitalOcean cho phép quản lý App Platform, Databases, Droplets, Spaces… bằng ngôn ngữ tự nhiên trong Cursor.

## 1. Đã thêm vào `.cursor/mcp.json`

Server `digitalocean` đã được cấu hình với:

- **Services:** `apps`, `databases` (App Platform + Managed Databases).
- **Token:** Cần thay `"<DO_API_TOKEN>"` bằng API token thật.

## 2. Lấy API token và cấu hình

1. Vào [DigitalOcean → API](https://cloud.digitalocean.com/account/api/tokens) → **Generate New Token**.
2. Đặt tên (vd. `cursor-mcp`), quyền **Read + Write** (hoặc tối thiểu theo nhu cầu).
3. Mở **`.cursor/mcp.json`**, tìm `digitalocean` → trong `env` đổi:
   ```json
   "DIGITALOCEAN_API_TOKEN": "<DO_API_TOKEN>"
   ```
   thành token vừa tạo (hoặc dùng biến môi trường nếu Cursor hỗ trợ).

4. **Bảo mật:** Không commit token vào git. Có thể:
   - Giữ token trong `mcp.json` và thêm `.cursor/mcp.json` vào `.gitignore` (nếu không share config), hoặc
   - Dùng file riêng `mcp.local.json` (merge thủ công) và không commit file đó.

5. **Restart Cursor** để load MCP mới.

## 3. Thêm/bớt services

Trong `args`, sửa `--services`:

- Chỉ App Platform: `"--services", "apps"`
- Thêm Droplets, Spaces: `"--services", "apps", "databases", "droplets", "spaces"`

Danh sách: `accounts`, `apps`, `databases`, `droplets`, `insights`, `marketplace`, `networking`, `spaces`. Xem [GitHub @digitalocean-labs/mcp-digitalocean](https://github.com/digitalocean-labs/mcp-digitalocean).

## 4. Ví dụ dùng trong Cursor

Sau khi bật MCP và có token:

- “List my App Platform apps”
- “Create a PostgreSQL database named staging-db”
- “Show me deployment logs for app X”
- “Check SSL certificate status for my domain”

---

**Nguồn:** [DigitalOcean MCP Server (blog)](https://www.digitalocean.com/blog/mcp-server-public-release), [GitHub mcp-digitalocean](https://github.com/digitalocean-labs/mcp-digitalocean).
