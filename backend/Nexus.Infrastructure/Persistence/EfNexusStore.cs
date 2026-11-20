using Microsoft.EntityFrameworkCore;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

public sealed class EfNexusStore(NexusDb db) : ICatalogStore, IOperationsStore, IStaffStore, IBillingStore, IInventoryStore
{
    public Task<Employee?> FindEmployeeAsync(string username) =>
        db.Employees.AsNoTracking().SingleOrDefaultAsync(employee => employee.Username == username);

    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync() =>
        await db.Employees.AsNoTracking().OrderBy(employee => employee.Username).ToListAsync();

    public async Task<IReadOnlyList<City>> ListCitiesAsync() =>
        await db.Cities.AsNoTracking().OrderBy(city => city.Code).ToListAsync();

    public Task<bool> CityExistsAsync(string code) => db.Cities.AnyAsync(city => city.Code == code);

    public async Task<IReadOnlyList<ServicePlan>> ListPlansAsync(bool includeInactive) =>
        await db.Plans.AsNoTracking().Where(plan => includeInactive || plan.Active).OrderBy(plan => plan.Name).ToListAsync();

    public Task<ServicePlan?> FindPlanAsync(int id) => db.Plans.FindAsync(id).AsTask();

    public async Task<IReadOnlyList<Product>> ListProductsAsync() =>
        await db.Products.AsNoTracking().OrderBy(product => product.Name).ToListAsync();

    public Task<Product?> FindProductAsync(int id) => db.Products.FindAsync(id).AsTask();

    public async Task<IReadOnlyList<Customer>> SearchCustomersAsync(int? id, string term)
    {
        var customers = db.Customers.AsNoTracking();
        if (id is not null)
            customers = customers.Where(customer => customer.Id == id.Value);
        else if (term.Length > 0)
        {
            var search = term.ToUpperInvariant();
            customers = customers.Where(customer => customer.SearchName.Contains(search) || customer.Phone.Contains(term));
        }
        return await customers.OrderByDescending(customer => customer.Id).Take(100).ToListAsync();
    }

    public Task<Customer?> FindCustomerAsync(int id) => db.Customers.FindAsync(id).AsTask();

    public async Task<IReadOnlyList<ServiceRequest>> ListPendingRequestsAsync() =>
        await db.Requests.AsNoTracking().Where(request => !request.Confirmed)
            .Include(request => request.Customer).Include(request => request.Plan)
            .OrderByDescending(request => request.Id).Take(100).ToListAsync();

    public Task<ServiceRequest?> FindRequestForConfirmationAsync(int id) =>
        db.Requests.Include(request => request.Customer).Include(request => request.Plan).Include(request => request.Order)
            .ThenInclude(order => order!.Connection).SingleOrDefaultAsync(request => request.Id == id);

    public async Task<IReadOnlyList<ServiceOrder>> ListOrdersAsync(OrderNumber? number, OrderStatus? status)
    {
        var orders = Orders().AsNoTracking();
        if (number is { } match)
            orders = orders.Where(order => order.Id == match.Serial && order.Request.Type == match.Type);
        if (status is { } filter)
            orders = orders.Where(order => order.Status == filter);
        return await orders.OrderByDescending(order => order.Id).Take(100).ToListAsync();
    }

    public Task<ServiceOrder?> FindOrderAsync(OrderNumber number) =>
        Orders().SingleOrDefaultAsync(order => order.Id == number.Serial && order.Request.Type == number.Type);

    public Task<ServiceOrder?> FindOrderByAccountIdAsync(string accountId)
    {
        var value = accountId.Trim().ToUpperInvariant();
        if (value.Length != 16 || value[0] is not ('D' or 'B' or 'T') || value.Skip(1).Any(c => !char.IsAsciiDigit(c)) ||
            !int.TryParse(value.AsSpan(1, 3), out var cityCode) ||
            !long.TryParse(value.AsSpan(4), out var connectionId))
            return Task.FromResult<ServiceOrder?>(null);

        var city = cityCode.ToString("D3");
        var type = value[..1];
        return Orders().SingleOrDefaultAsync(order =>
            order.Request.Type == type &&
            order.Connection != null &&
            order.Connection.Id == connectionId &&
            order.Connection.CityCode == city);
    }

    public Task<ServiceOrder?> ReadOrderByRequestAsync(int requestId) =>
        Orders().AsNoTracking().SingleOrDefaultAsync(order => order.RequestId == requestId);

    public Task<ServiceOrder?> ReadOrderByIdAsync(long orderId) =>
        Orders().AsNoTracking().SingleOrDefaultAsync(order => order.Id == orderId);

