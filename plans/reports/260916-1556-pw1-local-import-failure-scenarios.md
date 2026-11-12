---
title: "Tình huống lỗi và cách xử lý migration PW1 JSON ở local"
date: 2026-09-16
status: proposed
type: scenario-report
scope: "Local CLI; DB hiện hữu; không xử lý Page/component; chưa triển khai hoặc fault-injection"
---

# Tình huống lỗi và cách xử lý migration PW1 JSON ở local

## 1. Phạm vi và bằng chứng

Đối chiếu current master/JSON, current collection/hook/job và hạ tầng worktree đã khảo sát. Phân tích đủ 12 nhóm của ck:scenario; không phân tích UI mobile/accessibility vì đây là local CLI. Environment chỉ xét Node/Payload/DB/timezone và khác biệt local với Vercel sau này. Privacy tập trung dữ liệu cá nhân, credential, retention; không đưa kết luận pháp lý.

Đây là danh sách thiết kế/phòng ngừa và mục tiêu nghiệm thu, **không phải xác nhận 48 lỗi đang xảy ra hoặc 48 test đã pass**. Lần này chỉ đọc source và kiểm kê JSON, không ghi DB, không gửi provider request, không tạo test/implementation. Kết quả 111 unit tests trong research trước không thay kiểm thử tích hợp các trường hợp dưới đây.

Artifact đối chiếu:

- Master SHA-256: `62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26`.
- JSON SHA-256: `2eb804387dc34561624597cb2f4aa21af38a00caeb9fb44a96b84734fbe0eacc`.
- [Research hạ tầng và DB](./260916-1501-pw1-json-import-feasibility-research.md).

### Phát hiện mới cụ thể

- Store205: 190 Orders, tất cả discountAmount=0. Fixture chưa chứng minh phép xử lý giảm giá khác0.
- 229 Order items không có id; 73 Product variants có id. Chiến lược child identity và update array phải được thiết kế, không chỉ top-level crosswalk.
- Hai Product có inventory=0; tuyệt đối không fallback stock từ phép kiểm truthy.
- Bảy User, hai Site và 13 Media không có đủ createdAt/updatedAt ở field đích. Với embedded Media, master có rule không bịa timestamp; Site/User cần disposition nguồn rõ ràng. Không đồng nhất missing history với lỗi writer.
- Job payment-expiry có thể hủy Order khớp điều kiện, restock, release discount và gửi email. Hook suppression lúc import không chặn job chạy sau đó.
- **Fixture hiện tại không có paymentExpiresAt, stripeSessionId hoặc xenditPaymentRequestId ở Orders**; vì vậy chưa thấy bằng chứng mẫu hiện sẽ kích hoạt các nhánh provider/expiry đó. Đây là nguy cơ cho artifact khác hoặc dữ liệu đã có ở DB đích, phải test bằng fixture phù hợp.
- Master rule Product slug tenant-scope khác schema/index toàn cục; helper preflight Product cũng còn global. Checklist master tại §13 còn câu global: cần thống nhất contract trước triển khai, không chọn một câu thuận tiện để tự sửa slug.

## 2. Quy ước xử lý

- `C` Critical: nguy cơ mất/sai dữ liệu âm thầm, lộ credential hoặc sai quyền.
- `H` High: không thể import đúng một phần dữ liệu, trạng thái không nhất quán.
- `M` Medium: kết quả/UX vận hành không rõ nhưng không nhất thiết sai dữ liệu.
- `RETRY`: tự thử lại giới hạn, chỉ sau khi biết transaction chưa commit/đã rollback.
- `RECONCILE`: tra DB ledger/target, xác định kết quả rồi mới chọn skip/resume/retry.
- `REPLAN`: input/contract/baseline đổi hoặc không hợp lệ; plan cũ không còn dùng được.
- `RESOLVE`: dừng affected scope, cần sửa dữ liệu/cấu hình/policy/code rồi đối chiếu lại; không retry mù.
- `DONE`: kết quả hợp lệ/không có thao tác, báo rõ.

