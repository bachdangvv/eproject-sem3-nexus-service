using Nexus.Domain;

namespace Nexus.Application;

public interface IStaffStore
{
    Task<Employee?> FindEmployeeAsync(string username);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync();
    void Add(Employee employee);
    Task SaveChangesAsync();
}

public interface IPasswordService
{
    string Hash(Employee employee, string password);
    bool Verify(Employee employee, string password);
}

public interface ICatalogStore
{
    Task<IReadOnlyList<City>> ListCitiesAsync();
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

public interface IOperationsStore
{
    Task<IReadOnlyList<Customer>> SearchCustomersAsync(int? id, string term);
    Task<Customer?> FindCustomerAsync(int id);
    Task<IReadOnlyList<ServiceRequest>> ListPendingRequestsAsync();
    Task<ServiceRequest?> FindRequestForConfirmationAsync(int id);
    Task<IReadOnlyList<ServiceOrder>> ListOrdersAsync(OrderNumber? number, OrderStatus? status);
    Task<ServiceOrder?> FindOrderAsync(OrderNumber number);
    Task<ServiceOrder?> FindOrderByAccountIdAsync(string accountId);
    Task<ServiceOrder?> ReadOrderByRequestAsync(int requestId);
    Task<ServiceOrder?> ReadOrderByIdAsync(long orderId);
    Task<IReadOnlyList<OrderEvent>> ReadHistoryAsync(long orderId);
    Task<IReadOnlyList<ServiceFeedback>> ReadFeedbackAsync(long orderId);
    void Add(Customer customer);
    void Add(ServiceRequest request);
    void Add(ServiceOrder order);
    void Add(ServiceFeedback feedback);
    Task SaveChangesAsync();
}

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
