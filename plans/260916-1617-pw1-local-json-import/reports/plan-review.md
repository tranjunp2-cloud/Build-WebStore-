# Phản biện kế hoạch local

Ngày 2026-09-16. Review tài liệu, không phải code/test results. Failure-mode reviewer độc lập và root rà integrity/security; các chỉnh sửa giữ nguyên phạm vi thiết kế đã được user đồng ý.

| ID | Mức | Phát hiện | Xử lý |
|---|---|---|---|
| R1 | High | --resume không phân biệt batch/Store run, có thể bỏ Store kế tiếp | Accepted: durable batch + child runs, json:<uuid>, strict flag matrix; MAN13 |
| R2 | High | Pin writer hash ngăn resume sau bugfix nhưng không có recovery | Accepted: restore disposable clone và new batch; in-place upgrade ngoài scope; MAN15 |
| R3 | High | Reject JSON rollback không bảo vệ legacy producer bị rollback | Accepted: target-level legacy rollback guard ngày đầu, consumer evidence; MAN14 |
| R4 | High | Synthetic compatible clone có thể che real-master conflict | Accepted: G1 chọn đường actual-master nghiệm thu; synthetic không thay MAN02 |
| R5 | High | run.startedAt mới gây timestamp mismatch khi replay cross-run | Accepted: persisted owner timestamp provenance cho reuse; MAN16 |

Không có finding bị từ chối. Các marker Review R1..R5 trong contract/phase chỉ ra thay đổi. 16 ca nghiệm thu là yêu cầu chưa thực thi. Tám giờ là timebox, không có bằng chứng đo để hứa đủ toàn bộ writer và fault drills. Không giảm yêu cầu ban đầu hoặc báo hoàn tất khi blocked.

Reviewer đã đọc lại R1–R5 và MAN-LOCAL-13–16 sau chỉnh sửa: không còn finding Critical/High trong phạm vi kiểm tra lại. Đây chỉ là kết quả rà tài liệu; không chứng nhận implementation hoặc nghiệm thu DB.