Các nhãn là phân loại đề xuất, không phải enum đã được thêm vào schema. Lỗi phạm vi toàn cục (sai DB, sai key, schema mismatch) dừng toàn run. Lỗi theo entity chặn aggregate/dependency liên quan; mặc định local dừng tại Store lỗi, không tự skip để đi tiếp.

## 3. User và identity
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-01 | Email giống User PW2 nhưng source identity khác hoặc chưa có claim | C | Đối chiếu namespace + source ID + membership; email chỉ dùng tìm ứng viên. Chặn nhận nhầm identity; giữ credential đích. | RESOLVE |
| MIG-SCN-02 | User thuộc nhiều Store; ghi tenants[] làm mất membership cũ hoặc tăng quyền | C | Diff membership theo tenant; giữ mọi membership ngoài scope, role global không được tự cộng/ghi đè. Bản local đầu chặn mixed-ownership array nếu chưa có merge policy. | RESOLVE |
| MIG-SCN-03 | Staff suspended hoặc User pending vẫn đăng nhập/SSO được | C | Kiểm tra auth, refresh, OTP/SSO, route và collection. Không đổi trạng thái account cũ để cách ly cả Store; giữ cách ly đúng phạm vi, chưa activate khi gate chưa đạt. | RESOLVE |
| MIG-SCN-04 | User thiếu key_string hoặc nguồn đã xóa/không đủ điều kiện | H | Phân biệt thiếu credential với không được migrate identity. Không sinh fallback password hoặc hồi sinh User đã xóa; credential thiếu có disposition và enrollment policy riêng. | RESOLVE |

## 4. Đầu vào và selector
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-05 | JSON hỏng, thiếu collection, key lạ, trùng Store/_ref hoặc duplicate JSON object key | H | Validate cấu trúc trước ghi; parser phải phát hiện key trùng thay vì để JSON.parse giữ giá trị cuối. Unknown key không tự spread vào Payload. | REPLAN |
| MIG-SCN-06 | null/chuỗi rỗng/false/0 bị ép thành default; ID lớn mất chính xác | H | ID nguồn giữ chuỗi; số lượng là safe integer. Kiểm tra presence trước chuyển kiểu, không dùng Number(value)||default. Zero stock/price hợp lệ theo rule riêng. | REPLAN |
| MIG-SCN-07 | Store explicit không có; nhiều selector; range đảo hoặc danh sách trùng | H | Exactly one selector, range inclusive chỉ lấy ID có thật; explicit ID vắng báo lỗi. Sort ID theo số an toàn, không sort lexical 1,10,100,2. Dedupe và khóa danh sách trong plan. | REPLAN |
| MIG-SCN-08 | Đường file đúng nhưng bytes master/credential bị thay giữa hash và parse | C | Đọc immutable snapshot, hash và parse cùng bytes; chống symlink/path thay thế, bind mapping/source/target/selector. Không đọc lại file mutable sau khi đã kiểm tra. | REPLAN |

## 5. Timing và cạnh tranh
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-09 | DB COMMIT thành công nhưng mất kết nối trước ACK | C | Đánh dấu outcome unknown. Sau reconnect và xác nhận transaction cũ đã kết thúc, tra operation ledger + target. Có evidence commit thì reconcile; chứng minh chưa commit mới retry. Không tạo/xóa bù ngay. | RECONCILE |
| MIG-SCN-10 | Deadlock hoặc serialization failure | H | Rollback toàn transaction; đọc lại dữ liệu/baseline trong transaction mới, retry có backoff+jitter giới hạn. Hết số lần thì pause. Không retry một câu SQL trong transaction đã lỗi. | RETRY |
| MIG-SCN-11 | Hai CLI dùng run khác nhưng selector Store giao nhau | C | Claim Store và source entity trong DB; active run/claim thắng thì tiến trình còn lại dừng hoặc theo dõi run đó. Không xóa claim hoặc tạo liên tiếp run mới để lách. | RESOLVE |
| MIG-SCN-12 | App sửa/xóa target sau dry-run, trước khi ghi hoặc gắn FK | C | Kiểm tra/khóa target và baseline ngay trong transaction; khác checksum/ownership thì conflict. Không tìm record cùng slug để tự thay thế. | REPLAN |

