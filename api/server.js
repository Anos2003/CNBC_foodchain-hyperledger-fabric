const express = require("express");
const { Gateway, Wallets } = require("fabric-network");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// ========================================================
// ĐỒNG BỘ FRONTEND: Biến Server API thành Server phát giao diện Web
// ========================================================
app.use(express.static(path.join(__dirname, "../web")));

// ========================================================
// 0. CUỐN SỔ TAY LƯU TRỮ ID LÔ HÀNG (GIẢI QUYẾT LỖI LEVELDB)
// ========================================================
const idsFilePath = path.join(__dirname, "ids.json");

function getSavedIds() {
  if (!fs.existsSync(idsFilePath)) return [];
  const data = fs.readFileSync(idsFilePath);
  return JSON.parse(data);
}

function saveId(id) {
  const ids = getSavedIds();
  if (!ids.includes(id)) {
    ids.push(id);
    fs.writeFileSync(idsFilePath, JSON.stringify(ids, null, 2));
  }
}

// ========================================================
// 1. BẢN ĐỒ TĨNH: CHỈ ĐƯỜNG ĐẾN CẢ 5 TỔ CHỨC VÀ TRẠM GÁC
// ========================================================
const ccp = {
  name: "supplychain-network",
  version: "1.0.0",
  client: { organization: "Farm" },
  organizations: {
    Farm: { mspid: "FarmMSP", peers: ["peer0.farm.example.com"] },
    Processor: {
      mspid: "ProcessorMSP",
      peers: ["peer0.processor.example.com"],
    },
    Logistics: {
      mspid: "LogisticsMSP",
      peers: ["peer0.logistics.example.com"],
    },
    Retailer: { mspid: "RetailerMSP", peers: ["peer0.retailer.example.com"] },
    Regulator: {
      mspid: "RegulatorMSP",
      peers: ["peer0.regulator.example.com"],
    },
  },
  peers: {
    "peer0.farm.example.com": {
      url: "grpcs://127.0.0.1:7051",
      tlsCACerts: {
        path: path.join(
          __dirname,
          "../fabric-network/crypto-config/peerOrganizations/farm.example.com/peers/peer0.farm.example.com/tls/ca.crt",
        ),
      },
      grpcOptions: { "ssl-target-name-override": "peer0.farm.example.com" },
    },
    "peer0.processor.example.com": {
      url: "grpcs://127.0.0.1:8051",
      tlsCACerts: {
        path: path.join(
          __dirname,
          "../fabric-network/crypto-config/peerOrganizations/processor.example.com/peers/peer0.processor.example.com/tls/ca.crt",
        ),
      },
      grpcOptions: {
        "ssl-target-name-override": "peer0.processor.example.com",
      },
    },
    "peer0.logistics.example.com": {
      url: "grpcs://127.0.0.1:9051",
      tlsCACerts: {
        path: path.join(
          __dirname,
          "../fabric-network/crypto-config/peerOrganizations/logistics.example.com/peers/peer0.logistics.example.com/tls/ca.crt",
        ),
      },
      grpcOptions: {
        "ssl-target-name-override": "peer0.logistics.example.com",
      },
    },
    "peer0.retailer.example.com": {
      url: "grpcs://127.0.0.1:10051",
      tlsCACerts: {
        path: path.join(
          __dirname,
          "../fabric-network/crypto-config/peerOrganizations/retailer.example.com/peers/peer0.retailer.example.com/tls/ca.crt",
        ),
      },
      grpcOptions: { "ssl-target-name-override": "peer0.retailer.example.com" },
    },
    "peer0.regulator.example.com": {
      url: "grpcs://127.0.0.1:11051",
      tlsCACerts: {
        path: path.join(
          __dirname,
          "../fabric-network/crypto-config/peerOrganizations/regulator.example.com/peers/peer0.regulator.example.com/tls/ca.crt",
        ),
      },
      grpcOptions: {
        "ssl-target-name-override": "peer0.regulator.example.com",
      },
    },
  },
  orderers: {
    "orderer1.example.com": {
      url: "grpcs://127.0.0.1:7050",
      tlsCACerts: {
        path: path.join(
          __dirname,
          "../fabric-network/crypto-config/ordererOrganizations/example.com/orderers/orderer1.example.com/tls/ca.crt",
        ),
      },
      grpcOptions: { "ssl-target-name-override": "orderer1.example.com" },
    },
  },
  channels: {
    "supplychain-channel": {
      orderers: ["orderer1.example.com"],
      peers: {
        "peer0.farm.example.com": { endorsingPeer: true },
        "peer0.processor.example.com": { endorsingPeer: true },
        "peer0.logistics.example.com": { endorsingPeer: true },
        "peer0.retailer.example.com": { endorsingPeer: true },
        "peer0.regulator.example.com": { endorsingPeer: true },
      },
    },
  },
};

