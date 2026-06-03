'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

// ============================================================
// ĐỊNH NGHĨA STATE MACHINE
// Sản phẩm chỉ được đi theo một chiều, không được nhảy bước
// ============================================================
const ProductStatus = {
  CREATED:        'CREATED',        // Farm tạo
  PROCESSING:     'PROCESSING',     // Processor đang xử lý
  IN_TRANSIT:     'IN_TRANSIT',     // Logistics đang vận chuyển
  AT_RETAILER:    'AT_RETAILER',    // Đã đến siêu thị
  DELIVERED:      'DELIVERED',      // Đã giao cho khách
  REJECTED:       'REJECTED'        // Bị Regulator từ chối
};

// State transitions hợp lệ: key = trạng thái hiện tại, value = trạng thái tiếp theo cho phép
const VALID_TRANSITIONS = {
  [ProductStatus.CREATED]:     [ProductStatus.PROCESSING, ProductStatus.REJECTED],
  [ProductStatus.PROCESSING]:  [ProductStatus.IN_TRANSIT, ProductStatus.REJECTED],
  [ProductStatus.IN_TRANSIT]:  [ProductStatus.AT_RETAILER, ProductStatus.REJECTED],
  [ProductStatus.AT_RETAILER]: [ProductStatus.DELIVERED, ProductStatus.REJECTED],
  [ProductStatus.DELIVERED]:   [],
  [ProductStatus.REJECTED]:    []
};

// ============================================================
// ĐỊNH NGHĨA QUYỀN HẠN THEO TỔ CHỨC
// ============================================================
const ORG_PERMISSIONS = {
  CreateProduct:      ['FarmMSP'],
  UpdateProcessing:   ['ProcessorMSP'],
  AddLogistics:       ['LogisticsMSP'],
  ConfirmAtRetailer:  ['RetailerMSP'],
  ConfirmDelivery:    ['RetailerMSP'],
  RejectProduct:      ['RegulatorMSP'],
  GetProduct:         ['FarmMSP', 'ProcessorMSP', 'LogisticsMSP', 'RetailerMSP', 'RegulatorMSP'],
  GetProductHistory:  ['FarmMSP', 'ProcessorMSP', 'LogisticsMSP', 'RetailerMSP', 'RegulatorMSP'],
  QueryByStatus:      ['FarmMSP', 'ProcessorMSP', 'LogisticsMSP', 'RetailerMSP', 'RegulatorMSP'],
};

class FoodTraceabilityContract extends Contract {

  constructor() {
    super('FoodTraceability');
  }

  // ============================================================
  // HELPER METHODS (không gọi được từ bên ngoài)
  // ============================================================

