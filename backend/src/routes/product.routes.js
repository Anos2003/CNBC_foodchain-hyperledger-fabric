'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/product.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Bắt buộc mọi khách qua đây đều phải trình thẻ cho Bác bảo vệ (authenticateJWT)
router.use(authenticateJWT);

// ─── ĐƯỜNG DÀNH CHO CÁC CÔNG TY (Ghi dữ liệu) ───
// Nông dân tạo sản phẩm
router.post('/products', controller.createProduct);

// ─── ĐƯỜNG DÀNH CHO TẤT CẢ (Đọc dữ liệu) ───
// Xem lịch sử vòng đời
router.get('/products/:batchID/history', controller.getProductHistory);

// (Sau này chúng ta sẽ thêm các đường cho Processor, Logistics ở đây)

module.exports = router;