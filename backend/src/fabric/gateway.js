'use strict';

const { Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { getWallet } = require('./wallet');

// Đường dẫn tới thư mục chứa "bản đồ mạng lưới" (Connection Profiles)
const CONNECTION_PROFILES_PATH = path.join(__dirname, '../../connection-profiles');

/**
 * Mở cửa kết nối vào mạng lưới Blockchain
 */
async function getGateway(orgName, userId) {
  // Tìm bản đồ mạng lưới của công ty tương ứng
  const ccpPath = path.join(CONNECTION_PROFILES_PATH, `${orgName}-connection.json`);

  if (!fs.existsSync(ccpPath)) {
    throw new Error(`Không tìm thấy file kết nối mạng: ${ccpPath}`);
  }

  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  
  // Mở tủ lấy thẻ nhân viên
  const wallet = await getWallet(orgName);
  const identity = await wallet.get(userId);
  
  if (!identity) {
    throw new Error(`Thẻ nhân viên '${userId}' không có trong ví của '${orgName}'. Cần đăng ký trước.`);
  }

  // Khởi tạo cửa an ninh (Gateway)
  const gateway = new Gateway();

  // Mở cửa kết nối
  await gateway.connect(ccp, {
    wallet,
    identity: userId,
    discovery: { enabled: true, asLocalhost: true } // asLocalhost: true vì chúng ta đang chạy test trên 1 máy
  });

  return gateway;
}

/**
 * Lấy ra "Bộ luật" (Contract) để bắt đầu gọi hàm
 */
async function getContract(orgName, userId, channelName, chaincodeName) {
  const gateway = await getGateway(orgName, userId);

  try {
    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);
    return { contract, gateway };
  } catch (error) {
    await gateway.disconnect();
    throw error;
  }
}

module.exports = { getGateway, getContract };