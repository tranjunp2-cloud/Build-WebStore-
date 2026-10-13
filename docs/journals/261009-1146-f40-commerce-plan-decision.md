# Nhật ký quyết định — kế hoạch F40 Commerce toàn nguồn

Ngày 2026-10-09. Người dùng đã chấp thuận hướng đối soát ba tầng: toàn selected PW1 trước lọc, độ đúng phần import, và kết luận Commerce riêng. Kế hoạch chi tiết nằm tại [plan.md](../../plans/261009-1146-f40-commerce-full-reconciliation/plan.md).

## Quyết định

- Tiếp nối phần Commerce của US-F40-14 bằng chương trình sáu phase; Settings còn trong kế hoạch F40-14 cũ. Chia PR theo US/F42 producer và F40 reader/UI, không gắn toàn chương trình vào một branch.
- Chứng minh hai mẫu số nguồn và importExpected bằng partition không chồng lấn, hash/sidecar, provenance và test dữ liệu thật. Partial là trạng thái record suy ra; security-excluded được đếm an toàn; Store blocked/deferred là chiều riêng.
- Mọi source field Commerce nằm trong ma trận table.column; gap không tương đương giữ `unsupported/unverified`, exclusion cần chữ ký QC/Product/Finance.
- Kết luận Commerce chỉ là mức đủ bằng chứng để QC xem xét; Website QC Pass và full cutover dùng gate riêng. US-F40-11 AC-2 exact remediation vẫn BLOCKED tới khi đáp ứng nguyên AC hoặc đổi AC được phê duyệt.
- PASS staging cần expected/actual, revision, Store/run/snapshot/generation, owner, timestamp và link evidence cho từng yêu cầu. Test synthetic hoặc skip không thay thế được real artifact.

## Phụ thuộc

F42 field evidence/source sidecar và comparator, F40 ledger adapter staging, policy QC/Product/Finance, quyền staging fixture thật. Contract và thiết kế API có thể tiến hành trước; nghiệm thu dữ liệu thật chờ các gate này.
