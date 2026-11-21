using Nexus.Domain;

namespace Nexus.Application;

public sealed record RetailShopView(
    int Id,
    string Code,
    string Name,
    string CityCode,
    string? CityName,
    string Address,
    string Phone,
    bool Active);

public sealed record VendorView(
    int Id,
    string Code,
    string Name,
    string ContactPerson,
    string Phone,
    string Email,
    string Address,
    bool Active);

public sealed record PurchaseOrderView(
    int Id,
    string OrderNumber,
    int VendorId,
    string VendorName,
    int ProductId,
    string ProductName,
    int Quantity,
    decimal UnitPrice,
    decimal TotalAmount,
    string Status,
    DateTime OrderedAt,
    DateTime? ReceivedAt,
    string? Note,
    decimal PaidAmount,
    string PaymentStatus);

public sealed record VendorPaymentView(
    int Id,
    string PaymentNumber,
    int PurchaseOrderId,
    string PurchaseOrderNumber,
    int VendorId,
    string VendorName,
    decimal Amount,
    DateTime PaidAt,
    string Method,
    string? Reference,
    string? Note);

public sealed record EquipmentStockView(
    int Id,
    string Name,
    string Description,
    bool Active,
    int QuantityInStock,
    decimal ReplacementPrice,
    int PendingAllocations,
    int AllocatedCount);

public sealed record EquipmentInventorySummaryView(int PendingFeasibleOrders);

public sealed record EquipmentIncidentView(
    int Id,
    long ConnectionId,
    string AccountId,
    string? CustomerName,
    string? CustomerPhone,
    int ProductId,
    string ProductName,
    DateTime IncidentDate,
    string Description,
    decimal ReplacementFee,
    string RecordedByUsername,
    bool Settled);

/// <summary>Application service managing retail outlets, vendors, purchase orders, vendor payments, and equipment stock.</summary>
public sealed class InventoryService(IInventoryStore store, ICatalogStore catalog, IOperationsStore operations)
{
    // ==================== Retail Shops ====================

    public async Task<IReadOnlyList<RetailShopView>> RetailShopsAsync(string? cityCode, bool includeInactive = false)
    {
        var shops = await store.ListRetailShopsAsync(cityCode, includeInactive);
        return shops.Select(ToShopView).ToArray();
    }

