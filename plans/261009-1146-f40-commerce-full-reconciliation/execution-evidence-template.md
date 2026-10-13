# Mẫu ghi kết quả thực thi F40 Commerce

Sao chép bảng này vào báo cáo QA của từng staging revision. **Mỗi ID trong [ma trận yêu cầu](requirements-traceability.md) phải có ít nhất một dòng**; các ca field/Store khác nhau có dòng riêng. Không sửa trạng thái dự kiến thành PASS chỉ từ fixture synthetic hoặc test skip.

| Requirement/TC ID | Store/fixture và loại | Expected | Actual | Trạng thái | Owner/actor | Revision/contract/registry | Source instance/snapshot/as-of/hash | Child UUID/generation/digest | Target instance/read time | Thời điểm chạy | Link bằng chứng an toàn / issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DES-01 | Chưa chạy | Chưa điền | Chưa điền | NOT_RUN | Chưa gán | Chưa điền | Chưa điền | Chưa điền | Chưa điền | Chưa điền | Chưa điền |

## Quy tắc đóng hàng

- `PASS`: expected và actual khớp trên cùng revision/provenance, có bằng chứng truy xuất được và owner xác nhận; những row cần dữ liệu thật phải dùng real artifact.
- `FAIL`: actual khác expected, có issue/owner và mức P0/P1.
- `BLOCKED`: thiếu source sidecar, run VERIFIED, target proof, quyền, policy ký hoặc staging revision; nêu rõ dependency và ngày kiểm lại.
- `NOT_RUN`: chưa chạy hoặc test bị skip; không gộp vào PASS.
- Ghi số nguồn theo Store và snapshot riêng; `unattributed` nằm ngoài tổng từng Store. Ghi `security-excluded` bằng count/proof, không ghi giá trị bí mật.
- Kèm bảng field inventory theo `source table.column → target path/disposition/rule/TC-ID/owner`, có chữ ký QC/Product/Finance cho mọi exclusion; bảng này là attachment bắt buộc của Phase 01/03/06.
- Kết luận Commerce và Website QC/cutover là ba dòng quyết định độc lập; kết luận Commerce đủ bằng chứng không tự đổi verdict khác.