    public async Task<IReadOnlyList<OrderEvent>> ReadHistoryAsync(long orderId) =>
        await db.OrderEvents.AsNoTracking().Where(entry => entry.OrderId == orderId)
            .Include(entry => entry.Actor).OrderBy(entry => entry.Id).ToListAsync();

    public async Task<IReadOnlyList<ServiceFeedback>> ReadFeedbackAsync(long orderId) =>
        await db.Feedback.AsNoTracking().Where(entry => entry.OrderId == orderId)
            .OrderByDescending(entry => entry.Id).Take(50).ToListAsync();

    public void Add(Employee employee) => db.Employees.Add(employee);
    public void Add(City city) => db.Cities.Add(city);
    public void Add(ServicePlan plan) => db.Plans.Add(plan);
    public void Add(Product product) => db.Products.Add(product);
    public void Add(Customer customer) => db.Customers.Add(customer);
    public void Add(ServiceRequest request) => db.Requests.Add(request);
    public void Add(ServiceOrder order) => db.Orders.Add(order);
    public void Add(ServiceFeedback feedback) => db.Feedback.Add(feedback);
    public void Add(Invoice invoice) => db.Invoices.Add(invoice);
    public void Add(PaymentTransaction payment) => db.Payments.Add(payment);

    public Task<Invoice?> FindInvoiceAsync(long invoiceId) =>
        db.Invoices.Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.PaidBy).FirstOrDefaultAsync(i => i.Id == invoiceId);

    public Task<Invoice?> FindLatestInvoiceAsync(long connectionId) =>
        db.Invoices.Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.PaidBy).Where(i => i.ConnectionId == connectionId)
            .OrderByDescending(i => i.Id).FirstOrDefaultAsync();

    public Task<Invoice?> ReadLatestInvoiceAsync(long connectionId) =>
        db.Invoices.AsNoTracking().Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.PaidBy).Where(i => i.ConnectionId == connectionId)
            .OrderByDescending(i => i.Id).FirstOrDefaultAsync();

    public async Task<IReadOnlyList<Invoice>> ListInvoicesAsync(long connectionId) =>
        await db.Invoices.AsNoTracking().Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.PaidBy).Where(i => i.ConnectionId == connectionId)
            .OrderByDescending(i => i.Id).ToListAsync();

    public async Task<IReadOnlyList<ServiceOrder>> ListConnectedOrdersAsync(string? q, string? status, string? cityCode)
    {
        var query = db.Orders.AsNoTracking()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.PaidBy)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.Payments)
            .Where(o => o.Status == OrderStatus.Connected && o.Connection != null);

        if (!string.IsNullOrWhiteSpace(cityCode))
            query = query.Where(o => o.Connection!.CityCode == cityCode);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToUpperInvariant();
            query = query.Where(o =>
                o.Connection!.AccountId.Contains(term) ||
                o.Request.Customer.SearchName.Contains(term) ||
                o.Request.Customer.Phone.Contains(term));
        }

        var orders = await query.OrderByDescending(o => o.Connection!.Id).Take(100).ToListAsync();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            orders = orders.Where(o =>
            {
                var latest = o.Connection?.Invoices.OrderByDescending(i => i.Id).FirstOrDefault();
                var s = latest == null ? "NotBilled" : latest.Status;
                return s.Equals(status, StringComparison.OrdinalIgnoreCase);
            }).ToList();
        }

        return orders;
    }

    public async Task<IReadOnlyList<RetailShop>> ListRetailShopsAsync(string? cityCode, bool includeInactive)
    {
        var query = db.RetailShops.Include(s => s.City).AsNoTracking();
        if (!includeInactive)
            query = query.Where(s => s.Active);
        if (!string.IsNullOrWhiteSpace(cityCode))
            query = query.Where(s => s.CityCode == cityCode);
        return await query.OrderBy(s => s.Code).ToListAsync();
    }

    public Task<RetailShop?> FindRetailShopAsync(int id) =>
        db.RetailShops.Include(s => s.City).FirstOrDefaultAsync(s => s.Id == id);

    public Task<bool> RetailShopCodeExistsAsync(string code, int? excludeId = null) =>
        db.RetailShops.AnyAsync(s => s.Code == code && (excludeId == null || s.Id != excludeId.Value));

    public void Add(RetailShop shop) => db.RetailShops.Add(shop);

    public async Task<IReadOnlyList<Vendor>> ListVendorsAsync(bool includeInactive) =>
        await db.Vendors.AsNoTracking().Where(v => includeInactive || v.Active).OrderBy(v => v.Code).ToListAsync();

    public Task<Vendor?> FindVendorAsync(int id) => db.Vendors.FindAsync(id).AsTask();

    public Task<bool> VendorCodeExistsAsync(string code, int? excludeId = null) =>
        db.Vendors.AnyAsync(v => v.Code == code && (excludeId == null || v.Id != excludeId.Value));

    public void Add(Vendor vendor) => db.Vendors.Add(vendor);

    public async Task<IReadOnlyList<PurchaseOrder>> ListPurchaseOrdersAsync(string? status)
    {
        var query = db.PurchaseOrders.Include(po => po.Vendor).Include(po => po.Product)
            .Include(po => po.Payments).AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
            query = query.Where(po => po.Status == status);
        return await query.OrderByDescending(po => po.Id).ToListAsync();
    }

    public Task<PurchaseOrder?> FindPurchaseOrderAsync(int id) =>
        db.PurchaseOrders.Include(po => po.Vendor).Include(po => po.Product)
            .Include(po => po.Payments).FirstOrDefaultAsync(po => po.Id == id);

    public async Task<int> NextPurchaseOrderSerialAsync() =>
        (await db.PurchaseOrders.MaxAsync(po => (int?)po.Id) ?? 0) + 1;

    public void Add(PurchaseOrder po) => db.PurchaseOrders.Add(po);

    public async Task<IReadOnlyList<VendorPayment>> ListVendorPaymentsAsync(int? purchaseOrderId)
    {
        var query = db.VendorPayments.Include(vp => vp.PurchaseOrder).Include(vp => vp.Vendor).AsNoTracking();
        if (purchaseOrderId.HasValue)
            query = query.Where(vp => vp.PurchaseOrderId == purchaseOrderId.Value);
        return await query.OrderByDescending(vp => vp.Id).ToListAsync();
    }

    public async Task<int> NextVendorPaymentSerialAsync() =>
        (await db.VendorPayments.MaxAsync(vp => (int?)vp.Id) ?? 0) + 1;

    public void Add(VendorPayment payment) => db.VendorPayments.Add(payment);

    public async Task<IReadOnlyList<Product>> ListEquipmentProductsAsync() =>
        await db.Products.AsNoTracking().OrderBy(p => p.Name).ToListAsync();

    public Task<int> CountPendingFeasibleOrdersNeedingConnectionAsync() =>
        db.Orders.CountAsync(o => o.Status == OrderStatus.Feasible && o.Connection == null);

    public async Task<Dictionary<int, int>> GetProductAllocatedCountsAsync() =>
        await db.Connections.Where(c => c.AssignedProductId != null)
            .GroupBy(c => c.AssignedProductId!.Value)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProductId, x => x.Count);

    public async Task<IReadOnlyList<EquipmentIncident>> ListIncidentsAsync(bool? settled)
    {
        var query = db.EquipmentIncidents.Include(i => i.Product).Include(i => i.Connection)
            .Include(i => i.RecordedBy).AsNoTracking();
        if (settled.HasValue)
            query = query.Where(i => i.Settled == settled.Value);
        return await query.OrderByDescending(i => i.Id).ToListAsync();
    }

    public Task<EquipmentIncident?> FindIncidentAsync(int id) =>
        db.EquipmentIncidents.Include(i => i.Product).Include(i => i.Connection)
            .Include(i => i.RecordedBy).FirstOrDefaultAsync(i => i.Id == id);

    public Task<Connection?> FindConnectionAsync(long connectionId) =>
        db.Connections.Include(c => c.AssignedProduct).FirstOrDefaultAsync(c => c.Id == connectionId);

    public Task<Connection?> FindConnectionByAccountIdAsync(string accountId)
    {
        var val = accountId.Trim().ToUpperInvariant();
        if (val.Length == 16 && long.TryParse(val.AsSpan(4), out var id))
        {
            return db.Connections.Include(c => c.AssignedProduct).FirstOrDefaultAsync(c => c.Id == id);
        }
        return Task.FromResult<Connection?>(null);
    }

    public void Add(EquipmentIncident incident) => db.EquipmentIncidents.Add(incident);

    public async Task SaveChangesAsync()
    {
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException error)
        {
            throw new StoreWriteException(error is DbUpdateConcurrencyException, error);
        }
    }

    private IQueryable<ServiceOrder> Orders() =>
        db.Orders.Include(order => order.Request).ThenInclude(request => request.Customer)
            .Include(order => order.Request).ThenInclude(request => request.Plan)
            .Include(order => order.Connection);
}
