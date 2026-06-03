/* ─── 1. ĐỒNG BỘ DANH SÁCH KHO TỪ BLOCKCHAIN ─── */
window.addEventListener("load", () => {
  loadProductList();
});

async function loadProductList() {
  const container = document.getElementById("productList");
  container.innerHTML =
    "<p style='grid-column: 1/-1; text-align:center; color: var(--primary); font-weight:600; padding: 20px 0;'>⏳ Đang đồng bộ sổ cái từ mạng lưới Blockchain...</p>";

  try {
    const res = await fetch("/api/products");
    if (!res.ok) throw new Error();
    const list = await res.json();

    // Cập nhật thống kê
    document.getElementById("stat_total").innerText = list.length;
    document.getElementById("stat_proc").innerText = list.filter(
      (item) => item.status === "PROCESSING",
    ).length;
    document.getElementById("stat_log").innerText = list.filter(
      (item) => item.status === "IN_TRANSIT",
    ).length;
    document.getElementById("stat_ret").innerText = list.filter(
      (item) => item.status === "AT_RETAILER" || item.status === "DELIVERED",
    ).length;

    if (list.length === 0) {
      container.innerHTML =
        "<p style='grid-column: 1/-1; text-align:center; color: var(--text-soft); font-size: 13.5px; padding: 20px 0;'>Chưa có dữ liệu nào trên Blockchain.</p>";
      return;
    }

    container.innerHTML = list
      .map((item) => {
        let statusColor = "var(--text-muted)";
        if (item.status === "CREATED") statusColor = "var(--farm)";
        if (item.status === "PROCESSING") statusColor = "var(--proc)";
        if (item.status === "IN_TRANSIT") statusColor = "var(--log)";
        if (item.status === "AT_RETAILER") statusColor = "var(--ret)";

        return `
        <div class="product-card">
            <img class="product-card-thumb" src="${item.farmData?.ImageURL || "https://via.placeholder.com/300x200/e5e7eb/6b7280?text=FoodChain"}" alt="Thumb">
            <h4>${item.farmData?.ProductName || "Sản phẩm"}</h4>
            <p>Mã Hàng: <b>${item.batchID}</b></p>
            <p style="font-size:11px; margin-top:-10px; font-weight:600; color: ${statusColor}">Trạng thái: ${item.status}</p>
            <button class="btn-qr-show" onclick="openQRModal('${item.batchID}', '${item.farmData?.ProductName || "Sản phẩm"}')">🔍 Hiển thị QR</button>
        </div>
        `;
      })
      .join("");
  } catch (error) {
    container.innerHTML =
      "<p style='grid-column: 1/-1; text-align:center; color: var(--ret); font-weight:600;'>❌ Không thể kết nối với mạng lưới Blockchain!</p>";
  }
}

/* ─── 2. Chuyển đổi tab ─── */
function switchTab(tabId, element) {
  document
    .querySelectorAll(".tab-pane")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".menu-item")
    .forEach((item) => item.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  element.classList.add("active");
  document
    .querySelectorAll(".msg")
    .forEach((msg) => msg.classList.remove("show"));

  document
    .querySelectorAll(".chain-node")
    .forEach((node) => node.classList.remove("active"));
  const nodeMap = {
    farm: ".farm-node",
    processor: ".proc-node",
    logistics: ".log-node",
    retailer: ".ret-node",
  };
  const activeNode = document.querySelector(nodeMap[tabId]);
  if (activeNode) {
    activeNode.classList.add("active");
    setTimeout(() => {
      activeNode.classList.remove("active");
    }, 800);
  }
}