## 6. Quy mô và ranh giới batch
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-13 | Selector hợp lệ nhưng tập kết quả rỗng | M | Báo NO_MATCH với zero writes; không suy thành --all hoặc migration thành công toàn nguồn. | DONE |
| MIG-SCN-14 | Target nhiều hơn limit mặc định; preflight/verify chỉ đọc trang đầu | H | Pagination/cursor ổn định, query đầy đủ tập cần so sánh. Kiểm tra số lượng theo scope và unique keys; không dùng một find mặc định để chứng minh không collision. | RESOLVE |
| MIG-SCN-15 | Store rất lớn, OOM hoặc một aggregate vượt ngân sách xử lý | H | Đo kích thước, xử lý entity/chunk giới hạn, không clone toàn master nhiều lần. Aggregate vượt giới hạn chặn trước; không chia transaction tùy tiện làm hở bản ghi cha/con. | RESOLVE |
| MIG-SCN-16 | Rollback làm sequence ID có khoảng trống; ID đích không giống PW1 | M | Bình thường; luôn dùng RETURNING/crosswalk. Không reset sequence hoặc đánh số lại. Nếu sequence thật sự behind max(id) do seed cũ, sửa riêng có kiểm soát, không coi là retry create. | DONE |

## 7. Chuyển trạng thái và resume
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-17 | Store100 đã ghi một phần rồi tiến trình bị kill; Store1–99 đã verify | C | Giữ Store100 partial; resume entity chưa hoàn tất, không tạo lại cha hoặc đánh dấu Store complete. --from-store không được bỏ qua Store lỗi sớm hơn mà báo full success. | RECONCILE |
| MIG-SCN-18 | Entity commit nhưng checkpoint file/report chưa ghi, hoặc file nói xong nhưng DB chưa có | C | DB ledger là authority. Ghi target+entity ledger+checkpoint cần thiết cùng transaction; file chỉ là cache/report có thể dựng lại. | RECONCILE |
| MIG-SCN-19 | Apply đã ghi hết nhưng verify lỗi, hoặc người dùng sửa JSON để sửa lỗi | H | Chưa verify thì chưa complete/activate. Cùng snapshot có thể verify/resume; đổi JSON/credential/mapping/code phải replan và reconcile dữ liệu đã ghi, không sửa bytes của run cũ. | REPLAN |
| MIG-SCN-20 | Rollback run A trong khi run B đã reuse hoặc tham chiếu output của A | C | Kiểm tra dependency xuyên run và FK/JSON refs; chặn xóa khi còn consumer. Rollback UPDATE chỉ restore owned fields khớp post-image; không erase thay đổi mới. | RESOLVE |

## 8. Môi trường và phiên bản
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-21 | Lệnh --target local nhưng DATABASE_URI trỏ remote hoặc DB khác tên quen thuộc | C | Bind target identity thực; kiểm tra host/database/schema/deployment policy, không chỉ tin nhãn CLI. Chặn mismatch trước write; không log connection string. | RESOLVE |
| MIG-SCN-22 | getPayload ở local development tự push schema trong dry-run | C | Tắt schema auto-push cho importer; schema migration là bước riêng. Dry-run không business write hoặc DDL; kiểm tra schema/version thay vì tự sửa. | RESOLVE |
| MIG-SCN-23 | Schema hoặc importer thay đổi khi run đang dở | H | Pin writer/mapping/schema fingerprint và dependency versions. Phát hiện drift thì pause/replan; có table chưa đủ, kiểm tra index/constraint. | REPLAN |
| MIG-SCN-24 | Timezone bị áp hai lần hoặc field không có timestamp nguồn | H | Giữ ISO instant đã map; không đổi theo timezone máy chạy. Timestamp thiếu cần disposition theo collection, không mượn ngày cha hoặc tự gọi import time là lịch sử nguồn. | RESOLVE |

