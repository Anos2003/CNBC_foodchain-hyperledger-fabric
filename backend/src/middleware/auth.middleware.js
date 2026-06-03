'use strict';

/**
 * Middleware: Bác bảo vệ kiểm tra thẻ
 * Tạm thời chúng ta sẽ kiểm tra qua Header (x-org-name). 
 * Khi hệ thống chạy thực tế, phần này sẽ kiểm tra chữ ký mã hóa JWT.
 */
exports.authenticateJWT = (req, res, next) => {
  const orgName = req.headers['x-org-name'];
  const userId = req.headers['x-user-id'];

  if (!orgName || !userId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Bị từ chối! Vui lòng xuất trình thẻ (x-org-name và x-user-id) trong Header.' 
    });
  }

  // Gắn thẻ vào ngực áo (req.user) để các anh quản lý bên trong biết khách là ai
  req.user = { org: orgName, userId: userId };
  next(); // Cho phép đi tiếp vào trong
};