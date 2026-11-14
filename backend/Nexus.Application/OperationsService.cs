using Nexus.Domain;

namespace Nexus.Application;

public sealed record CustomerView(int Id, string Code, string Name, string Phone, string Address, string CityCode,
    string? TaxId, string? Email, string? ContactPerson, string? CustomerType, string Status);
public sealed record RequestView(int Id, int CustomerId, string CustomerName, int PlanId, string PlanName,
    string Type, string CityCode, string Address, bool HasNexusLandline, decimal Price, DateTime CreatedAt);
public sealed record OrderView(string Code, int RequestId, string Status, RequestView Request, DateTime CreatedAt,
    string? AccountId, DateTime? ActivatedAt);
public sealed record OrderHistoryView(string Status, DateTime At, string Actor, string Note,
    bool? DistanceOk, bool? ServerAvailable, bool? LandlineFeasible);
public sealed record FeedbackView(int Rating, string Comment, DateTime CreatedAt);
public sealed record CreatedFeedback(long Id, int Rating, string Comment, DateTime CreatedAt);
public sealed record OrderDetailView(OrderView Order, IReadOnlyList<OrderHistoryView> History, IReadOnlyList<FeedbackView> Feedback);

public sealed class OperationsService(IOperationsStore operations, ICatalogStore catalog)
{
    public async Task<IReadOnlyList<CustomerView>> CustomersAsync(string? q)
    {
        var term = q?.Trim() ?? "";
        if (term.Length > 120)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Search text is too long.");

        int? id = term.StartsWith("CUS-", StringComparison.OrdinalIgnoreCase) && int.TryParse(term.AsSpan(4), out var number)
            ? number : null;
        return (await operations.SearchCustomersAsync(id, term)).Select(ToView).ToArray();
    }

    public async Task<CustomerView> CreateCustomerAsync(CustomerInput input)
    {
        await EnsureCityExistsAsync(input.CityCode);
        var name = input.Name.Trim();
        var customer = new Customer
        {
            Name = name, SearchName = name.ToUpperInvariant(), Phone = input.Phone,
            Address = input.Address.Trim(), CityCode = input.CityCode,
            TaxId = input.TaxId?.Trim(), Email = input.Email?.Trim(), ContactPerson = input.ContactPerson?.Trim(),
            CustomerType = input.CustomerType?.Trim() ?? "Corporate", Status = input.Status?.Trim() ?? "ACTIVE"
        };
        operations.Add(customer);
        await operations.SaveChangesAsync();
        return ToView(customer);
    }

    public async Task<CustomerView> UpdateCustomerAsync(int id, CustomerInput input)
    {
        var customer = await operations.FindCustomerAsync(id) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        await EnsureCityExistsAsync(input.CityCode);
        customer.Name = input.Name.Trim();
        customer.SearchName = customer.Name.ToUpperInvariant();
        customer.Phone = input.Phone;
        customer.Address = input.Address.Trim();
        customer.CityCode = input.CityCode;
        customer.TaxId = input.TaxId?.Trim();
        customer.Email = input.Email?.Trim();
        customer.ContactPerson = input.ContactPerson?.Trim();
        customer.CustomerType = input.CustomerType?.Trim() ?? customer.CustomerType ?? "Corporate";
        customer.Status = input.Status?.Trim() ?? customer.Status ?? "ACTIVE";
        await operations.SaveChangesAsync();
        return ToView(customer);
    }

    public async Task<IReadOnlyList<RequestView>> PendingRequestsAsync() =>
        (await operations.ListPendingRequestsAsync()).Select(ToView).ToArray();

    public async Task<RequestView> CreateRequestAsync(RequestInput input, int actorId)
    {
        var customer = await operations.FindCustomerAsync(input.CustomerId);
        var plan = await catalog.FindPlanAsync(input.PlanId);
        if (customer is null)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing customer.");
        if (plan is null || !plan.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an active service plan.");

        var request = new ServiceRequest
        {
            Customer = customer, Plan = plan, PlanName = plan.Name, Type = plan.Type,
            CityCode = customer.CityCode, Address = customer.Address,
            HasNexusLandline = plan.Type == "D" && input.HasNexusLandline, CreatedById = actorId
        };
        operations.Add(request);
        await operations.SaveChangesAsync();
        return ToView(request);
    }

    public async Task<Creation<OrderView>> ConfirmAsync(int id, int actorId)
    {
        var request = await operations.FindRequestForConfirmationAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound);
        if (request.Order is not null) return new Creation<OrderView>(ToView(request.Order), false);

        var order = request.Confirm(actorId);
        operations.Add(order);
        // The request flag, order and initial audit entry commit together.
        try { await operations.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            var existing = await operations.ReadOrderByRequestAsync(id);
            if (existing is null) throw;
            return new Creation<OrderView>(ToView(existing), false);
        }
        return new Creation<OrderView>(ToView(order), true);
    }