/* ─── 3. Hàm gọi API POST dùng chung ─── */
async function postData(url, data, msgId) {
  const msg = document.getElementById(msgId);
  msg.className = "msg show";
  msg.style.backgroundColor = "#fffbeb";
  msg.style.color = "#d97706";
  msg.style.borderColor = "#fde68a";
  msg.innerText = "⏳ Đang mã hóa và đẩy lên Blockchain...";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const responseData = await res.json();
    if (!res.ok) throw new Error(responseData.error || "Giao dịch bị từ chối");

    msg.style.backgroundColor = "#f0fdf4";
    msg.style.color = "#15803d";
    msg.style.borderColor = "#bbf7d0";
    msg.innerHTML = `✅ <b>Thành công!</b> Dữ liệu đã được khóa vĩnh viễn.<br>
    <span style="font-family:var(--font-mono);font-size:10.5px;color:#64748b;display:block;margin-top:5px;">
      ${responseData.hash ? "Hash: " + responseData.hash : ""}
    </span>`;

    setTimeout(() => {
      const activePane = document.querySelector(".tab-pane.active");
      if (activePane)
        activePane
          .querySelectorAll("input")
          .forEach((input) => (input.value = ""));
    }, 1500);
  } catch (e) {
    msg.style.backgroundColor = "#fef2f2";
    msg.style.color = "#dc2626";
    msg.style.borderColor = "#fecaca";
    msg.innerText = `❌ Lỗi: ${e.message}`;
  }
}

/* ─── 4. Các hàm Submit Form ─── */
async function submitFarm() {
  const batchID = document.getElementById("farm_batchID").value.trim();
  const productName = document.getElementById("farm_productName").value.trim();
  const imageURL = document.getElementById("farm_image").value.trim();
  if (!batchID || !productName) {
    alert("Vui lòng điền đủ Mã Lô Hàng và Tên Sản Phẩm!");
    return;
  }

  await postData(
    "/api/product",
    {
      batchID: batchID,
      ProductName: productName,
      FarmName: document.getElementById("farm_name").value,
      Location: document.getElementById("farm_location").value,
      Date: document.getElementById("farm_date").value,
      ImageURL: imageURL,
    },
    "msg_farm",
  );

  setTimeout(() => {
    const msgBox = document.getElementById("msg_farm");
    if (msgBox.innerText.includes("Thành công")) loadProductList();
  }, 1600);
}

async function submitProcessor() {
  await postData(
    "/api/processing",
    {
      batchID: document.getElementById("proc_batchID").value,
      ProcessorName: document.getElementById("proc_name").value,
      Method: document.getElementById("proc_method").value,
      Date: document.getElementById("proc_date").value,
    },
    "msg_processor",
  );
  setTimeout(loadProductList, 1600);
}
async function submitLogistics() {
  await postData(
    "/api/logistics",
    {
      batchID: document.getElementById("log_batchID").value,
      Company: document.getElementById("log_company").value,
      VehicleID: document.getElementById("log_vehicle").value,
      Temp: document.getElementById("log_temp").value,
      Date: document.getElementById("log_date").value,
    },
    "msg_logistics",
  );
  setTimeout(loadProductList, 1600);
}
async function submitRetailer() {
  await postData(
    "/api/retailer",
    {
      batchID: document.getElementById("ret_batchID").value,
      RetailerName: document.getElementById("ret_name").value,
      Location: document.getElementById("ret_location").value,
      Date: document.getElementById("ret_date").value,
    },
    "msg_retailer",
  );
  setTimeout(loadProductList, 1600);
}

/* ─── 5. Modal Phóng to QR Code */
let modalQRInstance = null;
function openQRModal(batchID, productName) {
  document.getElementById("modalTitle").innerText =
    productName + " — " + batchID;
  document.getElementById("qrModal").classList.add("active");
  const qrBox = document.getElementById("modalQRCode");
  qrBox.innerHTML = "";

  const qrLink = `${window.location.origin}/truy-xuat.html?id=${batchID}`;

  modalQRInstance = new QRCode(qrBox, {
    text: qrLink,
    width: 220,
    height: 220,
    colorDark: "#111827",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });
}
function closeModal() {
  document.getElementById("qrModal").classList.remove("active");
}

/* ─── 6. Khởi chạy Camera quét mã QR ─── */
const scanner = new Html5QrcodeScanner(
  "reader",
  { fps: 10, qrbox: { width: 250, height: 250 } },
  false,
);
scanner.render(
  (decodedText) => {
    document.getElementById("maLoHang").value = decodedText;
    fetchData(decodedText);
  },
  () => {},
);

