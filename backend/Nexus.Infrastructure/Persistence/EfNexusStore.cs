using Microsoft.EntityFrameworkCore;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

public sealed class EfNexusStore(NexusDb db) : ICatalogStore, IOperationsStore, IStaffStore
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
        await db.Requests.AsNoTracking().Where(request => !request.Confirmed).Include(request => request.Customer)
            .OrderByDescending(request => request.Id).Take(100).ToListAsync();

    public Task<ServiceRequest?> FindRequestForConfirmationAsync(int id) =>
        db.Requests.Include(request => request.Customer).Include(request => request.Order)
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

    public async Task SaveChangesAsync()
    {
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException error)
        {
            throw new StoreWriteException(error is DbUpdateConcurrencyException, error);
        }
    }

    private IQueryable<ServiceOrder> Orders() =>
        db.Orders.Include(order => order.Request).ThenInclude(request => request.Customer).Include(order => order.Connection);
}