    public async Task<IReadOnlyList<OrderView>> OrdersAsync(string? code, string? status)
    {
        OrderNumber? number = null;
        if (!string.IsNullOrWhiteSpace(code))
            number = OrderNumber.Parse(code) ??
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Use an Order ID like B0000000001.");

        OrderStatus? orderStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<OrderStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed) || char.IsDigit(status[0]))
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Unknown order status.");
            orderStatus = parsed;
        }
        return (await operations.ListOrdersAsync(number, orderStatus)).Select(ToView).ToArray();
    }

    public async Task<OrderDetailView> DetailAsync(string code)
    {
        var order = await FindOrderAsync(code);
        var history = await operations.ReadHistoryAsync(order.Id);
        var feedback = await operations.ReadFeedbackAsync(order.Id);
        return new OrderDetailView(ToView(order),
            history.Select(entry => new OrderHistoryView(entry.Status.ToString(), AsUtc(entry.At),
                entry.Actor.Username, entry.Note, entry.DistanceOk, entry.ServerAvailable, entry.LandlineFeasible)).ToArray(),
            feedback.Select(entry => new FeedbackView(entry.Rating, entry.Comment, AsUtc(entry.CreatedAt))).ToArray());
    }

    public async Task<CreatedFeedback> RecordFeedbackAsync(string code, FeedbackInput input, int actorId)
    {
        var order = await FindOrderAsync(code);
        var feedback = order.RecordFeedback(input.Rating, input.Comment, actorId);
        operations.Add(feedback);
        await operations.SaveChangesAsync();
        return new CreatedFeedback(feedback.Id, feedback.Rating, feedback.Comment, AsUtc(feedback.CreatedAt));
    }

    public async Task<OrderView> AssessAsync(string code, AssessmentInput input, int actorId)
    {
        var order = await FindOrderAsync(code);
        order.Assess(input.DistanceOk, input.ServerAvailable, input.LandlineFeasible, input.Note, actorId);
        try { await operations.SaveChangesAsync(); }
        catch (StoreWriteException error) when (error.ConcurrentChange)
        {
            throw new UseCaseException(UseCaseFailure.Conflict, "The order changed. Refresh and try again.");
        }
        return ToView(order);
    }

    public async Task<Creation<OrderView>> ConnectAsync(string code, int actorId)
    {
        var order = await FindOrderAsync(code);
        if (order.Connection is not null) return new Creation<OrderView>(ToView(order), false);

        order.Activate(actorId);
        try { await operations.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            var existing = await operations.ReadOrderByIdAsync(order.Id);
            if (existing?.Connection is null) throw;
            return new Creation<OrderView>(ToView(existing), false);
        }
        return new Creation<OrderView>(ToView(order), true);
    }

    private async Task<ServiceOrder> FindOrderAsync(string code)
    {
        var number = OrderNumber.Parse(code);
        if (number is null) throw new UseCaseException(UseCaseFailure.NotFound);
        return await operations.FindOrderAsync(number.Value) ?? throw new UseCaseException(UseCaseFailure.NotFound);
    }

    private async Task EnsureCityExistsAsync(string code)
    {
        if (!await catalog.CityExistsAsync(code))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city.");
    }

    private static CustomerView ToView(Customer customer) =>
        new(customer.Id, customer.Code, customer.Name, customer.Phone, customer.Address, customer.CityCode,
            customer.TaxId, customer.Email, customer.ContactPerson, customer.CustomerType, customer.Status ?? "ACTIVE");

    private static RequestView ToView(ServiceRequest request) =>
        new(request.Id, request.CustomerId, request.Customer.Name, request.PlanId, request.PlanName,
            request.Type, request.CityCode, request.Address, request.HasNexusLandline,
            request.Plan.Price, AsUtc(request.CreatedAt));

    private static OrderView ToView(ServiceOrder order) =>
        new(order.Code, order.RequestId, order.Status.ToString(), ToView(order.Request), AsUtc(order.CreatedAt),
            order.Connection?.AccountId, order.Connection is null ? null : AsUtc(order.Connection.ActivatedAt));

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
