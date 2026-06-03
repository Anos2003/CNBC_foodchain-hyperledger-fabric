'use strict';

const { getContract } = require('../fabric/gateway');
const crypto = require('crypto');

const CHANNEL_NAME = 'mychannel'; // Tên channel mạng lưới
const CHAINCODE_NAME = 'farm';    // Tên bộ luật (chaincode) chúng ta đã đặt

/**
 * ĐÚNG CHỖ: Tạo vân tay dữ liệu (Hash SHA256) ngay tại Backend
 */
function createDataHash(data) {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Hàm giả lập lấy thông tin người đang gọi (Sau này sẽ dùng JWT Token thật)
function getOrgFromRequest(req) {
  // Giả sử req.headers chứa thông tin (để test cho dễ)
  return {
    orgName: req.headers['x-org-name'] || 'farm',
    userId: req.headers['x-user-id'] || 'admin'
  };
}

// ─── HÀM GHI DỮ LIỆU: TẠO SẢN PHẨM MỚI ───────────────────────────────────────
exports.createProduct = async (req, res) => {
  let gateway;

  try {
    const { orgName, userId } = getOrgFromRequest(req);

    const { batchID, farmData } = req.body;
    if (!batchID || !farmData) {
      return res.status(400).json({ success: false, message: 'Thiếu batchID hoặc farmData' });
    }

    // 1. Tạo vân tay bảo mật (Hash)
    const dataHash = createDataHash(farmData);
    const farmDataJSON = JSON.stringify(farmData);

    // 2. Đi qua Cổng an ninh lấy Bộ luật ra
    const { contract, gateway: gw } = await getContract(orgName, userId, CHANNEL_NAME, CHAINCODE_NAME);
    gateway = gw;

    // 3. Thực hiện Ghi sổ (Submit Transaction)
    console.log(`\nĐang gửi lệnh CreateProduct cho lô ${batchID}...`);
    const result = await contract.submitTransaction('CreateProduct', batchID, dataHash, farmDataJSON);

    return res.status(201).json({
      success: true,
      message: 'Sản phẩm đã được tạo thành công trên blockchain',
      data: JSON.parse(result.toString()),
      dataHash: dataHash // Trả về hash để người dùng xác thực
    });

  } catch (error) {
    console.error('Lỗi CreateProduct:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (gateway) gateway.disconnect(); // Ghi xong phải đóng cổng lại
  }
};

// ─── HÀM ĐỌC DỮ LIỆU: XEM LỊCH SỬ VÒNG ĐỜI ──────────────────────────────────
exports.getProductHistory = async (req, res) => {
  let gateway;

  try {
    const { orgName, userId } = getOrgFromRequest(req);
    const { batchID } = req.params;

    const { contract, gateway: gw } = await getContract(orgName, userId, CHANNEL_NAME, CHAINCODE_NAME);
    gateway = gw;

    // Đọc sổ thì dùng evaluateTransaction (không cần mạng lưới xác thực sự đồng thuận)
    console.log(`\nĐang truy xuất lịch sử lô ${batchID}...`);
    const result = await contract.evaluateTransaction('GetProductHistory', batchID);
    const history = JSON.parse(result.toString());

    return res.status(200).json({
      success: true,
      batchID,
      totalEvents: history.length,
      history
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (gateway) gateway.disconnect();
  }
};