## 9. Lỗi hạ tầng lan truyền
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-25 | DB mất kết nối/pool timeout trước transaction hoặc giữa thao tác | H | Nếu chắc chưa ghi hoặc đã rollback thì retry giới hạn. Nếu trạng thái commit chưa rõ chuyển RECONCILE; không gộp mọi lỗi kết nối thành retry. | RETRY |
| MIG-SCN-26 | Ledger/audit write lỗi sau business write | C | Cùng transaction phải rollback cả hai. UPDATE chỉ bắt đầu khi lưu before-image bền vững được bảo đảm; audit không được best-effort. | RESOLVE |
| MIG-SCN-27 | Disk đầy/không đọc được artifact/không giải mã được before-image | H | Artifact hoặc audit bắt buộc không đọc được thì pause trước write. Chỉ lỗi xuất report sau commit được dựng lại từ DB; không rollback business đã commit chỉ vì thiếu report. | RESOLVE |
| MIG-SCN-28 | Lease hết hạn trong transaction/hook chậm; runner cũ vẫn tiếp tục | C | Recheck fence/expiry ở ranh giới commit, không chỉ đầu vòng lặp. Renewal failure phải dừng. Mọi DB write awaited và truyền req; không ghi sau khi session transaction bị dọn. | RECONCILE |

## 10. Credential và quyền thực thi
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-29 | Giải mã key_string thành công nhưng mật khẩu không còn khớp PW1 | C | Đối chiếu với hash nguồn cùng snapshot bằng thuật toán hỗ trợ. MAC hợp lệ không chứng minh password hiện hành; mismatch/không kiểm chứng thì không đánh dấu password migrated hoặc activate âm thầm. | RESOLVE |
| MIG-SCN-30 | Sidecar khác source/snapshot/User; sai key/MAC hoặc rotate key giữa run | C | AEAD bind namespace+snapshot+record identity+format/key version; authenticate manifest/plan. Chặn mismatch; giữ key cần thiết trong cửa sổ recovery. Không dùng SSO key làm migration artifact key. | RESOLVE |
| MIG-SCN-31 | Local API overrideAccess vượt tenant isolation hoặc public request giả migration context | C | Capability migration nội bộ có kiểm soát; whitelist field và tenant ownership độc lập access API. Không dùng Boolean cờ do request ngoài tự đặt để bỏ guard. | RESOLVE |
| MIG-SCN-32 | Mật khẩu/DB credential lọt vào exception, stdout, child process hoặc history | C | Không log object gốc hoặc raw driver error; allowlist code+masked identity. Không truyền secret CLI; plaintext chỉ dùng trong scope xử lý rồi bỏ tham chiếu, không hứa zeroize tuyệt đối JS strings. | RESOLVE |

## 11. Toàn vẹn quan hệ và uniqueness
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-33 | Ref tồn tại nhưng thuộc tenant khác, hoặc Order trỏ Product/Customer ngoài Store | C | Validate ownership xuyên Tenant/Site và target mapping, không chỉ kiểm tra ref tồn tại; raw refs không được resolve mù. Chặn aggregate có dependency bắt buộc sai. | RESOLVE |
| MIG-SCN-34 | Category cycle/quá ba cấp/cha soft-deleted; forward actor ref chưa có | H | Topological order cho cây, pass2 cho quan hệ tùy chọn đã định nghĩa; không null hóa ref bắt buộc hoặc chọn cha đầu tiên. Preserve timestamps sau pass2. | REPLAN |
| MIG-SCN-35 | Product slug/Order number/Blog slug/SKU va chạm với target khác nguồn | C | Preflight cả unique scope thực và contract. Không auto-suffix, merge, overwrite hoặc bỏ unique index. Master Product tenant-scope còn khác DB global; giải quyết contract/schema trước khi ghi collision. | RESOLVE |
| MIG-SCN-36 | Array IDs bị sinh lại/append trùng; update xóa variant/address/membership PW2 | C | Giữ source child ID ổn định khi hợp lệ; thiếu thì persist identity theo parent/path/source detail. Snapshot cố định dùng vị trí chỉ khi không có key tốt hơn; snapshot mới phải reconcile. Mixed-ownership array chưa có semantics thì block UPDATE. | RESOLVE |

