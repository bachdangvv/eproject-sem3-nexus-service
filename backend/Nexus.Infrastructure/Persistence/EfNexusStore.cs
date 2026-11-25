using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

/// <summary>EF Core repository implementation serving catalog, operations, staff, billing, inventory, and customer portal stores.</summary>
public sealed partial class EfNexusStore(NexusDb db) : ICatalogStore, IOperationsStore, IStaffStore, IBillingStore, IInventoryStore, ICustomerPortalStore, IDepositStore
{
    public Task<Employee?> FindEmployeeAsync(string username) =>
        db.Employees.AsNoTracking().Include(employee => employee.Customer)
            .SingleOrDefaultAsync(employee => employee.Username == username);

    public Task<Employee?> FindTrackedEmployeeByIdAsync(int id) =>
        db.Employees.FindAsync(id).AsTask();

    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync() =>
        await db.Employees.AsNoTracking().OrderBy(employee => employee.Username).ToListAsync();

    public Task<int> CountActiveAdminsAsync() =>
        db.Employees.CountAsync(employee => employee.Active && employee.Role == Roles.Admin);

    public async Task<IReadOnlyList<City>> ListCitiesAsync() =>
        await db.Cities.AsNoTracking().OrderBy(city => city.Code).ToListAsync();

    public Task<City?> FindCityAsync(string code) =>
        db.Cities.FindAsync(code).AsTask();

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

    public Task<Employee?> FindEmployeeByIdAsync(int id) =>
        db.Employees.AsNoTracking().SingleOrDefaultAsync(employee => employee.Id == id);

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
        if (!TryParseAccountId(accountId, out var type, out var city, out var connectionId))
            return Task.FromResult<ServiceOrder?>(null);

        return Orders().SingleOrDefaultAsync(order =>
            order.Request.Type == type &&
            order.Connection != null &&
            order.Connection.Id == connectionId &&
            order.Connection.Type == type &&
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

    // Group 3: Lifecycle & Advanced Search
    public async Task<IReadOnlyList<ServiceOrder>> ListConnectionsAsync(
        string? q,
        string? code,
        string? customerName,
        string? serviceType,
        string? phone,
        DateTime? fromDate,
        DateTime? toDateExclusive,
        string? status,
        string? cityCode)
    {
        var query = db.Orders.AsNoTracking()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection)
            .Include(o => o.Deposit)
            .Where(o => o.Connection != null);

        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var statusNorm = status.Trim().ToUpperInvariant() switch
            {
                "ACTIVE" => "Active",
                "TEMPORARILYINACTIVE" or "TEMPORARILY_INACTIVE" => "TemporarilyInactive",
                "PERMANENTLYINACTIVE" or "PERMANENTLY_INACTIVE" => "PermanentlyInactive",
                _ => status.Trim()
            };
            query = query.Where(o => o.Connection!.Status == statusNorm);
        }

        if (!string.IsNullOrWhiteSpace(cityCode) && !cityCode.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var cityTrim = cityCode.Trim();
            query = query.Where(o => o.Connection!.CityCode == cityTrim);
        }

        if (!string.IsNullOrWhiteSpace(serviceType) && !serviceType.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var stUpper = serviceType.Trim().ToUpperInvariant();
            query = query.Where(o => o.Connection!.Type == stUpper);
        }

        if (!string.IsNullOrWhiteSpace(code))
        {
            var codeTrim = code.Trim();
            var parsedNumber = OrderNumber.Parse(codeTrim);
            if (parsedNumber is not null)
            {
                query = query.Where(o => o.Id == parsedNumber.Value.Serial && o.Request.Type == parsedNumber.Value.Type);
            }
            else if (TryParseAccountId(codeTrim, out var type, out var city, out var connId))
            {
                query = query.Where(o => o.Connection!.Id == connId && o.Connection.Type == type && o.Connection.CityCode == city);
            }
            else
            {
                query = query.Where(o => false);
            }
        }

        if (!string.IsNullOrWhiteSpace(customerName))
        {
            var searchName = customerName.Trim().ToUpperInvariant();
            query = query.Where(o => o.Request.Customer.SearchName.Contains(searchName) || o.Request.Customer.Name.ToUpper().Contains(searchName));
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var phoneTrim = phone.Trim();
            query = query.Where(o => o.Request.Customer.Phone.Contains(phoneTrim));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(o => o.Connection!.ActivatedAt >= fromDate.Value);
        }

