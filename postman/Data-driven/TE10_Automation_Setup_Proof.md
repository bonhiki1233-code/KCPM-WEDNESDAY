# TE-10: Cấu hình Data-driven Testing trên Postman (Proof of Work)

Tài liệu này ghi nhận quá trình thiết lập tự động hóa trên công cụ Postman và Newman bằng phương pháp Data-Driven.
Tất cả các Test Case được lấy từ TE-8 (BVA) và TE-9 (EP) để nạp vào Postman Runner.

## 1. Dữ liệu đầu vào (Test Data)
- **Từ TE-8 (BVA):**
  - `TE8_CreateTopic_TestData.json` (Gồm 11 Test Cases)
  - `TE8_CreateMilestone_TestData.json` (Gồm 9 Test Cases)
- **Từ TE-9 (EP):**
  - `TE9_CreateSemester_TestData.json` (Gồm 7 Test Cases)
  - `TE9_SubmitCheckpoint_TestData.json` (Gồm 6 Test Cases)

## 2. Kịch bản kiểm thử (Test Scripts)
Tất cả các requests trong Postman đều được gài script sau vào tab **Tests**:
```javascript
//Automation test
let expectedStatus = pm.iterationData.get("expected_status");
pm.test(`[${pm.iterationData.get("TC_ID")}] Status Code phải là ${expectedStatus}`, function () {
    pm.response.to.have.status(expectedStatus);
});

//Call Api --> Log bugs Jira
if (pm.response.code !== expectedStatus) {
    console.log("Phát hiện Bug ở " + pm.iterationData.get("TC_ID") + " - Gọi API log bug lên Jira...");
}
```

## 3. Cấu hình tự động chạy qua Newman (CI/CD)
Lệnh thực thi giả lập trên Server để đánh giá Pass/Fail tự động:

```bash
newman run "KCPM-WEDNESDAY API.postman_collection.json" --folder "Create Topic" -d "postman/BVA/TE8_CreateTopic_TestData.json"
newman run "KCPM-WEDNESDAY API.postman_collection.json" --folder "Create Milestone" -d "postman/BVA/TE8_CreateMilestone_TestData.json"
newman run "KCPM-WEDNESDAY API.postman_collection.json" --folder "semesters" -d "postman/EP/TE9_CreateSemester_TestData.json"
newman run "KCPM-WEDNESDAY API.postman_collection.json" --folder "submissions" -d "postman/EP/TE9_SubmitCheckpoint_TestData.json"
```