  _assertPermission(ctx, functionName) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    const allowed = ORG_PERMISSIONS[functionName];
    if (!allowed || !allowed.includes(callerMSP)) {
      throw new Error(
        `Tổ chức '${callerMSP}' không có quyền gọi hàm '${functionName}'. ` +
        `Chỉ cho phép: ${allowed ? allowed.join(', ') : 'không ai'}`
      );
    }
  }

  _getTimestamp(ctx) {
    const txTimestamp = ctx.stub.getTxTimestamp();
    return new Date(txTimestamp.seconds.low * 1000).toISOString();
  }

  _validateStateTransition(currentStatus, newStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Không thể chuyển từ trạng thái '${currentStatus}' sang '${newStatus}'. ` +
        `Cho phép: ${allowed && allowed.length > 0 ? allowed.join(', ') : 'không thể chuyển tiếp'}`
      );
    }
  }

  _createHash(data) {
    const normalized = JSON.stringify(
      typeof data === 'string' ? JSON.parse(data) : data,
      null, 0
    );
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  // ============================================================
  // HÀNG 1: FARM — Tạo sản phẩm
  // ============================================================
  async CreateProduct(ctx, batchID, dataHash, farmDataJSON) {
    this._assertPermission(ctx, 'CreateProduct');

    const existing = await ctx.stub.getState(batchID);
    if (existing && existing.length > 0) {
      throw new Error(`Lô hàng '${batchID}' đã tồn tại trong blockchain`);
    }

    let farmData;
    try {
      farmData = JSON.parse(farmDataJSON);
    } catch (e) {
      throw new Error('farmDataJSON không phải JSON hợp lệ');
    }

    const computedHash = this._createHash(farmDataJSON);
    if (computedHash !== dataHash) {
      throw new Error('Data hash không khớp — dữ liệu có thể đã bị sửa đổi trước khi gửi lên chain');
    }

    const product = {
      docType: 'product',
      batchID,
      status: ProductStatus.CREATED,
      dataHash,
      farmData,
      createdBy: ctx.clientIdentity.getID(),
      createdByMSP: ctx.clientIdentity.getMSPID(),
      createdAt: this._getTimestamp(ctx),
      txHistory: [{
        txID: ctx.stub.getTxID(),
        action: 'CREATED',
        timestamp: this._getTimestamp(ctx),
        actor: ctx.clientIdentity.getMSPID()
      }]
    };

    await ctx.stub.putState(batchID, Buffer.from(JSON.stringify(product)));

    ctx.stub.setEvent('ProductCreated', Buffer.from(JSON.stringify({
      batchID,
      txID: ctx.stub.getTxID(),
      createdBy: ctx.clientIdentity.getMSPID()
    })));

    return JSON.stringify(product);
  }

  // ============================================================
  // HÀNG 2: PROCESSOR — Cập nhật thông tin chế biến
  // ============================================================
  async UpdateProcessing(ctx, batchID, processingDataHash, processingDataJSON) {
    this._assertPermission(ctx, 'UpdateProcessing');

    const productBytes = await ctx.stub.getState(batchID);
    if (!productBytes || productBytes.length === 0) {
      throw new Error(`Lô hàng '${batchID}' không tồn tại`);
    }

    const product = JSON.parse(productBytes.toString());

    this._validateStateTransition(product.status, ProductStatus.PROCESSING);

    const computedHash = this._createHash(processingDataJSON);
    if (computedHash !== processingDataHash) {
      throw new Error('Processing data hash không khớp');
    }

    let processingData;
    try {
      processingData = JSON.parse(processingDataJSON);
    } catch (e) {
      throw new Error('processingDataJSON không phải JSON hợp lệ');
    }

    product.status = ProductStatus.PROCESSING;
    product.processingDataHash = processingDataHash;
    product.processingData = processingData;
    product.processedBy = ctx.clientIdentity.getMSPID();
    product.processedAt = this._getTimestamp(ctx);
    product.txHistory.push({
      txID: ctx.stub.getTxID(),
      action: 'PROCESSING_UPDATED',
      timestamp: this._getTimestamp(ctx),
      actor: ctx.clientIdentity.getMSPID()
    });

    await ctx.stub.putState(batchID, Buffer.from(JSON.stringify(product)));
    ctx.stub.setEvent('ProductProcessed', Buffer.from(JSON.stringify({ batchID })));

    return JSON.stringify(product);
  }

  // ============================================================
  // HÀNG 3: LOGISTICS — Thêm thông tin vận chuyển
  // ============================================================
  async AddLogistics(ctx, batchID, logisticsDataHash, logisticsDataJSON) {
    this._assertPermission(ctx, 'AddLogistics');

    const productBytes = await ctx.stub.getState(batchID);
    if (!productBytes || productBytes.length === 0) {
      throw new Error(`Lô hàng '${batchID}' không tồn tại`);
    }

    const product = JSON.parse(productBytes.toString());
    this._validateStateTransition(product.status, ProductStatus.IN_TRANSIT);

    const computedHash = this._createHash(logisticsDataJSON);
    if (computedHash !== logisticsDataHash) {
      throw new Error('Logistics data hash không khớp');
    }

    let logisticsData;
    try {
      logisticsData = JSON.parse(logisticsDataJSON);
    } catch (e) {
      throw new Error('logisticsDataJSON không phải JSON hợp lệ');
    }

    product.status = ProductStatus.IN_TRANSIT;
    product.logisticsDataHash = logisticsDataHash;
    product.logisticsData = logisticsData;
    product.shippedBy = ctx.clientIdentity.getMSPID();
    product.shippedAt = this._getTimestamp(ctx);
    product.txHistory.push({
      txID: ctx.stub.getTxID(),
      action: 'LOGISTICS_ADDED',
      timestamp: this._getTimestamp(ctx),
      actor: ctx.clientIdentity.getMSPID()
    });

    await ctx.stub.putState(batchID, Buffer.from(JSON.stringify(product)));
    ctx.stub.setEvent('ProductInTransit', Buffer.from(JSON.stringify({ batchID })));

    return JSON.stringify(product);
  }

  // ============================================================
  // HÀNG 4: RETAILER — Xác nhận nhận hàng
  // ============================================================
  async ConfirmAtRetailer(ctx, batchID, retailerDataJSON) {
    this._assertPermission(ctx, 'ConfirmAtRetailer');

    const productBytes = await ctx.stub.getState(batchID);
    if (!productBytes || productBytes.length === 0) {
      throw new Error(`Lô hàng '${batchID}' không tồn tại`);
    }

    const product = JSON.parse(productBytes.toString());
    this._validateStateTransition(product.status, ProductStatus.AT_RETAILER);

    let retailerData;
    try {
      retailerData = JSON.parse(retailerDataJSON);
    } catch (e) {
      throw new Error('retailerDataJSON không phải JSON hợp lệ');
    }

    product.status = ProductStatus.AT_RETAILER;
    product.retailerData = retailerData;
    product.receivedBy = ctx.clientIdentity.getMSPID();
    product.receivedAt = this._getTimestamp(ctx);
    product.txHistory.push({
      txID: ctx.stub.getTxID(),
      action: 'AT_RETAILER',
      timestamp: this._getTimestamp(ctx),
      actor: ctx.clientIdentity.getMSPID()
    });

    await ctx.stub.putState(batchID, Buffer.from(JSON.stringify(product)));
    ctx.stub.setEvent('ProductAtRetailer', Buffer.from(JSON.stringify({ batchID })));

    return JSON.stringify(product);
  }

  // ============================================================
  // HÀNG 5: REGULATOR — Từ chối lô hàng không đạt chuẩn
  // ============================================================
  async RejectProduct(ctx, batchID, reason) {
    this._assertPermission(ctx, 'RejectProduct');

    const productBytes = await ctx.stub.getState(batchID);
    if (!productBytes || productBytes.length === 0) {
      throw new Error(`Lô hàng '${batchID}' không tồn tại`);
    }

    const product = JSON.parse(productBytes.toString());

    if (product.status === ProductStatus.DELIVERED || product.status === ProductStatus.REJECTED) {
      throw new Error(`Không thể từ chối lô hàng ở trạng thái '${product.status}'`);
    }

    product.status = ProductStatus.REJECTED;
    product.rejectionReason = reason;
    product.rejectedBy = ctx.clientIdentity.getMSPID();
    product.rejectedAt = this._getTimestamp(ctx);
    product.txHistory.push({
      txID: ctx.stub.getTxID(),
      action: 'REJECTED',
      timestamp: this._getTimestamp(ctx),
      actor: ctx.clientIdentity.getMSPID(),
      reason
    });

    await ctx.stub.putState(batchID, Buffer.from(JSON.stringify(product)));
    ctx.stub.setEvent('ProductRejected', Buffer.from(JSON.stringify({ batchID, reason })));

    return JSON.stringify(product);
  }

  // ============================================================
  // QUERY METHODS (Đọc dữ liệu)
  // ============================================================
  async GetProduct(ctx, batchID) {
    this._assertPermission(ctx, 'GetProduct');
    const productBytes = await ctx.stub.getState(batchID);
    if (!productBytes || productBytes.length === 0) {
      throw new Error(`Lô hàng '${batchID}' không tồn tại`);
    }
    return productBytes.toString();
  }

  async GetProductHistory(ctx, batchID) {
    this._assertPermission(ctx, 'GetProductHistory');
    const iterator = await ctx.stub.getHistoryForKey(batchID);
    const history = [];

    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;

        const record = {
          txID: result.value.txId,
          timestamp: new Date(result.value.timestamp.seconds.low * 1000).toISOString(),
          isDelete: result.value.isDelete,
          data: null
        };

        if (!result.value.isDelete && result.value.value) {
          try {
            record.data = JSON.parse(result.value.value.toString('utf8'));
          } catch (e) {
            record.data = result.value.value.toString('utf8');
          }
        }
        history.push(record);
      }
    } finally {
      await iterator.close();
    }
    return JSON.stringify(history);
  }

  async QueryByStatus(ctx, status) {
    this._assertPermission(ctx, 'QueryByStatus');
    const queryString = JSON.stringify({
      selector: { docType: 'product', status: status },
      sort: [{ createdAt: 'desc' }],
      use_index: ['indexStatusDoc', 'indexStatus']
    });

    const iterator = await ctx.stub.getQueryResult(queryString);
    const results = [];

    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        results.push(JSON.parse(result.value.value.toString()));
      }
    } finally {
      await iterator.close();
    }
    return JSON.stringify(results);
  }

  async VerifyProductIntegrity(ctx, batchID, claimedDataJSON, dataType) {
    const productBytes = await ctx.stub.getState(batchID);
    if (!productBytes || productBytes.length === 0) {
      throw new Error(`Lô hàng '${batchID}' không tồn tại`);
    }

    const product = JSON.parse(productBytes.toString());
    const computedHash = this._createHash(claimedDataJSON);
    let storedHash;

    switch (dataType) {
      case 'farm':       storedHash = product.dataHash; break;
      case 'processing': storedHash = product.processingDataHash; break;
      case 'logistics':  storedHash = product.logisticsDataHash; break;
      default: throw new Error(`dataType không hợp lệ: ${dataType}`);
    }

    const isValid = computedHash === storedHash;
    return JSON.stringify({ batchID, dataType, isValid, computedHash, storedHash, verifiedAt: this._getTimestamp(ctx) });
  }
}

module.exports = FoodTraceabilityContract;