        if (toDateExclusive.HasValue)
        {
            query = query.Where(o => o.Connection!.ActivatedAt < toDateExclusive.Value);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var termUpper = term.ToUpperInvariant();
            var parsedNumber = OrderNumber.Parse(term);
            if (parsedNumber is not null)
            {
                query = query.Where(o => o.Id == parsedNumber.Value.Serial && o.Request.Type == parsedNumber.Value.Type);
            }
            else if (TryParseAccountId(term, out var type, out var city, out var connId))
            {
                query = query.Where(o => o.Connection!.Id == connId && o.Connection.Type == type && o.Connection.CityCode == city);
            }
            else
            {
                query = query.Where(o =>
                    o.Request.Customer.SearchName.Contains(termUpper) ||
                    o.Request.Customer.Name.ToUpper().Contains(termUpper) ||
                    o.Request.Customer.Phone.Contains(term) ||
                    o.Connection!.CityCode.Contains(term));
            }
        }

        return await query.OrderByDescending(o => o.Connection!.Id).Take(100).ToListAsync();
    }

    private static bool TryParseAccountId(string? value, out string type, out string cityCode, out long connectionId)
    {
        type = "";
        cityCode = "";
        connectionId = 0;
        if (string.IsNullOrWhiteSpace(value)) return false;

        var norm = value.Trim().ToUpperInvariant();
        if (norm.Length != 16 || norm[0] is not ('D' or 'B' or 'T')) return false;
        for (var i = 1; i < 16; i++)
        {
            if (!char.IsAsciiDigit(norm[i])) return false;
        }
        if (!long.TryParse(norm.AsSpan(4), NumberStyles.None, CultureInfo.InvariantCulture, out connectionId) || connectionId < 1)
            return false;

        type = norm[..1];
        cityCode = norm.Substring(1, 3);
        return true;
    }

    public Task<ServiceOrder?> FindOrderWithConnectionByAccountIdAsync(string accountId)
    {
        if (!TryParseAccountId(accountId, out var type, out var city, out var connId))
            return Task.FromResult<ServiceOrder?>(null);

        return db.Orders
            .AsSplitQuery()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection)!.ThenInclude(c => c!.Invoices)
            .Include(o => o.Connection)!.ThenInclude(c => c!.Incidents)
            .Include(o => o.History)
            .Include(o => o.Advance)
            .Include(o => o.Deposit)!.ThenInclude(d => d!.Transactions).ThenInclude(t => t.Actor)
            .FirstOrDefaultAsync(o => o.Connection != null && o.Connection.Id == connId && o.Connection.Type == type && o.Connection.CityCode == city);
    }

    public Task<ServiceOrder?> FindOrderWithConnectionByIdAsync(long connectionId)
    {
        return db.Orders
            .AsSplitQuery()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection)!.ThenInclude(c => c!.Invoices)
            .Include(o => o.Connection)!.ThenInclude(c => c!.Incidents)
            .Include(o => o.History)
            .Include(o => o.Advance)
            .Include(o => o.Deposit)!.ThenInclude(d => d!.Transactions).ThenInclude(t => t.Actor)
            .FirstOrDefaultAsync(o => o.Connection != null && o.Connection.Id == connectionId);
    }

    public async Task<IReadOnlyList<ServiceOrder>> ListOrdersByConnectionIdsAsync(IReadOnlyCollection<long> connectionIds)
    {
        if (connectionIds.Count == 0)
            return [];

        return await db.Orders.AsNoTracking()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection)
            .Where(o => o.Connection != null && connectionIds.Contains(o.Connection.Id))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ServiceOrder>> SearchOrdersAsync(
        string? code, string? customerName, string? serviceType, string? phone,
        DateTime? fromDate, DateTime? toDateExclusive, string? status)
    {
        var query = Orders().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(code))
        {
            var codeTrim = code.Trim();
            var parsedNumber = OrderNumber.Parse(codeTrim);
            if (parsedNumber is not null)
            {
                query = query.Where(o => o.Id == parsedNumber.Value.Serial && o.Request.Type == parsedNumber.Value.Type);
            }
            else if (TryParseAccountId(codeTrim, out var type, out var city, out var connId))
            {
                query = query.Where(o => o.Connection != null && o.Connection.Id == connId && o.Connection.Type == type && o.Connection.CityCode == city);
            }
            else
            {
                query = query.Where(o => false);
            }
        }

        if (!string.IsNullOrWhiteSpace(customerName))
        {
            var searchName = customerName.Trim().ToUpperInvariant();
            query = query.Where(o => o.Request.Customer.SearchName.Contains(searchName) || o.Request.Customer.Name.ToUpper().Contains(searchName));
        }

        if (!string.IsNullOrWhiteSpace(serviceType) && !serviceType.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var stUpper = serviceType.Trim().ToUpperInvariant();
            query = query.Where(o => o.Request.Type == stUpper);
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var phoneTrim = phone.Trim();
            query = query.Where(o => o.Request.Customer.Phone.Contains(phoneTrim));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(o => o.CreatedAt >= fromDate.Value);
        }

        if (toDateExclusive.HasValue)
        {
            query = query.Where(o => o.CreatedAt < toDateExclusive.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<OrderStatus>(status.Trim(), true, out var parsedStatus) && Enum.IsDefined(parsedStatus))
            {
                query = query.Where(o => o.Status == parsedStatus);
            }
            else
            {
                query = query.Where(o => false);
            }
        }

        return await query.OrderByDescending(o => o.Id).Take(100).ToListAsync();
    }

    // Group 4.1: Customer Documents
    public async Task<IReadOnlyList<CustomerDocument>> ListDocumentsAsync(int? year, string? cityCode, int? customerId, string? documentType)
    {
        var query = db.CustomerDocuments.AsNoTracking()
            .Include(d => d.Customer)
            .Include(d => d.UploadedBy)
            .AsQueryable();

        if (year.HasValue)
            query = query.Where(d => d.Year == year.Value);

        if (!string.IsNullOrWhiteSpace(cityCode) && !cityCode.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var cityTrim = cityCode.Trim();
            query = query.Where(d => d.CityCode == cityTrim);
        }

        if (customerId.HasValue)
            query = query.Where(d => d.CustomerId == customerId.Value);

        if (!string.IsNullOrWhiteSpace(documentType) && !documentType.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var docTypeNorm = documentType.Trim().ToUpperInvariant() switch
            {
                "ADDRESSPROOF" or "ADDRESS_PROOF" => "AddressProof",
                "REGISTRATIONFORM" or "REGISTRATION_FORM" => "RegistrationForm",
                "PAYMENTRECEIPT" or "PAYMENT_RECEIPT" => "PaymentReceipt",
                "OTHER" => "Other",
                _ => documentType.Trim()
            };
            query = query.Where(d => d.DocumentType == docTypeNorm);
        }

        return await query.OrderByDescending(d => d.Id).Take(100).ToListAsync();
    }

    public Task<CustomerDocument?> FindDocumentAsync(int id) =>
        db.CustomerDocuments.AsNoTracking()
            .Include(d => d.Customer)
            .Include(d => d.UploadedBy)
            .FirstOrDefaultAsync(d => d.Id == id);

    public void Add(CustomerDocument document) => db.CustomerDocuments.Add(document);

    // Group 4.2: Plan Change Requests
    public async Task<IReadOnlyList<PlanChangeRequest>> ListPlanChangesAsync(string? status, long? connectionId)
    {
        var query = db.PlanChangeRequests.AsNoTracking()
            .Include(r => r.Connection)
            .Include(r => r.TargetPlan)
            .Include(r => r.ReviewedBy)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var statusNorm = status.Trim().ToUpperInvariant() switch
            {
                "PENDING" => "Pending",
                "APPROVED" => "Approved",
                "REJECTED" => "Rejected",
                _ => status.Trim()
            };
            query = query.Where(r => r.Status == statusNorm);
        }

        if (connectionId.HasValue)
            query = query.Where(r => r.ConnectionId == connectionId.Value);

        return await query.OrderByDescending(r => r.Id).Take(100).ToListAsync();
    }

    public Task<PlanChangeRequest?> FindPlanChangeAsync(int id) =>
        db.PlanChangeRequests
            .Include(r => r.Connection)
            .Include(r => r.TargetPlan)
            .Include(r => r.ReviewedBy)
            .FirstOrDefaultAsync(r => r.Id == id);

    public Task<bool> HasPendingPlanChangeAsync(long connectionId) =>
        db.PlanChangeRequests.AnyAsync(r => r.ConnectionId == connectionId && r.Status == "Pending");

    public void Add(PlanChangeRequest request) => db.PlanChangeRequests.Add(request);

    // Group 4.3: Customer Queries & FAQ Catalog
    public async Task<IReadOnlyList<CustomerQuery>> ListQueriesAsync(string? status, string? category, int? customerId)
    {
        var query = db.CustomerQueries.AsNoTracking()
            .Include(q => q.Customer)
            .Include(q => q.AnsweredBy)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var statusNorm = status.Trim().ToUpperInvariant() switch
            {
                "OPEN" => "Open",
                "ANSWERED" => "Answered",
                "CLOSED" => "Closed",
                _ => status.Trim()
            };
            query = query.Where(q => q.Status == statusNorm);
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var categoryNorm = NormalizeQueryCategory(category);
            query = query.Where(q => q.Category == categoryNorm);
        }

        if (customerId.HasValue)
            query = query.Where(q => q.CustomerId == customerId.Value);

        return await query.OrderByDescending(q => q.Id).Take(100).ToListAsync();
    }

    public Task<CustomerQuery?> FindQueryAsync(int id) =>
        db.CustomerQueries
            .Include(q => q.Customer)
            .Include(q => q.AnsweredBy)
            .FirstOrDefaultAsync(q => q.Id == id);

    public async Task<IReadOnlyList<CustomerQuery>> ListFaqCatalogAsync(string? category)
    {
        var query = db.CustomerQueries.AsNoTracking()
            .Where(q => q.IsFaq && q.Answer != null);

        if (!string.IsNullOrWhiteSpace(category) && !category.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var categoryNorm = NormalizeQueryCategory(category);
            query = query.Where(q => q.Category == categoryNorm);
        }

        return await query.OrderByDescending(q => q.Id).Take(100).ToListAsync();
    }

    private static string NormalizeQueryCategory(string category) =>
        category.Trim().ToUpperInvariant() switch
        {
            "BILLING" => "Billing",
            "TECHNICAL" => "Technical",
            "PLAN" => "Plan",
            "GENERAL" => "General",
            _ => category.Trim()
        };

    public void Add(CustomerQuery query) => db.CustomerQueries.Add(query);


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

    public Task<Invoice?> FindLatestInvoiceAsync(long connectionId) =>
        db.Invoices.Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.PaidBy).Where(i => i.ConnectionId == connectionId)
            .OrderByDescending(i => i.Id).FirstOrDefaultAsync();

    public Task<Invoice?> ReadLatestInvoiceAsync(long connectionId) =>
        db.Invoices.AsNoTracking().Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.PaidBy).Where(i => i.ConnectionId == connectionId)
            .OrderByDescending(i => i.Id).FirstOrDefaultAsync();

    public async Task<IReadOnlyList<Invoice>> ListInvoicesAsync(long connectionId) =>
        await db.Invoices.AsNoTracking().AsSplitQuery()
            .Include(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(i => i.Payments).ThenInclude(p => p.RetailShop)
            .Include(i => i.PaidBy).Where(i => i.ConnectionId == connectionId)
            .OrderByDescending(i => i.Id).ToListAsync();

    public async Task<IReadOnlyList<Invoice>> ListOpenTrackedInvoicesAsync(long connectionId) =>
        await db.Invoices
            .Where(i => i.ConnectionId == connectionId && (i.Status == "Unpaid" || i.Status == "PartiallyPaid"))
            .OrderByDescending(i => i.Id)
            .ToListAsync();

    public async Task<IReadOnlyList<EquipmentIncident>> ListUnsettledIncidentsForConnectionAsync(long connectionId) =>
        await db.EquipmentIncidents.Where(i => i.ConnectionId == connectionId && !i.Settled).ToListAsync();

    public async Task<IReadOnlyList<ServiceOrder>> ListConnectedOrdersAsync(string? q, string? status, string? cityCode)
    {
        var query = db.Orders.AsNoTracking().AsSplitQuery()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.PaidBy)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.Payments).ThenInclude(p => p.RetailShop)
            .Include(o => o.Deposit)!.ThenInclude(d => d!.Transactions).ThenInclude(t => t.Actor)
            .Where(o => o.Status == OrderStatus.Connected && o.Connection != null);

        if (!string.IsNullOrWhiteSpace(cityCode) && !cityCode.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var cityTrim = cityCode.Trim();
            query = query.Where(o => o.Connection!.CityCode == cityTrim);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var termUpper = term.ToUpperInvariant();
            var parsedNumber = OrderNumber.Parse(term);
            if (parsedNumber is not null)
            {
                query = query.Where(o => o.Id == parsedNumber.Value.Serial && o.Request.Type == parsedNumber.Value.Type);
            }
            else if (TryParseAccountId(term, out var type, out var city, out var connId))
            {
                query = query.Where(o => o.Connection!.Id == connId && o.Connection.Type == type && o.Connection.CityCode == city);
            }
            else
            {
                query = query.Where(o =>
                    o.Request.Customer.SearchName.Contains(termUpper) ||
                    o.Request.Customer.Name.ToUpper().Contains(termUpper) ||
                    o.Request.Customer.Phone.Contains(term) ||
                    o.Connection!.CityCode.Contains(term));
            }
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var statusNorm = status.Trim().ToUpperInvariant() switch
            {
                "NOTBILLED" or "NOT_BILLED" => "NotBilled",
                "UNPAID" => "Unpaid",
                "PARTIALLYPAID" or "PARTIALLY_PAID" => "PartiallyPaid",
                "PAID" => "Paid",
                "ROLLEDOVER" or "ROLLED_OVER" => "RolledOver",
                _ => status.Trim()
            };

            if (statusNorm == "NotBilled")
            {
                query = query.Where(o => !o.Connection!.Invoices.Any());
            }
            else
            {
                query = query.Where(o =>
                    o.Connection!.Invoices
                        .OrderByDescending(i => i.Id)
                        .Select(i => i.Status)
                        .FirstOrDefault() == statusNorm);
            }
        }

        return await query.OrderByDescending(o => o.Connection!.Id).Take(100).ToListAsync();
    }

    public async Task<IReadOnlyList<RetailShop>> ListRetailShopsAsync(string? cityCode, bool includeInactive)
    {
        var query = db.RetailShops.Include(s => s.City).AsNoTracking();
        if (!includeInactive)
            query = query.Where(s => s.Active);
        if (!string.IsNullOrWhiteSpace(cityCode) && !cityCode.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var cityTrim = cityCode.Trim();
            query = query.Where(s => s.CityCode == cityTrim);
        }
        return await query.OrderBy(s => s.Code).ToListAsync();
    }

    public Task<RetailShop?> FindRetailShopAsync(int id) =>
        db.RetailShops.Include(s => s.City).FirstOrDefaultAsync(s => s.Id == id);

    public Task<bool> RetailShopCodeExistsAsync(string code, int? excludeId = null)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return db.RetailShops.AnyAsync(s => s.Code == normalized && (excludeId == null || s.Id != excludeId.Value));
    }

    public void Add(RetailShop shop) => db.RetailShops.Add(shop);

    public async Task<IReadOnlyList<Vendor>> ListVendorsAsync(bool includeInactive) =>
        await db.Vendors.AsNoTracking().Where(v => includeInactive || v.Active).OrderBy(v => v.Code).ToListAsync();

    public Task<Vendor?> FindVendorAsync(int id) => db.Vendors.FindAsync(id).AsTask();

    public Task<bool> VendorCodeExistsAsync(string code, int? excludeId = null)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return db.Vendors.AnyAsync(v => v.Code == normalized && (excludeId == null || v.Id != excludeId.Value));
    }

    public void Add(Vendor vendor) => db.Vendors.Add(vendor);

    public async Task<IReadOnlyList<PurchaseOrder>> ListPurchaseOrdersAsync(string? status)
    {
        var query = db.PurchaseOrders.Include(po => po.Vendor).Include(po => po.Product)
            .Include(po => po.Payments).AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var statusNorm = status.Trim().ToUpperInvariant() switch
            {
                "ORDERED" => "Ordered",
                "RECEIVED" => "Received",
                "CANCELLED" => "Cancelled",
                _ => status.Trim()
            };
            query = query.Where(po => po.Status == statusNorm);
        }
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
        if (!TryParseAccountId(accountId, out var type, out var city, out var id))
            return Task.FromResult<Connection?>(null);

        return db.Connections
            .Include(c => c.AssignedProduct)
            .FirstOrDefaultAsync(c => c.Id == id && c.Type == type && c.CityCode == city);
    }

    public void Add(EquipmentIncident incident) => db.EquipmentIncidents.Add(incident);

    // Customer Portal (owner-scoped)
    public Task<Employee?> FindEmployeeWithCustomerAsync(int employeeId, bool tracking = false)
    {
        var query = tracking ? db.Employees : db.Employees.AsNoTracking();
        return query.Include(employee => employee.Customer)
            .SingleOrDefaultAsync(employee => employee.Id == employeeId);
    }

    public async Task<IReadOnlyList<ServiceRequest>> ListCustomerRequestsAsync(int customerId) =>
        await db.Requests.AsNoTracking()
            .Where(request => request.CustomerId == customerId)
            .Include(request => request.Customer)
            .Include(request => request.Plan)
            .OrderByDescending(request => request.Id)
            .Take(100)
            .ToListAsync();

    public async Task<IReadOnlyList<ServiceOrder>> ListCustomerOrdersAsync(int customerId) =>
        await Orders().AsNoTracking()
            .Where(order => order.Request.CustomerId == customerId)
            .OrderByDescending(order => order.Id)
            .Take(100)
            .ToListAsync();

    public Task<ServiceOrder?> FindCustomerOrderAsync(int customerId, OrderNumber number) =>
        Orders().SingleOrDefaultAsync(order =>
            order.Request.CustomerId == customerId &&
            order.Id == number.Serial &&
            order.Request.Type == number.Type);

    public async Task<IReadOnlyList<ServiceOrder>> ListCustomerConnectionsAsync(int customerId) =>
        await db.Orders.AsNoTracking()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection)
            .Include(o => o.Deposit)
            .Where(o => o.Connection != null && o.Request.CustomerId == customerId)
            .OrderByDescending(o => o.Connection!.Id)
            .Take(100)
            .ToListAsync();

    public async Task<IReadOnlyList<ServiceOrder>> ListCustomerBillingOrdersAsync(int customerId) =>
        await db.Orders.AsNoTracking().AsSplitQuery()
            .Include(o => o.Request).ThenInclude(r => r.Customer)
            .Include(o => o.Request).ThenInclude(r => r.Plan)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.PaidBy)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.Payments).ThenInclude(p => p.PaidBy)
            .Include(o => o.Connection).ThenInclude(c => c!.Invoices)
                .ThenInclude(i => i.Payments).ThenInclude(p => p.RetailShop)
            .Include(o => o.Deposit)!.ThenInclude(d => d!.Transactions).ThenInclude(t => t.Actor)
            .Where(o => o.Status == OrderStatus.Connected && o.Connection != null && o.Request.CustomerId == customerId)
            .OrderByDescending(o => o.Connection!.Id)
            .Take(100)
            .ToListAsync();

    public async Task<IReadOnlyList<PlanChangeRequest>> ListCustomerPlanChangesAsync(int customerId)
    {
        var connIds = db.Orders
            .Where(o => o.Connection != null && o.Request.CustomerId == customerId)
            .Select(o => o.Connection!.Id);

        return await db.PlanChangeRequests.AsNoTracking()
            .Include(r => r.Connection)
            .Include(r => r.TargetPlan)
            .Include(r => r.ReviewedBy)
            .Where(r => connIds.Contains(r.ConnectionId))
            .OrderByDescending(r => r.Id)
            .Take(100)
            .ToListAsync();
    }

    public Task<Invoice?> FindInvoiceForConnectionAsync(long connectionId, long invoiceId) =>
        db.Invoices.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == invoiceId && i.ConnectionId == connectionId);

    public async Task SaveChangesAsync()
    {
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException error)
        {
            throw new StoreWriteException(error is DbUpdateConcurrencyException, error);
        }
    }

    private IQueryable<ServiceOrder> Orders() =>
        db.Orders.AsSplitQuery().Include(order => order.Request).ThenInclude(request => request.Customer)
            .Include(order => order.Request).ThenInclude(request => request.Plan)
            .Include(order => order.Connection)
            .Include(order => order.Advance)
            .Include(order => order.Deposit)!.ThenInclude(d => d!.Transactions).ThenInclude(t => t.Actor);
}