// ========================================================
// 2. HÀM LẤY QUYỀN TRUY CẬP TỪ VÍ
// ========================================================
async function connectToNetwork(orgDomain, mspId, orgName) {
  const wallet = await Wallets.newInMemoryWallet();

  const certPath = path.join(
    __dirname,
    `../fabric-network/crypto-config/peerOrganizations/${orgDomain}/users/Admin@${orgDomain}/msp/signcerts/Admin@${orgDomain}-cert.pem`,
  );
  const keyDir = path.join(
    __dirname,
    `../fabric-network/crypto-config/peerOrganizations/${orgDomain}/users/Admin@${orgDomain}/msp/keystore`,
  );
  const keyFiles = fs.readdirSync(keyDir);
  const keyPath = path.join(keyDir, keyFiles[0]);

  const certificate = fs.readFileSync(certPath).toString();
  const privateKey = fs.readFileSync(keyPath).toString();

  await wallet.put("admin", {
    credentials: { certificate, privateKey },
    mspId: mspId,
    type: "X.509",
  });

  const dynamicCCP = JSON.parse(JSON.stringify(ccp));
  dynamicCCP.client.organization = orgName;

  const gateway = new Gateway();
  await gateway.connect(dynamicCCP, {
    wallet,
    identity: "admin",
    discovery: { enabled: false },
  });

  const network = await gateway.getNetwork("supplychain-channel");
  return { network, gateway };
}

// ========================================================
// 3. API KHÁCH HÀNG: TRA CỨU DỮ LIỆU CHUNG
// ========================================================
app.get("/api/product/:id", async (req, res) => {
  let gateway;
  try {
    const { network, gateway: gw } = await connectToNetwork(
      "farm.example.com",
      "FarmMSP",
      "Farm",
    );
    gateway = gw;
    const contract = network.getContract("supplychain");

    const result = await contract.evaluateTransaction(
      "GetProduct",
      req.params.id,
    );
    res.status(200).json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: "Không tìm thấy mã lô hàng này!" });
  } finally {
    if (gateway) await gateway.disconnect();
  }
});