    public async Task<RetailShopView> CreateRetailShopAsync(RetailShopInput input)
    {
        var cityCode = input.CityCode.Trim();
        var code = input.Code.Trim().ToUpperInvariant();
        if (!await catalog.CityExistsAsync(cityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city code.");

        const string duplicate = "A retail shop with this code already exists.";
        if (await store.RetailShopCodeExistsAsync(code))
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        var shop = new RetailShop
        {
            Code = code,
            Name = input.Name.Trim(),
            CityCode = cityCode,
            Address = input.Address.Trim(),
            Phone = input.Phone.Trim(),
            Active = input.Active
        };
        store.Add(shop);
        try { await store.SaveChangesAsync(); }
        catch (StoreWriteException error) when (!error.ConcurrentChange)
        {
            if (!await store.RetailShopCodeExistsAsync(code)) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }
        var reloaded = await store.FindRetailShopAsync(shop.Id) ?? shop;
        return ToShopView(reloaded);
    }

    public async Task<RetailShopView> UpdateRetailShopAsync(int id, RetailShopInput input)
    {
        var shop = await store.FindRetailShopAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Retail shop not found.");

        var cityCode = input.CityCode.Trim();
        var code = input.Code.Trim().ToUpperInvariant();
        if (!await catalog.CityExistsAsync(cityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city code.");

        const string duplicate = "A retail shop with this code already exists.";
        if (await store.RetailShopCodeExistsAsync(code, id))
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        shop.Code = code;
        shop.Name = input.Name.Trim();
        shop.CityCode = cityCode;
        shop.Address = input.Address.Trim();
        shop.Phone = input.Phone.Trim();
        shop.Active = input.Active;

        try { await store.SaveChangesAsync(); }
        catch (StoreWriteException error) when (!error.ConcurrentChange)
        {
            if (!await store.RetailShopCodeExistsAsync(code, id)) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }
        var reloaded = await store.FindRetailShopAsync(shop.Id) ?? shop;
        return ToShopView(reloaded);
    }

    public async Task ArchiveRetailShopAsync(int id)
    {
        var shop = await store.FindRetailShopAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Retail shop not found.");
        shop.Active = false;
        await store.SaveChangesAsync();
    }

    // ==================== Vendors ====================

    public async Task<IReadOnlyList<VendorView>> VendorsAsync(bool includeInactive = false)
    {
        var vendors = await store.ListVendorsAsync(includeInactive);
        return vendors.Select(ToVendorView).ToArray();
    }

    public async Task<VendorView> CreateVendorAsync(VendorInput input)
    {
        var code = input.Code.Trim().ToUpperInvariant();
        const string duplicate = "A vendor with this code already exists.";
        if (await store.VendorCodeExistsAsync(code))
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        var vendor = new Vendor
        {
            Code = code,
            Name = input.Name.Trim(),
            ContactPerson = input.ContactPerson.Trim(),
            Phone = input.Phone.Trim(),
            Email = input.Email.Trim().ToLowerInvariant(),
            Address = input.Address.Trim(),
            Active = input.Active
        };
        store.Add(vendor);
        try { await store.SaveChangesAsync(); }
        catch (StoreWriteException error) when (!error.ConcurrentChange)
        {
            if (!await store.VendorCodeExistsAsync(code)) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }
        return ToVendorView(vendor);
    }

    public async Task<VendorView> UpdateVendorAsync(int id, VendorInput input)
    {
        var vendor = await store.FindVendorAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Vendor not found.");

        var code = input.Code.Trim().ToUpperInvariant();
        const string duplicate = "A vendor with this code already exists.";
        if (await store.VendorCodeExistsAsync(code, id))
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        vendor.Code = code;
        vendor.Name = input.Name.Trim();
        vendor.ContactPerson = input.ContactPerson.Trim();
        vendor.Phone = input.Phone.Trim();
        vendor.Email = input.Email.Trim().ToLowerInvariant();
        vendor.Address = input.Address.Trim();
        vendor.Active = input.Active;

        try { await store.SaveChangesAsync(); }
        catch (StoreWriteException error) when (!error.ConcurrentChange)
        {
            if (!await store.VendorCodeExistsAsync(code, id)) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }
        return ToVendorView(vendor);
    }

    public async Task ArchiveVendorAsync(int id)
    {
        var vendor = await store.FindVendorAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Vendor not found.");
        vendor.Active = false;
        await store.SaveChangesAsync();
    }

    // ==================== Purchase Orders ====================

    public async Task<IReadOnlyList<PurchaseOrderView>> PurchaseOrdersAsync(string? status)
    {
        var orders = await store.ListPurchaseOrdersAsync(status);
        return orders.Select(ToPurchaseOrderView).ToArray();
    }

    public async Task<PurchaseOrderView> CreatePurchaseOrderAsync(PurchaseOrderInput input)
    {
        var vendor = await store.FindVendorAsync(input.VendorId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Vendor not found.");
        if (!vendor.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Selected vendor is inactive.");

        var product = await catalog.FindProductAsync(input.ProductId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Product not found.");
        if (!product.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Selected product is inactive.");

        ValidatePrice(input.UnitPrice);
        var po = new PurchaseOrder
        {
            OrderNumber = "",
            VendorId = vendor.Id,
            ProductId = product.Id,
            Quantity = input.Quantity,
            UnitPrice = input.UnitPrice,
            TotalAmount = Math.Round(input.Quantity * input.UnitPrice, 2),
            Status = "Ordered",
            OrderedAt = DateTime.UtcNow,
            Note = input.Note?.Trim()
        };
        store.Add(po);

        // Retry unique OrderNumber collisions across concurrent PO insertions.
        var serial = 0;
        const int maxAttempts = 12;
        for (var attempt = 1; ; attempt++)
        {
            serial = Math.Max(await store.NextPurchaseOrderSerialAsync(), serial + 1);
            po.OrderNumber = $"PO-{serial:D6}";
            try
            {
                await store.SaveChangesAsync();
                break;
            }
            catch (StoreWriteException error) when (!error.ConcurrentChange && attempt < maxAttempts)
            {
                await Task.Delay(Random.Shared.Next(5, 25));
            }
        }

        var reloaded = await store.FindPurchaseOrderAsync(po.Id) ?? po;
        return ToPurchaseOrderView(reloaded);
    }

    public async Task<PurchaseOrderView> ReceivePurchaseOrderAsync(int id)
    {
        var po = await store.FindPurchaseOrderAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Purchase order not found.");

        po.Receive();
        await store.SaveChangesAsync();
        return ToPurchaseOrderView(po);
    }

    public async Task<PurchaseOrderView> CancelPurchaseOrderAsync(int id)
    {
        var po = await store.FindPurchaseOrderAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Purchase order not found.");

        po.Cancel();
        await store.SaveChangesAsync();
        return ToPurchaseOrderView(po);
    }

    // ==================== Vendor Payments ====================

    public async Task<IReadOnlyList<VendorPaymentView>> VendorPaymentsAsync(int? purchaseOrderId)
    {
        var payments = await store.ListVendorPaymentsAsync(purchaseOrderId);
        return payments.Select(ToVendorPaymentView).ToArray();
    }

    public async Task<VendorPaymentView> CreateVendorPaymentAsync(VendorPaymentInput input)
    {
        ValidatePrice(input.Amount);
        var po = await store.FindPurchaseOrderAsync(input.PurchaseOrderId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Purchase order not found.");

        if (po.Status == "Cancelled")
            throw new UseCaseException(UseCaseFailure.Conflict, "Cannot record payment against a cancelled purchase order.");

        var alreadyPaid = po.Payments.Sum(p => p.Amount);
        var remaining = po.TotalAmount - alreadyPaid;
        if (input.Amount > remaining)
            throw new UseCaseException(UseCaseFailure.InvalidInput, $"Payment amount exceeds remaining balance (${remaining:F2}).");

        var payment = new VendorPayment
        {
            PaymentNumber = "",
            PurchaseOrderId = po.Id,
            VendorId = po.VendorId,
            Amount = input.Amount,
            PaidAt = DateTime.UtcNow,
            Method = input.Method,
            Reference = input.Reference?.Trim(),
            Note = input.Note?.Trim()
        };
        store.Add(payment);

        // Retry unique PaymentNumber collisions across concurrent VP insertions.
        var serial = 0;
        const int maxAttempts = 12;
        for (var attempt = 1; ; attempt++)
        {
            serial = Math.Max(await store.NextVendorPaymentSerialAsync(), serial + 1);
            payment.PaymentNumber = $"VP-{serial:D6}";
            try
            {
                await store.SaveChangesAsync();
                break;
            }
            catch (StoreWriteException error) when (!error.ConcurrentChange && attempt < maxAttempts)
            {
                await Task.Delay(Random.Shared.Next(5, 25));
            }
        }

        payment.PurchaseOrder = po;
        payment.Vendor = po.Vendor;
        return ToVendorPaymentView(payment);
    }

    // ==================== Technical Equipment & Incidents ====================

    public async Task<IReadOnlyList<EquipmentStockView>> EquipmentStockAsync()
    {
        var products = await store.ListEquipmentProductsAsync();
        var allocatedCounts = await store.GetProductAllocatedCountsAsync();

        // Pending feasible orders do not bind a product SKU until activation; report 0 per SKU.
        return products.Select(p => new EquipmentStockView(
            p.Id,
            p.Name,
            p.Description,
            p.Active,
            p.QuantityInStock,
            p.ReplacementPrice,
            0,
            allocatedCounts.GetValueOrDefault(p.Id, 0)
        )).ToArray();
    }

    public async Task<EquipmentInventorySummaryView> EquipmentSummaryAsync() =>
        new(await store.CountPendingFeasibleOrdersNeedingConnectionAsync());

    public async Task<IReadOnlyList<EquipmentIncidentView>> IncidentsAsync(bool? settled)
    {
        var incidents = await store.ListIncidentsAsync(settled);
        var results = new List<EquipmentIncidentView>(incidents.Count);
        foreach (var inc in incidents)
        {
            var order = await operations.FindOrderByAccountIdAsync(inc.Connection.AccountId);
            results.Add(new EquipmentIncidentView(
                inc.Id,
                inc.ConnectionId,
                inc.Connection.AccountId,
                order?.Request.Customer.Name,
                order?.Request.Customer.Phone,
                inc.ProductId,
                inc.Product.Name,
                AsUtc(inc.IncidentDate),
                inc.Description,
                inc.ReplacementFee,
                inc.RecordedBy?.Username ?? "system",
                inc.Settled
            ));
        }
        return results;
    }

    public async Task<EquipmentIncidentView> RecordIncidentAsync(EquipmentIncidentInput input, int actorId)
    {
        ValidatePrice(input.ReplacementFee);
        Connection? connection = null;
        if (input.ConnectionId.HasValue)
        {
            connection = await store.FindConnectionAsync(input.ConnectionId.Value);
        }
        else if (!string.IsNullOrWhiteSpace(input.AccountId))
        {
            connection = await store.FindConnectionByAccountIdAsync(input.AccountId);
        }

        if (connection is null)
            throw new UseCaseException(UseCaseFailure.NotFound, "Connection or account not found.");

        var product = await catalog.FindProductAsync(input.ProductId)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Equipment product not found.");

        var incident = new EquipmentIncident
        {
            ConnectionId = connection.Id,
            ProductId = product.Id,
            IncidentDate = DateTime.UtcNow,
            Description = input.Description.Trim(),
            ReplacementFee = input.ReplacementFee > 0 ? input.ReplacementFee : product.ReplacementPrice,
            RecordedById = actorId,
            Settled = false
        };
        store.Add(incident);
        await store.SaveChangesAsync();

        var reloaded = await store.FindIncidentAsync(incident.Id) ?? incident;
        var order = await operations.FindOrderByAccountIdAsync(connection.AccountId);
        return new EquipmentIncidentView(
            reloaded.Id,
            reloaded.ConnectionId,
            connection.AccountId,
            order?.Request.Customer.Name,
            order?.Request.Customer.Phone,
            product.Id,
            product.Name,
            AsUtc(reloaded.IncidentDate),
            reloaded.Description,
            reloaded.ReplacementFee,
            reloaded.RecordedBy?.Username ?? "staff",
            reloaded.Settled
        );
    }

    // ==================== Private Helpers ====================

    private static void ValidatePrice(decimal price)
    {
        if (decimal.Round(price, 2) != price)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Enter an amount with up to two decimal places.");
    }

    private static RetailShopView ToShopView(RetailShop shop) =>
        new(shop.Id, shop.Code, shop.Name, shop.CityCode, shop.City?.Name, shop.Address, shop.Phone, shop.Active);

    private static VendorView ToVendorView(Vendor vendor) =>
        new(vendor.Id, vendor.Code, vendor.Name, vendor.ContactPerson, vendor.Phone, vendor.Email, vendor.Address, vendor.Active);

    private static PurchaseOrderView ToPurchaseOrderView(PurchaseOrder po)
    {
        var paid = po.Payments?.Sum(p => p.Amount) ?? 0m;
        var paymentStatus = paid <= 0 ? "Unpaid" : paid >= po.TotalAmount ? "Paid" : "PartiallyPaid";
        return new PurchaseOrderView(
            po.Id,
            po.OrderNumber,
            po.VendorId,
            po.Vendor?.Name ?? $"Vendor #{po.VendorId}",
            po.ProductId,
            po.Product?.Name ?? $"Product #{po.ProductId}",
            po.Quantity,
            po.UnitPrice,
            po.TotalAmount,
            po.Status,
            AsUtc(po.OrderedAt),
            po.ReceivedAt.HasValue ? AsUtc(po.ReceivedAt.Value) : null,
            po.Note,
            paid,
            paymentStatus
        );
    }

    private static VendorPaymentView ToVendorPaymentView(VendorPayment payment) =>
        new(
            payment.Id,
            payment.PaymentNumber,
            payment.PurchaseOrderId,
            payment.PurchaseOrder?.OrderNumber ?? $"PO #{payment.PurchaseOrderId}",
            payment.VendorId,
            payment.Vendor?.Name ?? $"Vendor #{payment.VendorId}",
            payment.Amount,
            AsUtc(payment.PaidAt),
            payment.Method,
            payment.Reference,
            payment.Note
        );

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
