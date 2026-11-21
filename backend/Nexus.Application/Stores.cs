using Nexus.Domain;

namespace Nexus.Application;

/// <summary>Persistence port for staff authentication and employee administration.</summary>
public interface IStaffStore
{
    Task<Employee?> FindEmployeeAsync(string username);
    Task<Employee?> FindTrackedEmployeeByIdAsync(int id);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync();
    Task<int> CountActiveAdminsAsync();
    Task<RetailShop?> FindRetailShopAsync(int id);
    void Add(Employee employee);
    Task SaveChangesAsync();
}

public interface IPasswordService
{
    string Hash(Employee employee, string password);
    bool Verify(Employee employee, string password);
}

/// <summary>Persistence port for cities, service plans, and equipment products.</summary>
public interface ICatalogStore
{
    Task<IReadOnlyList<City>> ListCitiesAsync();
    Task<City?> FindCityAsync(string code);
    Task<bool> CityExistsAsync(string code);
    Task<IReadOnlyList<ServicePlan>> ListPlansAsync(bool includeInactive);
    Task<ServicePlan?> FindPlanAsync(int id);
    Task<IReadOnlyList<Product>> ListProductsAsync();
    Task<Product?> FindProductAsync(int id);
    void Add(City city);
    void Add(ServicePlan plan);
    void Add(Product product);
    Task SaveChangesAsync();
}

/// <summary>Persistence port for customer operations, orders, lifecycle, documents, plan changes, and queries.</summary>
public interface IOperationsStore
{
    Task<IReadOnlyList<Customer>> SearchCustomersAsync(int? id, string term);
    Task<Customer?> FindCustomerAsync(int id);
    Task<Employee?> FindEmployeeByIdAsync(int id);
    Task<IReadOnlyList<ServiceRequest>> ListPendingRequestsAsync();
    Task<ServiceRequest?> FindRequestForConfirmationAsync(int id);
    Task<IReadOnlyList<ServiceOrder>> ListOrdersAsync(OrderNumber? number, OrderStatus? status);
    Task<ServiceOrder?> FindOrderAsync(OrderNumber number);
    Task<ServiceOrder?> FindOrderByAccountIdAsync(string accountId);
    Task<ServiceOrder?> ReadOrderByRequestAsync(int requestId);
    Task<ServiceOrder?> ReadOrderByIdAsync(long orderId);
    Task<IReadOnlyList<OrderEvent>> ReadHistoryAsync(long orderId);
    Task<IReadOnlyList<ServiceFeedback>> ReadFeedbackAsync(long orderId);

    // Group 3: Lifecycle & Advanced Search
    Task<IReadOnlyList<ServiceOrder>> ListConnectionsAsync(
        string? q,
        string? code,
        string? customerName,
        string? serviceType,
        string? phone,
        DateTime? fromDate,
        DateTime? toDateExclusive,
        string? status,
        string? cityCode);
    Task<ServiceOrder?> FindOrderWithConnectionByAccountIdAsync(string accountId);
    Task<ServiceOrder?> FindOrderWithConnectionByIdAsync(long connectionId);
    Task<IReadOnlyList<ServiceOrder>> ListOrdersByConnectionIdsAsync(IReadOnlyCollection<long> connectionIds);
    Task<IReadOnlyList<ServiceOrder>> SearchOrdersAsync(string? code, string? customerName, string? serviceType, string? phone, DateTime? fromDate, DateTime? toDateExclusive, string? status);

    // Group 4.1: Customer Documents
    Task<IReadOnlyList<CustomerDocument>> ListDocumentsAsync(int? year, string? cityCode, int? customerId, string? documentType);
    Task<CustomerDocument?> FindDocumentAsync(int id);
    void Add(CustomerDocument document);

    // Group 4.2: Plan Change Requests
    Task<IReadOnlyList<PlanChangeRequest>> ListPlanChangesAsync(string? status, long? connectionId);
    Task<PlanChangeRequest?> FindPlanChangeAsync(int id);
    Task<bool> HasPendingPlanChangeAsync(long connectionId);
    void Add(PlanChangeRequest request);

    // Group 4.3: Customer Queries & FAQ Catalog
    Task<IReadOnlyList<CustomerQuery>> ListQueriesAsync(string? status, string? category, int? customerId);
    Task<CustomerQuery?> FindQueryAsync(int id);
    Task<IReadOnlyList<CustomerQuery>> ListFaqCatalogAsync(string? category);
    void Add(CustomerQuery query);

    void Add(Customer customer);
    void Add(ServiceRequest request);
    void Add(ServiceOrder order);
    void Add(ServiceFeedback feedback);
    Task SaveChangesAsync();
}

/// <summary>Persistence port for retail shops, vendors, purchase orders, vendor payments, and equipment incidents.</summary>
public interface IInventoryStore
{
    Task<IReadOnlyList<RetailShop>> ListRetailShopsAsync(string? cityCode, bool includeInactive);
    Task<RetailShop?> FindRetailShopAsync(int id);
    Task<bool> RetailShopCodeExistsAsync(string code, int? excludeId = null);
    void Add(RetailShop shop);

    Task<IReadOnlyList<Vendor>> ListVendorsAsync(bool includeInactive);
    Task<Vendor?> FindVendorAsync(int id);
    Task<bool> VendorCodeExistsAsync(string code, int? excludeId = null);
    void Add(Vendor vendor);

    Task<IReadOnlyList<PurchaseOrder>> ListPurchaseOrdersAsync(string? status);
    Task<PurchaseOrder?> FindPurchaseOrderAsync(int id);
    Task<int> NextPurchaseOrderSerialAsync();
    void Add(PurchaseOrder po);

    Task<IReadOnlyList<VendorPayment>> ListVendorPaymentsAsync(int? purchaseOrderId);
    Task<int> NextVendorPaymentSerialAsync();
    void Add(VendorPayment payment);

    Task<IReadOnlyList<Product>> ListEquipmentProductsAsync();
    Task<int> CountPendingFeasibleOrdersNeedingConnectionAsync();
    Task<Dictionary<int, int>> GetProductAllocatedCountsAsync();
    Task<IReadOnlyList<EquipmentIncident>> ListIncidentsAsync(bool? settled);
    Task<EquipmentIncident?> FindIncidentAsync(int id);
    Task<Connection?> FindConnectionAsync(long connectionId);
    Task<Connection?> FindConnectionByAccountIdAsync(string accountId);
    void Add(EquipmentIncident incident);

    Task SaveChangesAsync();
}

/// <summary>Persistence port for customer self-registration and owner-scoped portal operations.</summary>
public interface ICustomerPortalStore
{
    Task<Employee?> FindEmployeeWithCustomerAsync(int employeeId, bool tracking = false);
    Task<IReadOnlyList<ServiceRequest>> ListCustomerRequestsAsync(int customerId);
    Task<IReadOnlyList<ServiceOrder>> ListCustomerOrdersAsync(int customerId);
    Task<ServiceOrder?> FindCustomerOrderAsync(int customerId, OrderNumber number);
    Task<IReadOnlyList<ServiceOrder>> ListCustomerConnectionsAsync(int customerId);
    Task<IReadOnlyList<ServiceOrder>> ListCustomerBillingOrdersAsync(int customerId);
    Task<IReadOnlyList<PlanChangeRequest>> ListCustomerPlanChangesAsync(int customerId);
    Task<Invoice?> FindInvoiceForConnectionAsync(long connectionId, long invoiceId);
    void Add(Customer customer);
    void Add(Employee employee);
    void Add(ServiceRequest request);
    void Add(ServiceFeedback feedback);
    Task SaveChangesAsync();
}
