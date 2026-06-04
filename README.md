<h2 align="center">
    <a href="https://dainam.edu.vn/vi/khoa-cong-nghe-thong-tin">
    🎓 Faculty of Information Technology (Dai Nam University)
    </a>
</h2>

<h2 align="center">
   Hệ Thống Giám Sát Hành Vi Của Lợn
</h2>

<div align="center">
    <p align="center">
        <img src="https://github.com/user-attachments/assets/ee72b1c4-04c7-4e4b-8d7a-8cf16932804a" width="170" />
        <img src="https://github.com/user-attachments/assets/1459f5bf-7fc9-4462-996d-eb1ef7633a97" width="180" />
        <img src="https://github.com/user-attachments/assets/f081d02c-b644-4e87-a40c-fcb8383c2985" width="200" />
    </p>

[![AIoTLab](https://img.shields.io/badge/AIoTLab-green?style=for-the-badge)](https://www.facebook.com/DNUAIoTLab)
[![Faculty of Information Technology](https://img.shields.io/badge/Faculty%20of%20Information%20Technology-blue?style=for-the-badge)](https://dainam.edu.vn/vi/khoa-cong-nghe-thong-tin)
[![DaiNam University](https://img.shields.io/badge/DaiNam%20University-orange?style=for-the-badge)](https://dainam.edu.vn)

</div>

---

## 1. Giới thiệu Dự án

<div align="justify">
FoodChain là hệ thống Truy xuất Nguồn gốc Nông sản (Farm-to-Table) được phát triển trong khuôn khổ học phần môn Công nghệ Blockchain. 

Mục đích chính của dự án là nghiên cứu và ứng dụng nền tảng Permissioned Blockchain (Hyperledger Fabric) vào việc quản lý chuỗi cung ứng khép kín. Hệ thống kết hợp giữa Sổ cái phân tán (Distributed Ledger), Smart Contract và giao diện Enterprise Web/Mobile để tự động hóa việc xác thực nguồn gốc.

Dự án là bước đệm vững chắc để tiến tới xây dựng các giải pháp minh bạch thông tin, chống hàng giả trong mô hình Nông nghiệp công nghệ cao (Smart Agriculture).
</div>

---

## 2. Bối cảnh & Vấn đề thực tiễn

<div align="justify">
Trong chuỗi cung ứng thực phẩm truyền thống, dữ liệu thường được lưu trữ tập trung tại một máy chủ duy nhất. Điều này tạo ra rủi ro rất lớn về việc gian lận: quản trị viên có thể dễ dàng sửa đổi ngày thu hoạch, thay đổi nguồn gốc xuất xứ mà người tiêu dùng không thể nào hay biết.

Dự án này ra đời nhằm giải quyết triệt để bài toán đó. Bằng cách ứng dụng Blockchain, FoodChain đóng vai trò như một "sổ cái bất biến". Dữ liệu một khi đã được mã hóa (SHA-256) và ký điện tử (ECDSA) từ Nông trại, Nhà máy, Đơn vị vận chuyển cho đến Siêu thị sẽ vĩnh viễn không thể bị xóa bỏ hay chỉnh sửa bởi bất kỳ ai.
</div>

---

## 3. Demo

*Link hệ thống (Ngrok): [Đang cập nhật]*

---

## 4. Tính năng cốt lõi

Hệ thống kết hợp giữa kiến trúc Blockchain nội bộ và Web/Mobile App với các tính năng chính:

- **Enterprise Dashboard**: Giao diện quản trị hiện đại áp dụng CSS Grid Layout, chia luồng nhập liệu rõ ràng cho 4 tổ chức độc lập.
- **Smart Contract (Chaincode)**: Tự động kiểm tra tính hợp lệ của giao dịch, ngăn chặn tuyệt đối việc tạo trùng mã lô hàng hoặc nhảy cóc quy trình.
- **Data Consistency (UI Masking)**: Kỹ thuật tự động chuẩn hóa dữ liệu đầu vào trên giao diện (VD: Ép kiểu nhập nhiệt độ bảo quản, tự thêm đuôi `°C`), đảm bảo tính đồng nhất cho Database.
- **Real-time Statistics**: Bảng thống kê trạng thái lô hàng (Khởi tạo, Chế biến, Vận chuyển, Lên kệ) được tính toán trực tiếp từ Blockchain theo thời gian thực.
- **Thuật toán Sổ tay ID (ids.json)**: Giải pháp sáng tạo giúp khắc phục giới hạn không hỗ trợ Rich Query của cơ sở dữ liệu LevelDB, tối ưu tốc độ tải danh sách kho hàng.
- **Mobile QR Portal**: Cổng truy xuất dành cho người tiêu dùng. Hỗ trợ Camera giải mã QR không cần cài App, hiển thị lịch trình sản phẩm dưới dạng Timeline kèm mã Hash xác thực.

---

## 5. Luồng nghiệp vụ & Quản lý trạng thái (State Machine)

Hệ thống sử dụng cơ chế kiểm soát trạng thái tuần tự để ra quyết định ghi sổ cái:

| Khâu thực hiện | Tác nhân (Actor) | Trạng thái (Status) | Hành động Blockchain |
| :--- | :--- | :--- | :--- |
| **1. Khởi tạo gốc** | Nông Trại | `CREATED` | Khởi tạo Key mới, băm dữ liệu, lưu Block đầu tiên |
| **2. Chế biến** | Nhà Máy CB | `PROCESSED` | Kiểm tra Status phải là CREATED, cập nhật quy cách |
| **3. Vận chuyển** | Logistics | `IN_TRANSIT` | Kiểm tra Status phải là PROCESSED, cập nhật nhiệt độ |
| **4. Lên kệ bán** | Siêu Thị | `AT_RETAILER` | Xác nhận nhập kho an toàn, đóng vòng đời cung ứng |
| **5. Truy xuất** | Người tiêu dùng | *(Chỉ Đọc)* | Gọi `evaluateTransaction` lấy lịch sử, đối chiếu Hash |

---

## 6. Công nghệ sử dụng

[![Hyperledger](https://img.shields.io/badge/Hyperledger_Fabric-2F3134?logo=hyperledger&logoColor=fff)](https://www.hyperledger.org/use/fabric)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=fff)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=fff)](https://expressjs.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?logo=javascript&logoColor=000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff)](https://www.docker.com/)

---

## 7. Cấu trúc project

```text
CNBC_foodchain-hyperledger-fabric/
├── 📁api/                 # Backend Node.js
│   ├── 📄server.js        # File Gateway kết nối Web và Blockchain
│   ├── 📄ids.json         # Thuật toán lưu trữ khóa chính (Sổ tay ID)
│   └── 📄package.json     # Chứa danh sách thư viện (fabric-network)
├── 📁web/                 # Frontend Web & Mobile
│   ├── 📄index.html       # Enterprise Dashboard
│   ├── 📄truy-xuat.html   # Cổng quét mã QR cho Mobile
│   ├── 📄style.css        # UI Design (CSS Grid, UI Masking)
│   └── 📄app.js           # Xử lý Logic & gọi API RESTful
├── 📁chaincode/           # Mã nguồn Smart Contract
│   └── 📄foodchain.js     # Chứa logic nghiệp vụ lưu sổ cái
├── 📁fabric-network/      # Cấu trúc mạng Hyperledger Fabric
│   └── 📁crypto-config/   # Chứa chứng chỉ x.509 và Private Key
├── 📄.gitignore           # Cấu hình bỏ qua file cho Git
└── 📄README.md            # Tài liệu hướng dẫn
```
## 8. Cài Đặt và Khởi chạy
```Bash
# 1. Clone project
git clone [https://github.com/Anos2003/CNBC_foodchain-hyperledger-fabric.git](https://github.com/Anos2003/CNBC_foodchain-hyperledger-fabric.git)

# 2. Khởi động mạng lưới Hyperledger Fabric (Yêu cầu có sẵn Docker)
cd fabric-network
./network.sh up createChannel -c supplychain-channel -ca
./network.sh deployCC -ccn supplychain -ccp ../chaincode -ccl javascript

# 3. Chạy API Server & Frontend
cd ../api
npm install
node server.js

# 4. Truy cập hệ thống trên PC
Mở trình duyệt: http://localhost:3000
```
```bash
# Hướng dẫn mở cổng Public cho Mobile quét QR (Tùy chọn)
Để điện thoại sử dụng mạng 4G có thể quét QR và truy cập hệ thống cục bộ:

- Mở Terminal mới, chạy lệnh:
ngrok http 3000

- Copy URL có dạng "[https://xxxx.ngrok-free.app](https://xxxx.ngrok-free.app)" và mở trên điện thoại.
```
---
## 9. Đóng góp
  <a href="https://github.com/Anos2003/CNXLA_BTL_Smart_Pig_Farm/graphs/contributors">

  <img src="https://contrib.rocks/image?repo=Anos2003/CNXLA_BTL_Smart_Pig_Farm" />

</a>

---
## 10. Phát triển
Dự án được phát triển trong khuôn khổ môn học Công nghệ Blockchain.

**Sinh viên thực hiện**: 

- Trịnh Hữu Hiệu ([Anos2003](https://github.com/Anos2003))

Giảng viên hướng dẫn: TS. Trần Đăng Công - Khoa Công nghệ Thông tin - Đại học Đại Nam
---
## 11. Giấy phép

Dự án này được phát hành theo giấy phép MIT License.  

Bạn được phép sử dụng, chỉnh sửa và phân phối lại mã nguồn cho mục đích học tập hoặc phát triển cá nhân.