/* ─── 7. Tra cứu kết quả nội bộ ─── */
async function fetchData(batchID) {
  const timeline = document.getElementById("timeline");
  const title = document.getElementById("tenSanPham");
  batchID = batchID.trim();
  if (!batchID) {
    alert("Vui lòng nhập hoặc quét mã lô hàng!");
    return;
  }

  timeline.style.display = "block";
  timeline.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted);font-size:13.5px;">⏳ Đang truy vấn sổ cái Blockchain...</div>`;
  title.style.display = "none";

  try {
    const res = await fetch("/api/product/" + batchID);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    title.style.display = "block";
    title.innerText = "📦 " + (data.farmData?.ProductName || "Sản phẩm");
    const hashTag = (hash) =>
      hash
        ? `<div class="hash-tag"><span class="hash-prefix">TX</span>${hash}</div>`
        : "";
    const pending = (label) =>
      `<div class="pending-state"><span class="pending-dot"></span>Đang chờ ${label}...</div>`;

    timeline.innerHTML = `
    <div class="verified-banner"><span class="v-dot"></span>Dữ liệu đã được xác thực trên Blockchain — không thể sửa đổi</div>
    <div class="tracking-item completed"><div class="track-connector"><div class="tracking-icon farm">🌾</div><div class="track-vline"></div></div><div class="tracking-content"><div class="tracking-card farm"><h4>Nông Trại Sản Xuất</h4><p><b>Cơ sở:</b> ${data.farmData?.FarmName || "N/A"}</p><p><b>Vị trí:</b> ${data.farmData?.Location || "N/A"}</p><p><b>Ngày thu hoạch:</b> ${data.farmData?.Date || "N/A"}</p>${hashTag(data.dataHash)}</div></div></div>
    <div class="tracking-item ${data.processingData ? "completed" : ""}"><div class="track-connector"><div class="tracking-icon proc">🏭</div><div class="track-vline"></div></div><div class="tracking-content"><div class="tracking-card proc"><h4>Nhà Máy Chế Biến</h4>${data.processingData ? `<p><b>Nhà máy:</b> ${data.processingData.ProcessorName}</p><p><b>Quy cách:</b> ${data.processingData.Method}</p><p><b>Ngày đóng gói:</b> ${data.processingData.Date}</p>${hashTag(data.processingDataHash)}` : pending("tiếp nhận tại nhà máy")}</div></div></div>
    <div class="tracking-item ${data.logisticsData ? "completed" : ""}"><div class="track-connector"><div class="tracking-icon log">🚚</div><div class="track-vline"></div></div><div class="tracking-content"><div class="tracking-card log"><h4>Đơn Vị Vận Chuyển</h4>${data.logisticsData ? `<p><b>Đối tác:</b> ${data.logisticsData.Company}</p><p><b>Phương tiện:</b> ${data.logisticsData.VehicleID}</p><p><b>Nhiệt độ:</b> ${data.logisticsData.Temp}</p><p><b>Ngày đi:</b> ${data.logisticsData.Date}</p>${hashTag(data.logisticsDataHash)}` : pending("điều phối xe vận chuyển")}</div></div></div>
    <div class="tracking-item ${data.retailerData ? "completed" : ""}"><div class="track-connector"><div class="tracking-icon ret">🛒</div><div class="track-vline"></div></div><div class="tracking-content"><div class="tracking-card ret"><h4>Siêu Thị Phân Phối</h4>${data.retailerData ? `<p><b>Hệ thống:</b> ${data.retailerData.RetailerName}</p><p><b>Chi nhánh:</b> ${data.retailerData.Location}</p><p><b>Ngày lên kệ:</b> ${data.retailerData.ReceivedDate}</p>` : pending("nhập kho siêu thị")}</div></div></div>
  `;
  } catch (e) {
    timeline.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;padding:20px;border-radius:12px;text-align:center;color:#dc2626;font-weight:600;font-size:13.5px;">❌ Không tìm thấy dữ liệu của mã lô hàng này trên Blockchain!</div>`;
  }
}
