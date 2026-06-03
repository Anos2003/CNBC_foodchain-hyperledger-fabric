'use strict';

const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Tủ đựng thẻ sẽ nằm ở thư mục "wallets"
const WALLET_BASE_PATH = path.join(__dirname, '../../wallets');

// Hàm lấy ví của công ty
async function getWallet(orgName) {
  const walletPath = path.join(WALLET_BASE_PATH, orgName);
  if (!fs.existsSync(walletPath)) {
    fs.mkdirSync(walletPath, { recursive: true });
  }
  return await Wallets.newFileSystemWallet(walletPath);
}

// Hàm "đăng ký" sếp tổng (Admin) của công ty để lấy chứng chỉ
async function enrollAdmin(orgName, caUrl, orgMSP) {
  const { FabricCAServices } = require('fabric-ca-client');
  const wallet = await getWallet(orgName);

  if (await wallet.get('admin')) {
    console.log(`Admin của ${orgName} đã có thẻ trong ví.`);
    return;
  }

  const ca = new FabricCAServices(caUrl, { trustedRoots: [], verify: false }, `ca-${orgName}`);
  const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });

  const identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    },
    mspId: orgMSP,
    type: 'X.509'
  };

  await wallet.put('admin', identity);
  console.log(`✅ Đã cất thẻ Admin của ${orgName} vào ví.`);
}

module.exports = { getWallet, enrollAdmin };