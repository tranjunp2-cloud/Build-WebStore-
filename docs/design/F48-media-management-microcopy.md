# F48 Media Management — Microcopy (en / ms)

> **Status:** Draft · **Updated:** 2026-11-09 · **Owner:** Design / Dev
> **Tách từ:** [Design & UI Spec §8](./F48-media-management-design.md#8-microcopy-en--ms) (giữ nguyên số mục §8.x để tham chiếu cũ vẫn đúng). Màn hình S1–S10 xem file design.
> **Liên quan:** [PRD tổng](../prd/F48-media-management-overview.md) · [Stories](../stories/F48-media-management-stories.md) · [QA](../qa/F48-media-management.md)

---

## 8. Microcopy (en / ms)

### 8.0 Quy ước key

- File i18n: `src/i18n/locales/en.json` + `ms.json` (kiểm khoá thiếu bằng TC-F48-05-07). Key **camelCase** theo repo; cột Key ghi **đường dẫn đầy đủ**.
- Namespace: `mediaLibrary` (đã có — giữ key cũ, chỉ sửa giá trị khi ghi rõ), `mediaPicker` (mới), `mediaFolders` (mới), `mediaErrors` (mới, §8.2.1). Chuỗi ở màn khác đặt vào namespace sẵn có của màn đó: `dashboard.products.form.*`, `dashboard.products.categories.form.*`, `editor.mediaField.*`, `Staff.drawer.features.media`.
- Ngoại lệ có chủ đích: `mediaErrors.<CODE>` dùng nguyên mã lỗi API (UPPER_SNAKE) làm key để client tra thẳng theo `code`.
- Mục sidebar **không** dùng file i18n: label khai inline trong `src/config/sidebar-nav.ts` (kiểu `{ en, ms }`). PO đã duyệt (D13, D88): `{ en: 'Media', ms: 'Media' }` nhóm **Online Store** sau Blog, icon `Images`, `permissionId: 'media'`. Không thêm mục Settings; giữ link `mediaPicker.manageLibrary` ở footer picker làm lối vào phụ (design S3).
- Biến: `{name}`, `{count}`, `{size}`, `{max}`, `{used}`, `{limit}`, `{percent}`, `{folder}`, `{parent}`, `{done}`, `{total}`, `{ok}`, `{failed}`, `{date}`, `{user}`.
- Dung lượng (FR-33d, design §4): thập phân 1 chữ số, dấu chấm cả en và ms (thống nhất F21): "1.2 of 2 GB used" / "1.2 daripada 2 GB digunakan".
- Mọi chuỗi ms cần người bản ngữ (CS/PO) duyệt trước merge (design Q7).

### 8.1 Nhãn chính

| Key | en | ms |
|---|---|---|
| `mediaLibrary.title` (có sẵn) | Media library | Pustaka media |
| `mediaLibrary.subtitle` | Images, videos and files for your store | Imej, video dan fail untuk kedai anda |
| `mediaLibrary.upload` (có sẵn) | Upload | Muat naik |
| `mediaLibrary.dropHere` | Drop to upload to {folder} | Lepaskan untuk muat naik ke {folder} |
| `mediaLibrary.searchPlaceholder` (có sẵn) | Search files... | Cari fail... |
| `mediaLibrary.filterAll` / `filterImages` / `filterVideos` (có sẵn) | All / Images / Videos | Semua / Imej / Video |
| `mediaLibrary.filterPdf` (có sẵn) | — **bỏ** (thư viện không còn PDF; biên lai ở luồng private) | — |
| `mediaLibrary.filterUnused` | Unused only | Tidak digunakan sahaja |
| `mediaLibrary.sortNewest` / `sortOldest` / `sortName` / `sortLargest` | Newest / Oldest / Name A–Z / Largest | Terbaru / Terlama / Nama A–Z / Terbesar |
| `mediaLibrary.viewGrid` / `viewList` | Grid / List | Grid / Senarai |
| `mediaLibrary.allMedia` / `unfiled` | All media / Unfiled | Semua media / Tanpa folder |
| `mediaLibrary.selectedCount` | {count} selected | {count} dipilih |
| `mediaLibrary.moveTo` | Move to… | Pindah ke… |
| `mediaLibrary.copyUrl` (có sẵn) / `copyUrls` | Copy URL / Copy URLs | Salin URL / Salin URL |
| `mediaLibrary.delete` (có sẵn) | Delete | Padam |
| `mediaLibrary.clearSelection` | Clear selection | Kosongkan pilihan |
| `mediaLibrary.name` / `altText` (có sẵn) / `caption` | Name / Alt text / Caption (optional) | Nama / Teks alt / Kapsyen (pilihan) |
| `mediaLibrary.altHelp` | Describe the image for shoppers using screen readers | Terangkan imej untuk pembeli yang menggunakan pembaca skrin |
| `mediaLibrary.usedIn` | Used in ({count}) | Digunakan di ({count}) |
| `mediaLibrary.notUsed` | Not used anywhere | Tidak digunakan di mana-mana |
| `mediaLibrary.badgeUnused` / `badgeInUse` | Unused / In use · {count} | Tidak digunakan / Digunakan · {count} |
| `mediaLibrary.badgeNoAlt` / `badgeLegacy` / `badgeAi` / `badgeVideo` | No alt / Legacy / AI / Video | Tiada alt / Lama / AI / Video |
| `mediaLibrary.save` / `cancel` / `saved` | Save / Cancel / Changes saved | Simpan / Batal / Perubahan disimpan |
| `mediaLibrary.discardChanges` | Discard unsaved changes? | Buang perubahan yang belum disimpan? |
| `mediaLibrary.storageUsed` | {used} of {limit} used | {used} daripada {limit} digunakan |
| `mediaLibrary.storageUsedUnlimited` | {used} used | {used} digunakan |
| `mediaPicker.title` | Choose image | Pilih imej |
| `mediaPicker.tabUpload` / `tabLibrary` / `tabUrl` | Upload / Library / From URL | Muat naik / Pustaka / Daripada URL |
| `mediaPicker.select` | Select ({count}) | Pilih ({count}) |
| `mediaPicker.maxReached` | Maximum {max} reached | Maksimum {max} dicapai |
| `mediaPicker.added` | Added | Ditambah |
| `mediaPicker.chooseFromPhone` | Choose from phone | Pilih daripada telefon |
| `mediaPicker.uploadTo` | Upload to | Muat naik ke |
| `mediaPicker.hint` | Up to {max} · JPG, PNG, WEBP · max {size} each | Sehingga {max} · JPG, PNG, WEBP · maks {size} setiap satu |
| `mediaPicker.urlLabel` | Image URL | URL imej |
| `mediaPicker.urlImport` / `urlImporting` | Import / Importing… | Import / Mengimport… |
| `mediaPicker.urlHelp` | We'll copy the image into your library. Only public HTTPS links. | Kami akan menyalin imej ke pustaka anda. Pautan HTTPS awam sahaja. |
| `mediaPicker.manageLibrary` (D13) | Manage library | Urus pustaka |
| `mediaFolders.new` / `rename` / `delete` | New folder / Rename / Delete folder | Folder baharu / Namakan semula / Padam folder |
| `mediaFolders.inside` | Inside | Di dalam |
| `mediaFolders.moveContents` | Move contents to "{parent}", then delete | Pindahkan kandungan ke "{parent}", kemudian padam |
| `mediaFolders.neverDeletesFiles` | Files are never deleted here. | Fail tidak akan dipadam di sini. |
| `dashboard.products.form.images` (có sẵn) | Product images | Imej produk |
| `dashboard.products.form.gallery.main` / `setMain` | Main / Set as main | Utama / Jadikan utama |
| `dashboard.products.form.gallery.reorderHint` | Drag to reorder. The first image is the main image shown in listings. | Seret untuk susun semula. Imej pertama ialah imej utama dalam senarai. |
| `dashboard.products.form.gallery.removeFromProduct` | Remove from product | Buang daripada produk |
| `dashboard.products.form.gallery.removeNote` | The image stays in your media library. | Imej kekal dalam pustaka media anda. |
| `dashboard.products.form.variantImage.useMain` | Use main image (default) | Guna imej utama (lalai) |
| `dashboard.products.form.variantImage.addFirst` | Add product images first | Tambah imej produk dahulu |
| `dashboard.products.categories.form.image` | Category image (optional) | Imej kategori (pilihan) |
| `editor.mediaField.replace` / `remove` | Replace / Remove | Ganti / Buang |
| `editor.mediaField.altWarning` | Add alt text for SEO and accessibility | Tambah teks alt untuk SEO dan kebolehcapaian |
| `Staff.drawer.features.media` | Media | Media |
| `Staff.drawer.features.mediaDesc` | Manage the media library: folders, details and deleting unused files | Urus pustaka media: folder, butiran dan memadam fail yang tidak digunakan |

### 8.2 Lỗi & thông báo

> Key = `mediaErrors.<mã lỗi API>` (bảng lỗi PRD S0–S5 là chuẩn; chuỗi dưới đây chép nguyên từ PRD). Client map `code` → chuỗi; `{name}` (tên file) được UI ghép thêm phía trước khi lỗi thuộc 1 file trong hàng đợi. Không hard-code chuỗi trong component (design P7).

#### 8.2.1 Mã lỗi API

| Sprint | Mã | HTTP | en | ms |
|---|---|---|---|---|
| S0 | `MEDIA_UNAUTHORIZED` | 401 | Please sign in again. | Sila log masuk semula. |
| S0 | `MEDIA_FORBIDDEN` | 403 | You don't have permission to manage media. | Anda tiada kebenaran untuk mengurus media. |
| S0 | `MEDIA_NOT_FOUND` | 404 | File not found. | Fail tidak ditemui. |
| S0 | `MEDIA_FIELD_READONLY` | 400 | This field can't be changed. | Medan ini tidak boleh diubah. |
| S0 | `MEDIA_UNSUPPORTED_TYPE` | 415 | This file type isn't supported. Please convert it to PNG, WebP or JPEG (images) or use MP4/WebM (videos). | Jenis fail ini tidak disokong. Sila tukar kepada PNG, WebP atau JPEG (imej) atau gunakan MP4/WebM (video). |
| S0 | `MEDIA_CONTENT_MISMATCH` | 415 | File content does not match its type. | Kandungan fail tidak sepadan dengan jenisnya. |
| S0 | `MEDIA_VALIDATION` | 400 | Alt text: max 250 characters. Caption: max 500. Name: max 120. | Teks alt: maksimum 250 aksara. Kapsyen: maksimum 500. Nama: maksimum 120. |
| S0 | `MEDIA_TOO_LARGE` | 413 | File is too large. Maximum {limit} for {kind}. | Fail terlalu besar. Maksimum {limit} untuk {kind}. |
| S0 | `MEDIA_RATE_LIMITED` | 429 | Too many uploads, try again in {seconds} seconds. | Terlalu banyak muat naik, cuba lagi dalam {seconds} saat. |
| S0 | `MEDIA_KEY_INVALID` | 400/409 | We couldn't verify this upload. Please try again. | Muat naik ini tidak dapat disahkan. Sila cuba lagi. |
| S0 | `MEDIA_UPLOAD_EXPIRED` | 400/403 | The upload link expired. Please try again. | Pautan muat naik telah tamat tempoh. Sila cuba lagi. |
| S0 | `MEDIA_STORAGE_UNAVAILABLE` | 503 | Storage is temporarily unavailable. Please try again. | Storan tidak tersedia buat sementara. Sila cuba lagi. |
| S1 | `MEDIA_INVALID_FILE` | 422 | We couldn't read this image. It may be damaged — try another file. | Kami tidak dapat membaca imej ini. Ia mungkin rosak — cuba fail lain. |
| S1 | `MEDIA_TOO_MANY_PIXELS` | 422 | This image is too large (over 50 megapixels). Please resize it and try again. | Imej ini terlalu besar (melebihi 50 megapiksel). Sila kecilkan saiznya dan cuba lagi. |
| S1 | `MEDIA_PROCESSING_FAILED` | 500 | We couldn't process this file. Please try again. | Kami tidak dapat memproses fail ini. Sila cuba lagi. |
| S1 | `MEDIA_UPLOAD_MISSING` | 404 | This file is unavailable. Remove its stale library entry if present, then upload a new version. | Fail ini tidak tersedia. Alih keluar entri pustaka lama jika ada, kemudian muat naik versi baharu. |
| S1 | `MEDIA_BULK_LIMIT` | 400 | You can delete up to 100 files at a time. | Anda boleh memadam sehingga 100 fail pada satu masa. |
| S1 | `MEDIA_REGISTER_IN_PROGRESS` | 409 | This file is still being processed. Please wait a moment. | Fail ini masih diproses. Sila tunggu sebentar. |
| S1 | `MEDIA_PROCESSING_TIMEOUT` | 504 | Processing took too long. Please try a smaller file. | Pemprosesan mengambil masa terlalu lama. Sila cuba fail yang lebih kecil. |
| S2 | `MEDIA_URL_INVALID` | 400 | Only HTTPS image links are supported. | Hanya pautan imej HTTPS disokong. |
| S2 | `MEDIA_URL_BLOCKED` | 400 | This link cannot be imported. | Pautan ini tidak boleh diimport. |
| S2 | `MEDIA_URL_FETCH_FAILED` | 422 | We couldn't download an image from this link. Try downloading it and uploading instead. | Kami tidak dapat memuat turun imej daripada pautan ini. Cuba muat turun dan muat naik sendiri. |
| S2 | `MEDIA_URL_TIMEOUT` | 504 | The link took too long to respond. | Pautan mengambil masa terlalu lama untuk bertindak balas. |
| S2 | `MEDIA_INVALID_REFERENCE` | 400 | Invalid media reference. | Rujukan media tidak sah. |
| S2 | `MEDIA_PICKER_MAX` | client | You can select up to {max} files. | Anda boleh memilih sehingga {max} fail. |
| S2 | `MEDIA_PICKER_TYPE` | client | This file type can't be used here. | Jenis fail ini tidak boleh digunakan di sini. |
| S3 | `MEDIA_FOLDER_DEPTH_EXCEEDED` | 422 | Folders can be nested up to 5 levels. | Folder hanya boleh bersarang sehingga 5 tahap. |
| S3 | `MEDIA_FOLDER_LIMIT_REACHED` | 422 | You can have up to 200 folders. | Anda boleh mempunyai sehingga 200 folder. |
| S3 | `MEDIA_FOLDER_NAME_INVALID` | 422 | Folder name must be 1–60 characters and cannot contain / \ < >. | Nama folder mesti 1–60 aksara dan tidak boleh mengandungi / \ < >. |
| S3 | `MEDIA_FOLDER_NAME_TAKEN` | 409 | A folder with this name already exists here. | Folder dengan nama ini sudah wujud di sini. |
| S3 | `MEDIA_FOLDER_CYCLE` | 422 | A folder cannot be moved into itself or its subfolders. | Folder tidak boleh dipindahkan ke dalam dirinya sendiri atau subfoldernya. |
| S3 | `MEDIA_FOLDER_NOT_EMPTY` | 409 | This folder is not empty. Move its contents up first. | Folder ini tidak kosong. Pindahkan kandungannya ke atas dahulu. |
| S3 | `MEDIA_FOLDER_NOT_FOUND` | 404 | Folder not found. | Folder tidak ditemui. |
| S3 | `MEDIA_MOVE_TOO_MANY` | 422 | You can move up to 100 items at a time. | Anda boleh memindahkan sehingga 100 item pada satu masa. |
| S4 | `MEDIA_IN_USE` | 409 | This file is in use. Remove it from these places first. | Fail ini sedang digunakan. Alihkan dari tempat berikut dahulu. |
| S4 | `MEDIA_FORCE_DELETE_OWNER_ONLY` | 403 | Only the shop owner can delete a file that is in use. | Hanya pemilik kedai boleh memadam fail yang sedang digunakan. |
| S4 | `MEDIA_FORCE_DELETE_FORBIDDEN` | 409 | Files used by orders can't be deleted. | Fail yang digunakan oleh pesanan tidak boleh dipadam. |
| S4 | `MEDIA_USAGE_SCAN_FAILED` | 503 | We couldn't check where this file is used. Try again. | Kami tidak dapat menyemak di mana fail ini digunakan. Cuba lagi. |
| S4 | `MEDIA_QUOTA_EXCEEDED` | 413 | Storage full. Delete unused files or upgrade your plan. | Storan penuh. Padam fail yang tidak digunakan atau naik taraf pelan anda. |
| S5 | `PRODUCT_IMAGES_TOO_MANY` | 400 | Up to 10 images per product. | Maksimum 10 imej bagi setiap produk. |
| S5 | `PRODUCT_IMAGES_DUPLICATE` | 400 | This image is already in the gallery. | Imej ini sudah ada dalam galeri. |
| S5 | `PRODUCT_IMAGES_INVALID` | 400 | Only images from your media library can be added. | Hanya imej daripada pustaka media anda boleh ditambah. |
| S5 | `PRODUCT_IMAGES_INVALID` (`reason` `type`/`size`, D84) | 400 | Product images must be JPG, PNG or WebP up to 3 MB. | Imej produk mesti JPG, PNG atau WebP, maksimum 3 MB. |
| S5 | `VARIANT_IMAGE_NOT_IN_GALLERY` | 400 | A variant image must be one of the product images. | Imej varian mesti salah satu imej produk. |
| S5 | `CATEGORY_IMAGE_INVALID` | 400 | Choose an image from your media library. | Pilih imej daripada pustaka media anda. |
| S5 | `HALAL_CERT_IMAGE_ONLY` | 400 | Halal certificate must be an image (JPEG, PNG or WebP). | Sijil halal mesti dalam bentuk imej (JPEG, PNG atau WebP). |

Tổng: 45 mã (gồm 2 mã chỉ ở client). Không thêm mã mới trong lượt này; mã mới (nếu có) theo bảng lỗi PRD/architecture.

#### 8.2.2 Thông báo chỉ ở UI (không phải mã API)

| Key | en | ms |
|---|---|---|
| `mediaLibrary.duplicateReused` | {name} is already in your library — we reused it. | {name} sudah ada dalam pustaka anda — kami guna semula. |
| `mediaLibrary.animatedFlattened` | {name} is animated. It will be saved as a still image (first frame). | {name} ialah imej animasi. Ia akan disimpan sebagai imej pegun (bingkai pertama). |
| `mediaPicker.uploadContinues` | Upload continues in your media library. It won't be added here. | Muat naik diteruskan dalam pustaka media anda. Ia tidak akan ditambah di sini. |
| `mediaLibrary.uploadNetwork` | Upload interrupted. Check your connection and try again. | Muat naik terganggu. Semak sambungan anda dan cuba lagi. |
| `mediaLibrary.offline` | You're offline. Uploads will need to be retried. | Anda di luar talian. Muat naik perlu dicuba semula. |
| `mediaLibrary.quotaFull` (banner) | Storage full. Uploads are paused. | Storan penuh. Muat naik dijeda. |
| `mediaLibrary.quotaWarning` | You've used {percent}% of your storage. Delete unused files or upgrade your plan. | Anda telah guna {percent}% storan. Padam fail tidak digunakan atau naik taraf pelan anda. |
| `mediaLibrary.forbiddenEditOther` | You can only edit files you uploaded. Ask the store owner for Media access. | Anda hanya boleh edit fail yang anda muat naik. Minta akses Media daripada pemilik kedai. |
| `mediaLibrary.deleteConfirmTitle` | Delete {count} file(s)? | Padam {count} fail? |
| `mediaLibrary.deleteIrreversible` | This can't be undone. | Tindakan ini tidak boleh dibatalkan. |
| `mediaLibrary.deleteInUse` | {inUse} of {count} files are in use and will be kept | {inUse} daripada {count} fail sedang digunakan dan akan disimpan |
| `mediaLibrary.deleteInUseEffect` | Product and blog fields will be cleared; page blocks will show a broken image. | Medan produk dan blog akan dikosongkan; blok halaman akan memaparkan imej rosak. |
| `mediaLibrary.deleteUnderstand` | I understand | Saya faham |
| `mediaLibrary.deleteUnusedOnly` | Delete only {count} unused | Padam {count} yang tidak digunakan sahaja |
| `mediaLibrary.deleteAnyway` | Delete anyway | Padam juga |
| `mediaLibrary.deleteOrderLocked` | Used by orders — this file can't be deleted. | Digunakan oleh pesanan — fail ini tidak boleh dipadam. |
| `mediaLibrary.deletePaymentQrLocked` (D78) | This is your active payment QR — replace it in Payments first. | Ini QR pembayaran aktif anda — gantikan dalam Pembayaran dahulu. |
| `mediaLibrary.deleted` | {count} file(s) deleted | {count} fail dipadam |
| `mediaLibrary.deletePartial` | {ok} deleted, {failed} kept (in use or not allowed) | {ok} dipadam, {failed} disimpan (sedang digunakan atau tidak dibenarkan) |
| `mediaLibrary.loadFailed` (có sẵn, giữ) | Couldn't load your media. Please refresh and try again. | Gagal memuatkan media anda. Sila muat semula dan cuba lagi. |
| `mediaLibrary.deleteLocked` (có sẵn) | — **bỏ** khi D19 thay thế ("older file") | — |

### 8.3 Chuỗi bổ sung từ wireframe (trước đây chỉ có trong khung vẽ)

| Key | Màn | en | ms |
|---|---|---|---|
| `mediaLibrary.emptyTitle` (có sẵn, giữ) | S1 empty tenant | No media files yet | Belum ada fail media |
| `mediaLibrary.emptyDescription` (có sẵn, **sửa** — bỏ PDF) | S1 empty tenant | Upload images or videos to get started | Muat naik imej atau video untuk bermula |
| `mediaLibrary.uploadFiles` (có sẵn) | S1 empty tenant | Upload files | Muat naik fail |
| `mediaLibrary.orDragDrop` | S1 empty tenant | or drag and drop here | atau seret dan lepas di sini |
| `mediaLibrary.noMatch` (có sẵn) | S1/S3 không khớp tìm/lọc | No files match your search | Tiada fail sepadan dengan carian anda |
| `mediaLibrary.clearFilters` | S1/S3 không khớp | Clear filters | Kosongkan penapis |
| `mediaLibrary.folderEmpty` | S1 thư mục rỗng | This folder is empty | Folder ini kosong |
| `mediaLibrary.uploadHere` / `moveFilesHere` | S1 thư mục rỗng | Upload here / Move files here | Muat naik di sini / Pindahkan fail ke sini |
| `mediaLibrary.unusedEmpty` | S1 lọc Unused rỗng | Every file is in use. Nice and tidy! | Semua fail sedang digunakan. Kemas dan teratur! |
| `mediaLibrary.tryAgain` | S1/S2/S3 lỗi tải | Try again | Cuba lagi |
| `mediaLibrary.selectMode` | S1 mobile menu `⋯` | Select | Pilih |
| `mediaLibrary.includeSubfolders` | S1 toolbar thư mục | Include subfolders | Termasuk subfolder |
| `mediaLibrary.uploadedBy` | S2 meta | Uploaded {date} by {user} | Dimuat naik {date} oleh {user} |
| `mediaLibrary.folderLabel` / `move` | S2 meta | Folder / Move | Folder / Pindah |
| `mediaLibrary.savedAsStill` | S2 ảnh động | Saved as a still image | Disimpan sebagai imej pegun |
| `mediaLibrary.createdByAi` | S2 media AI | Created by AI | Dicipta oleh AI |
| `mediaLibrary.usageByUrlNote` | S2 Used in | Usage of older blocks is detected by URL. | Penggunaan blok lama dikesan melalui URL. |
| `mediaLibrary.download` / `openInNewTab` | S2 menu `⋯` | Download / Open in new tab | Muat turun / Buka dalam tab baharu |
| `mediaLibrary.previewUnavailable` | MediaCard lỗi thumb | Preview unavailable | Pratonton tidak tersedia |
| `mediaLibrary.fileDeletedElsewhere` | S2 (E6) | This file was deleted | Fail ini telah dipadam |
| `mediaLibrary.foldersNotUploadable` | S1 (E2) | Folders can't be uploaded — select the files inside. | Folder tidak boleh dimuat naik — pilih fail di dalamnya. |
| `mediaLibrary.heicHint` | S1/S3 (E3) | Change your camera format to "Most Compatible" | Tukar format kamera anda kepada "Paling Serasi" |
| `mediaLibrary.uploadingProgress` | UploadQueue header | Uploading {done} of {total} | Memuat naik {done} daripada {total} |
| `mediaLibrary.uploadSummary` | UploadQueue header | {ok} uploaded, {failed} failed | {ok} dimuat naik, {failed} gagal |
| `mediaLibrary.retryAllFailed` | UploadQueue | Retry all failed | Cuba semula semua yang gagal |
| `mediaLibrary.leaveWhileUploading` | `beforeunload` | Uploads in progress will be cancelled. | Muat naik yang sedang berjalan akan dibatalkan. |
| `mediaLibrary.locate` | 7.1 reused | Locate | Cari |
| `mediaLibrary.viewUnused` / `upgradePlan` | S6 banner | View unused / Upgrade plan | Lihat yang tidak digunakan / Naik taraf pelan |
| `mediaPicker.notSupportedHere` | S3 thẻ mờ | Not supported here | Tidak disokong di sini |
| `mediaPicker.libraryEmpty` | S3 empty | Your library is empty — upload your first image | Pustaka anda kosong — muat naik imej pertama anda |
| `mediaPicker.dropOrBrowse` / `browseFiles` | S3 tab Upload | Drag files here or / Browse files | Seret fail ke sini atau / Semak imbas fail |
| `mediaPicker.titleLogo` / `titleCover` | S3 `title` theo ngữ cảnh | Choose logo / Choose cover image | Pilih logo / Pilih imej muka depan |
| `mediaFolders.searchPlaceholder` | S5 Move | Search folders | Cari folder |
| `mediaFolders.moveHere` / `create` / `moveAndDelete` | S5 | Move here / Create / Move & delete | Pindah ke sini / Cipta / Pindah & padam |
| `mediaFolders.deleteEmptyTitle` | S5 | Delete empty folder? | Padam folder kosong? |
| `mediaFolders.cantMoveIntoSelf` | S5 tooltip | Can't move a folder into itself | Tidak boleh memindahkan folder ke dalam dirinya sendiri |
| `mediaFolders.maxDepthTooltip` | S5 tooltip cấp 5 | Folders can be nested up to 5 levels. | Folder hanya boleh bersarang sehingga 5 tahap. |
| `mediaFolders.contentSummary` | S5 xoá | This folder has {count} files and {folders} subfolders. | Folder ini mempunyai {count} fail dan {folders} subfolder. |
| `mediaFolders.loadFailed` | FolderTree lỗi | Couldn't load folders | Tidak dapat memuatkan folder |
| `dashboard.products.form.gallery.count` / `maxReached` | S7 | {count} / {max} / Maximum reached | {count} / {max} / Maksimum dicapai |
| `dashboard.products.form.gallery.addImages` | S7 | Add images | Tambah imej |
| `dashboard.products.form.gallery.moveLeft` / `moveRight` | S7 menu | Move left / Move right | Alih ke kiri / Alih ke kanan |
| `dashboard.products.form.gallery.removeUsedByVariants` | S7 confirm | This image is used by {count} variants. They'll show the main image instead. | Imej ini digunakan oleh {count} varian. Varian itu akan memaparkan imej utama. |
| `dashboard.products.form.variantImage.title` | S8 popover | Variant image — {name} | Imej varian — {name} |
| `dashboard.products.form.variantImage.default` | S8 ô ảnh | Default | Lalai |
| `dashboard.products.form.variantImage.needAnother` / `addToGallery` | S8 popover | Need another image? / Add to gallery | Perlukan imej lain? / Tambah ke galeri |
| `dashboard.products.categories.form.imageHint` (D74) | S9 | Shown at the top of your product list when shoppers filter by this category. Recommended 1600 × 400. | Dipaparkan di bahagian atas senarai produk apabila pembeli menapis mengikut kategori ini. Disyorkan 1600 × 400. |
| `editor.mediaField.addImage` / `addCover` | S9/S10 ô trống | Add image / Add cover image | Tambah imej / Tambah imej muka depan |
| `editor.imageToolbar.changeImage` (có sẵn) | S10 overlay | Change image | Tukar imej |
| `editor.mediaField.faviconHint` | S10 Favicon | Square, at least 48 × 48 · PNG, JPG, WEBP or ICO | Segi empat sama, sekurang-kurangnya 48 × 48 · PNG, JPG, WEBP atau ICO |
| `editor.mediaField.ogHint` | S10 OG | 1200 × 630 recommended | Disyorkan 1200 × 630 |
| `editor.mediaField.missingImage` | S10 / TC-F48-07-10 | This image is no longer available. Choose another. | Imej ini tidak lagi tersedia. Pilih imej lain. |