// ========================================================
// 4. API NÔNG TRẠI: KHỞI TẠO LÔ HÀNG
// ========================================================
app.post("/api/product", async (req, res) => {
  let gateway;
  try {
    const { batchID, ProductName, FarmName, Location, Date, ImageURL } =
      req.body;
    if (!batchID || !ProductName || !FarmName || !Location || !Date) {
      return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin!" });
    }

    const { network, gateway: gw } = await connectToNetwork(
      "farm.example.com",
      "FarmMSP",
      "Farm",
    );
    gateway = gw;
    const contract = network.getContract("supplychain");

    const farmData = {
      ProductName,
      FarmName,
      Location,
      Date,
      ImageURL: ImageURL || "",
    };
    const farmDataString = JSON.stringify(farmData);
    const hash = crypto
      .createHash("sha256")
      .update(farmDataString)
      .digest("hex");

    await contract.submitTransaction(
      "CreateProduct",
      batchID,
      hash,
      farmDataString,
    );

    saveId(batchID); // Ghi nhận ID vào sổ tay phục vụ việc tải danh sách kho

    res.status(200).json({ message: "Thành công!", batchID, hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (gateway) await gateway.disconnect();
  }
});

// ========================================================
// 5. API NHÀ MÁY: CẬP NHẬT CHẾ BIẾN
// ========================================================
app.post("/api/processing", async (req, res) => {
  let gateway;
  try {
    const { batchID, ProcessorName, Method, Date } = req.body;
    if (!batchID || !ProcessorName || !Method || !Date)
      return res
        .status(400)
        .json({ error: "Vui lòng điền đủ thông tin Nhà Máy!" });

    const { network, gateway: gw } = await connectToNetwork(
      "processor.example.com",
      "ProcessorMSP",
      "Processor",
    );
    gateway = gw;
    const contract = network.getContract("supplychain");

    const procData = { ProcessorName, Method, Date };
    const procDataString = JSON.stringify(procData);
    const hash = crypto
      .createHash("sha256")
      .update(procDataString)
      .digest("hex");

    await contract.submitTransaction(
      "UpdateProcessing",
      batchID,
      hash,
      procDataString,
    );
    res.status(200).json({ message: "Cập nhật thành công!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (gateway) await gateway.disconnect();
  }
});

// ========================================================
// 6. API VẬN CHUYỂN: CẬP NHẬT LOGISTICS
// ========================================================
app.post("/api/logistics", async (req, res) => {
  let gateway;
  try {
    const { batchID, Company, VehicleID, Temp, Date } = req.body;
    if (!batchID || !Company || !VehicleID || !Temp || !Date)
      return res
        .status(400)
        .json({ error: "Vui lòng điền đủ thông tin Vận Chuyển!" });

    const { network, gateway: gw } = await connectToNetwork(
      "logistics.example.com",
      "LogisticsMSP",
      "Logistics",
    );
    gateway = gw;
    const contract = network.getContract("supplychain");

    const logData = { Company, VehicleID, Temp, Date };
    const logDataString = JSON.stringify(logData);
    const hash = crypto
      .createHash("sha256")
      .update(logDataString)
      .digest("hex");

    await contract.submitTransaction(
      "AddLogistics",
      batchID,
      hash,
      logDataString,
    );
    res.status(200).json({ message: "Cập nhật thành công!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (gateway) await gateway.disconnect();
  }
});

// ========================================================
// 7. API SIÊU THỊ: CẬP NHẬT NHẬP KHO
// ========================================================
app.post("/api/retailer", async (req, res) => {
  let gateway;
  try {
    const { batchID, RetailerName, Location, Date } = req.body;
    if (!batchID || !RetailerName || !Location || !Date)
      return res
        .status(400)
        .json({ error: "Vui lòng điền đủ thông tin Siêu Thị!" });

    const { network, gateway: gw } = await connectToNetwork(
      "retailer.example.com",
      "RetailerMSP",
      "Retailer",
    );
    gateway = gw;
    const contract = network.getContract("supplychain");

    const retData = { RetailerName, Location, ReceivedDate: Date };
    const retDataString = JSON.stringify(retData);

    await contract.submitTransaction(
      "ConfirmAtRetailer",
      batchID,
      retDataString,
    );
    res.status(200).json({ message: "Cập nhật thành công!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (gateway) await gateway.disconnect();
  }
});

// ========================================================
// 8. API MỚI: KÉO TOÀN BỘ KHO DỮ LIỆU TỪ BLOCKCHAIN
// ========================================================
app.get("/api/products", async (req, res) => {
  let gateway;
  try {
    const ids = getSavedIds();
    if (ids.length === 0) return res.status(200).json([]);

    const { network, gateway: gw } = await connectToNetwork(
      "farm.example.com",
      "FarmMSP",
      "Farm",
    );
    gateway = gw;
    const contract = network.getContract("supplychain");

    let allProducts = [];

    for (let id of ids) {
      try {
        const resultBytes = await contract.evaluateTransaction(
          "GetProduct",
          id,
        );
        allProducts.push(JSON.parse(resultBytes.toString()));
      } catch (e) {
        console.log(`Bỏ qua ID không hợp lệ: ${id}`);
      }
    }

    allProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(allProducts);
  } catch (error) {
    console.error("❌ Lỗi lấy danh sách Kho:", error.message);
    res.status(500).json({ error: "Không thể kéo dữ liệu từ Blockchain!" });
  } finally {
    if (gateway) await gateway.disconnect();
  }
});

app.listen(3000, () => {
  console.log(
    "🎉 API & WEB READY: Hệ thống hợp nhất chạy tại cổng 3000 thành công!",
  );
});