## 12. Hook, job nền và tích hợp
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-37 | Order hook suy lại Customer, paymentStatus; Product tự sửa slug/SEO/stock | C | Migration guards theo hook, vẫn giữ integrity validation; so sánh DB sau write với expected projection. Không coi create trả 200 là fidelity đạt. | RESOLVE |
| MIG-SCN-38 | Nested Local API không truyền req hoặc async side effect chạy sau transaction | C | Truyền req chung và await mọi DB mutation; chặn outbound effect trong import. Transaction rollback không thu hồi được email/API đã gửi. | RESOLVE |
| MIG-SCN-39 | Cron/webhook chạy sau import, auto-cancel/restock/reconcile đơn lịch sử | C | Kiểm tra điều kiện job; giữ historical migration records ngoài luồng xử lý live bằng provenance/gate bền vững đã kiểm chứng. Local tắt job nền/outbound thật, nhưng vẫn cần test predicate và gate trước đưa lên Vercel. | RESOLVE |
| MIG-SCN-40 | Media URL 404/403/signed-expired, filename cũ làm plugin rewrite, cùng URL khác owner | H | Không download/upload hoặc tạo filename giả. Tách write fidelity khỏi URL accessibility; kiểm chứng S3-enabled read/populate/render với host hợp lệ, giới hạn timeout. Không GET URL không tin cậy hoặc merge theo URL. | RESOLVE |

## 13. Bảo toàn dữ liệu và riêng tư
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-41 | Master/raw chứa dns_token, link có secret hoặc PII; raw bị spread vào public collection | C | Field allowlist theo writer; secret vào vùng riêng có kiểm soát, giữ disposition bảo toàn nguồn. Master không password vẫn không phải tài liệu công khai. | RESOLVE |
| MIG-SCN-42 | Before-image hoặc backup chứa password/PII nhưng report/log được chia sẻ | C | Chỉ lưu field thực sự cần restore, mã hóa và hạn chế truy cập; report dùng ID/count/code, không values nhạy cảm. Không đưa credential cũ vào before-image vì credential existing không thuộc update scope. | RESOLVE |
| MIG-SCN-43 | Chạy lại snapshot cũ làm sống lại bản ghi đã xóa/anonymize sau snapshot | H | Kiểm tra target deletion/tombstone và nguồn updatedAt/snapshot. Không tái tạo dựa trên missing target đơn thuần nếu claim lịch sử cho thấy từng tồn tại. | RESOLVE |
| MIG-SCN-44 | Xóa artifact/key quá sớm khiến resume/rollback không thể thực hiện | H | Chốt retention window cho input, before-image, ledger và key; chỉ cleanup sau nghiệm thu/hết cửa sổ recovery. Không xóa/rotate SSO_ENCRYPTION_KEY đang phục vụ PW2. | RESOLVE |

## 14. Nghiệp vụ và nghiệm thu
| ID | Tình huống | Mức | Phát hiện / cách xử lý | Sau lỗi |
|---|---|---|---|---|
| MIG-SCN-45 | Tiền bị nhân/chia100 hai lần, float rounding, quantity phân số hoặc overflow | C | Mapped JSON không remap units lần nữa. Validate theo từng field, exact decimal/minor-unit rules, finite/safe integer/domain. Đối soát total theo contract, không công thức chung bỏ qua nguồn và tax. | REPLAN |
| MIG-SCN-46 | Order lịch sử làm Customer latestOrderAt lùi hoặc totalSpent/orderCount cộng hai lần | C | Giữ canonical Customer snapshot/alias map; không replay checkout/aggregate hooks. Import newest-first/oldest-first và replay phải cho cùng kết quả. | RESOLVE |
| MIG-SCN-47 | Gói active ở snapshot đã hết hạn, trial/future start/usage expiry khác runtime | H | Giữ lịch sử, đánh giá quyền hiện tại riêng tại asOf rõ ràng. Không renew/SSO-upsert/reset usage/fallback free; kiểm tra actual feature registry. | RESOLVE |
| MIG-SCN-48 | Mảng [] bị coi là không có dữ liệu; raw/quarantine/unknown đều báo complete | H | Phân biệt verified-empty, quarantined, source-unverified, raw-preserved và out-of-scope. Pages được loại theo yêu cầu; required unresolved ở collection khác vẫn chặn. Báo selected-scope verified, không tuyên bố toàn Store tương đương. | RESOLVE |

