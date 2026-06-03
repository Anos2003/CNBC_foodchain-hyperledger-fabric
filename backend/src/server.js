'use strict';

const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/product.routes');

const app = express();

// Cấu hình cơ bản
app.use(cors());
app.use(express.json());

// Gắn Biển chỉ đường vào sảnh chính của tòa nhà
app.use('/api', productRoutes);

// Route mặc định kiểm tra sức khỏe hệ thống
app.get('/', (req, res) => {
  res.send('🏢 Backend Truy Xuất Nguồn Gốc Blockchain Đã Mở Cửa!');
});

// Bật công tắc điện!
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 MÁY CHỦ SẴN SÀNG TẠI CỔNG ${PORT}`);
  console.log(`👉 Ấn Ctrl + C để tắt máy chủ khi không sử dụng.`);
});