## 15. Policy retry cụ thể đề xuất

| Lỗi | Xử lý |
|---|---|
| PostgreSQL 40001 / 40P01 | Retry **toàn transaction** với dữ liệu/baseline được đọc lại; đề xuất tối đa3 lần, backoff+jitter |
| Kết nối hỏng / timeout / process kill | Xác định transaction outcome; đã commit thì reconcile, đã rollback mới retry |
| 23505 unique_violation | Lookup constraint + source claim + target. Không coi mọi unique conflict là idempotent skip hoặc retryable |
| 23503 FK, 23502 NOT NULL, 23514 CHECK, numeric/date invalid | Block dữ liệu/schema cần sửa, không retry không đổi đầu vào |
| Lease/fence stale | Runner mất quyền ghi; dừng và để recovery có quyền nhận lại sau khi transaction cũ kết thúc |
| Source/target/schema/version mismatch | Invalidate plan tương ứng, lập lại sau đối soát |
| Output report lỗi sau commit | Tái dựng report từ ledger, không lặp lại write |

Dùng SQLSTATE/constraint name thay vì chỉ bắt chuỗi thông báo. Không giả định driver luôn trả đúng mã transaction_resolution_unknown; mất ACK có thể chỉ xuất hiện như network error. [PostgreSQL SQLSTATE](https://www.postgresql.org/docs/16/errcodes-appendix.html), [Transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html).

Sequence có khoảng trống sau rollback là bình thường vì nextval không rollback. [PostgreSQL sequence](https://www.postgresql.org/docs/16/functions-sequence.html).

## 16. Mười hai ca phải chứng minh trước khi gọi local ổn định

Đây là **mục tiêu nghiệm thu**, chưa tạo test code. Khi triển khai test cần đọc docs/TEST_CONVENTION.md và cập nhật/đối chiếu QA AUTO TC-ID đúng quy tắc repo; MIG-SCN không thay TC-ID.

1. Chạy một Store rồi replay: zero duplicate, giữ nguyên dữ liệu và child identities.
2. Ngắt giữa Store100: resume đúng entity; Store trước đó không bị chạy lại hoặc sửa ngoài dự kiến.
3. Mất ACK sau commit: reconcile và không double-create.
4. Hai tiến trình chọn cùng Store: chỉ một tiến trình được ghi; fence cũ không finalize.
5. UPDATE gặp target edit sau dry-run: conflict, không overwrite.
6. Rollback UPDATE/CREATE: bảo vệ baseline, post-import edits và downstream refs xuyên run.
7. Order giữ Customer FK/money/payment/timestamps; không email, restock hoặc thay Customer aggregate.
8. Credential giải mã đúng nhưng hash nguồn không khớp; existing user giữ nguyên password/membership ngoài scope.
9. Media không filename: read/populate/render đúng URL dưới config S3; zero upload, đúng isolation gate.
10. Stock0, discount khác0, money fraction/overflow, timezone/date missing và usage bound được phân loại đúng.
11. Array retry/update: giữ73 variant IDs, tạo229 item identities ổn định khi cần; không append/xóa child ngoài scope.
12. Dry-run zero writes/DDL; wrong target/hash/version bị chặn; Pages out-of-scope và unknown collections không bị báo thành complete.

## 17. Các thay đổi cần đưa vào thiết kế local

- Bổ sung phân loại failure và phase RECONCILE cho kết quả commit chưa rõ; không chỉ FAILED rồi retry.
- Giao dịch chung business+ledger+audit/checkpoint; DB authority cho resume.
- Scope UPDATE cụ thể theo field/array. Với mục tiêu một ngày, chặn mixed-ownership array updates trước; không dựng merge engine tổng quát.
- Historical data phải có cơ chế ngăn tác động job nền bền vững, không chỉ cờ req.context. Với local test, cô lập outbound/cron thật và kiểm chứng predicate trong fixture.
- Verify projection/relations/units/child identity/timestamps, không chỉ row counts. Theo dõi thiếu source history riêng.
- Credential MAC và hash nguồn là hai phép kiểm khác nhau; evidence password migrated phải đúng mức đã chứng minh.
- Tạm dừng khi checksum/namespace/schema/policy sai; không dùng --force bỏ qua integrity hoặc owner gate.
- Các preflight/read hooks cần dùng req đúng transaction khi đọc dữ liệu đang ghi; kiểm tra khả năng partial Store bị app thấy trước verify.

## 18. Dẫn chứng source chính

- [Order unique number và item fields](../../src/collections/Orders.ts:115).
- [Order auto-link Customer](../../src/collections/orders-hooks/auto-link-customer.ts:42).
- [Customer snapshot hook](../../src/collections/orders-hooks/sync-customer-snapshot.ts).
- [Payment expiry: cancel/restock/email](../../src/lib/jobs/payment-expiry.ts:10).
- [Provider reconciliation](../../src/lib/jobs/reconcile-orders.ts:17).
- [Discount auto-inactive](../../src/lib/jobs/discount-auto-inactive.ts).
- [Product global slug hook](../../src/collections/Products.ts:41), [preflight global slug](../../src/lib/migration/pw2-product-dispositions.mjs:354).
- [Customer normalization và address limit](../../src/collections/Customers.ts:59).
- [Category tree/ownership validation](../../src/collections/Categories.ts:113).
- [Payload schema auto-push](../../src/payload.config.ts:77).
- [Worktree transaction](<worktree-1>/src/lib/migration/pw1-pw2/transaction.ts:39).
- [Worktree lease](<worktree-1>/src/lib/migration/pw1-pw2/lease.ts:14).
- [Worktree active source uniqueness](<worktree-1>/scripts/pw1-migration-schema.js:261).
- [Worktree rollback ownership/dependencies](<worktree-1>/src/lib/migration/pw1-pw2/rollback.ts:510).
- [Worktree encrypted snapshot](<worktree-1>/src/lib/migration/pw1-pw2/snapshot-workspace.ts:235).
- [Worktree credential recovery](<worktree-1>/src/lib/migration/pw1-pw2/laravel6-credential.ts:69).
- [Master mapping](../../docs/migration/pw1-pw2-master-field-mapping.md).

## 19. Câu hỏi/policy chưa được chốt

- Field nào được UPDATE trên DB có sẵn; đặc biệt plan, publish/domain, membership và arrays?
- Với timestamp nguồn thiếu, field nào được ghi thời gian import có disposition, field nào phải block để bổ sung nguồn?
- Khi credential giải mã được nhưng không có hash nguồn để kiểm chứng, có cho tạo profile chưa kích hoạt hay block Store?
- Cơ chế historical provenance/job exclusion khi đưa lên Vercel: dùng ledger lookup hay metadata/index riêng? Chưa chọn hoặc sửa schema trong research.
- Bộ master đầy đủ ngoài205/285 và DB local thực sẽ dùng để rehearsal: cần xác nhận trước áp dụng kết quả vào batch lớn.

## 20. Tổng hợp

48 scenarios trên12 nhóm: Critical 28, High 18, Medium 2, Low0. Đây là mức rủi ro nếu xảy ra, không phải số lỗi đã tái hiện.
