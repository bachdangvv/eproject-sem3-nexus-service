using Nexus.Domain;

namespace Nexus.Application;

public sealed record CustomerRegistrationView(
    int CustomerId,
    string CustomerCode,
    string Username,
    string DisplayName,
    string Role);

public sealed record CustomerRegistrationOutcome(
    EmployeeView Employee,
    CustomerRegistrationView View);

public sealed record CustomerProfileView(
    int Id,
    string Code,
    string Name,
    string Phone,
    string Address,
    string CityCode,
    string? TaxId,
    string? Email,
    string? ContactPerson,
    string? CustomerType,
    string Status,
    string Username,
    bool Active);

/// <summary>Application service implementing customer self-registration and owner-scoped self-service operations.</summary>
public sealed class CustomerPortalService(
    ICustomerPortalStore portal,
    IStaffStore staff,
    ICatalogStore catalog,
    IOperationsStore operations,
    BillingService billing,
    OperationsService operationsService,
    IPasswordService passwords)
{
    /// <summary>Self-registers an active customer profile and linked active Customer portal login.</summary>
    public async Task<CustomerRegistrationOutcome> RegisterAsync(RegisterCustomerInput input)
    {
        var name = input.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Name is required.");

        var address = input.Address.Trim();
        if (string.IsNullOrWhiteSpace(address))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Address is required.");

        if (string.IsNullOrWhiteSpace(input.Password))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Password cannot be blank.");

        var username = input.Username.Trim().ToLowerInvariant();
        if (ReservedUsernames.IsReservedCustomerCode(username))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Usernames matching CUS-<number> are reserved.");

        if (!await catalog.CityExistsAsync(input.CityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city.");

        const string duplicate = "That username already exists.";
        if (await staff.FindEmployeeAsync(username) is not null)
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        var customer = new Customer
        {
            Name = name,
            SearchName = name.ToUpperInvariant(),
            Phone = input.Phone.Trim(),
            Address = address,
            CityCode = input.CityCode,
            TaxId = TrimOptional(input.TaxId),
            Email = TrimOptional(input.Email),
            ContactPerson = TrimOptional(input.ContactPerson),
            CustomerType = TrimOptional(input.CustomerType) ?? "Individual",
            Status = "ACTIVE"
        };

        var employee = new Employee
        {
            Username = username,
            DisplayName = name.Length > 100 ? name[..100] : name,
            Role = Roles.Customer,
            PasswordHash = "",
            Active = true,
            Customer = customer
        };
        employee.PasswordHash = passwords.Hash(employee, input.Password);

        portal.Add(customer);
        portal.Add(employee);
        try
        {
            await portal.SaveChangesAsync();
        }
        catch (StoreWriteException)
        {
            if (await staff.FindEmployeeAsync(username) is null) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }

        return new CustomerRegistrationOutcome(
            StaffService.ToView(employee),
            new CustomerRegistrationView(customer.Id, customer.Code, employee.Username, employee.DisplayName, employee.Role));
    }

    public async Task<CustomerProfileView> ProfileAsync(int actorId)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        return ToProfileView(customer, employee);
    }

    public async Task<CustomerProfileView> UpdateProfileAsync(int actorId, CustomerProfileInput input)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: false, tracking: true);

        var name = input.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Name is required.");

        var address = input.Address.Trim();
        if (string.IsNullOrWhiteSpace(address))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Address is required.");

        if (!await catalog.CityExistsAsync(input.CityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city.");

        customer.Name = name;
        customer.SearchName = name.ToUpperInvariant();
        customer.Phone = input.Phone.Trim();
        customer.Address = address;
        customer.CityCode = input.CityCode;
        customer.TaxId = TrimOptional(input.TaxId);
        customer.Email = TrimOptional(input.Email);
        customer.ContactPerson = TrimOptional(input.ContactPerson);
        customer.CustomerType = TrimOptional(input.CustomerType) ?? customer.CustomerType ?? "Individual";
        employee.DisplayName = name.Length > 100 ? name[..100] : name;

        await portal.SaveChangesAsync();
        return ToProfileView(customer, employee);
    }

    public async Task<IReadOnlyList<RequestView>> RequestsAsync(int actorId)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        return (await portal.ListCustomerRequestsAsync(customer.Id)).Select(OperationsService.ToView).ToArray();
    }

    public async Task<RequestView> CreateRequestAsync(int actorId, CustomerRequestInput input)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: false, tracking: true);

        var plan = await catalog.FindPlanAsync(input.PlanId);
        if (plan is null || !plan.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an active service plan.");

        var cityCode = string.IsNullOrWhiteSpace(input.CityCode) ? customer.CityCode : input.CityCode.Trim();
        if (!await catalog.CityExistsAsync(cityCode))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select an existing city.");

        var address = string.IsNullOrWhiteSpace(input.Address) ? customer.Address : input.Address.Trim();
        var count = Math.Max(1, input.ConnectionCount ?? 1);

        var request = new ServiceRequest
        {
            CustomerId = customer.Id,
            Customer = customer,
            PlanId = plan.Id,
            Plan = plan,
            PlanName = plan.Name,
            Type = plan.Type,
            CityCode = cityCode,
            Address = address,
            HasNexusLandline = plan.Type == "D" && input.HasNexusLandline,
            CreatedById = employee.Id,
            RetailShopId = null,
            SnapshotPrice = plan.Price,
            ConnectionCount = count
        };

        portal.Add(request);
        await portal.SaveChangesAsync();
        return OperationsService.ToView(request);
    }

    public async Task<IReadOnlyList<OrderView>> OrdersAsync(int actorId)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        return (await portal.ListCustomerOrdersAsync(customer.Id)).Select(OperationsService.ToView).ToArray();
    }

    public async Task<OrderDetailView> OrderDetailAsync(int actorId, string code)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        var number = OrderNumber.Parse(code) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        var order = await portal.FindCustomerOrderAsync(customer.Id, number)
            ?? throw new UseCaseException(UseCaseFailure.NotFound);

        var history = await operations.ReadHistoryAsync(order.Id);
        var feedback = await operations.ReadFeedbackAsync(order.Id);
        return new OrderDetailView(
            OperationsService.ToView(order),
            history.Select(entry => new OrderHistoryView(
                entry.Status.ToString(),
                OperationsService.AsUtc(entry.At),
                entry.Actor.Username,
                entry.Note,
                entry.DistanceOk,
                entry.ServerAvailable,
                entry.LandlineFeasible)).ToArray(),
            feedback.Select(entry => new FeedbackView(
                entry.Rating,
                entry.Comment,
                OperationsService.AsUtc(entry.CreatedAt))).ToArray());
    }

    public async Task<CreatedFeedback> RecordFeedbackAsync(int actorId, string code, FeedbackInput input)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: false);
        if (string.IsNullOrWhiteSpace(input.Comment))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Feedback comment is required.");

        var number = OrderNumber.Parse(code) ?? throw new UseCaseException(UseCaseFailure.NotFound);
        var order = await portal.FindCustomerOrderAsync(customer.Id, number)
            ?? throw new UseCaseException(UseCaseFailure.NotFound);

        var feedback = order.RecordFeedback(input.Rating, input.Comment, employee.Id);
        if ((await operations.ReadFeedbackAsync(order.Id)).Count > 0)
            throw new UseCaseException(UseCaseFailure.Conflict, "Feedback has already been submitted for this order.");

        portal.Add(feedback);
        await portal.SaveChangesAsync();
        return new CreatedFeedback(feedback.Id, feedback.Rating, feedback.Comment, OperationsService.AsUtc(feedback.CreatedAt));
    }

    public async Task<IReadOnlyList<ConnectionLifecycleView>> ConnectionsAsync(int actorId)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        return (await portal.ListCustomerConnectionsAsync(customer.Id))
            .Select(OperationsService.ToLifecycleView)
            .ToArray();
    }

    public async Task<IReadOnlyList<BillingView>> BillingAsync(int actorId)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        var orders = await portal.ListCustomerBillingOrdersAsync(customer.Id);
        return orders.Select(order =>
        {
            var invoicesDesc = order.Connection?.Invoices.OrderByDescending(i => i.Id).ToList();
            var latest = invoicesDesc?.FirstOrDefault();
            return BillingService.ToView(order, latest, invoicesDesc);
        }).ToArray();
    }

    public async Task<BillingView> PayOnlineAsync(int actorId, string accountId, CustomerPaymentInput? input)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: false);
        var order = await operations.FindOrderByAccountIdAsync(accountId);
        if (order is null || order.Request.CustomerId != customer.Id || order.Connection is null)
            throw new UseCaseException(UseCaseFailure.NotFound);

        return await billing.PayAsync(
            accountId,
            new RecordPaymentInput(input?.Amount, input?.Note, input?.OperationId, input?.InvoiceId),
            employee.Id,
            "CustomerPortal");
    }

    public async Task<IReadOnlyList<PlanChangeRequestView>> PlanChangesAsync(int actorId)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        var list = await portal.ListCustomerPlanChangesAsync(customer.Id);
        if (list.Count == 0)
            return [];

        var connectionIds = list.Select(r => r.ConnectionId).Distinct().ToArray();
        var orders = await operations.ListOrdersByConnectionIdsAsync(connectionIds);
        var ordersByConnectionId = orders
            .Where(o => o.Connection != null)
            .ToDictionary(o => o.Connection!.Id);

        return list.Select(r => OperationsService.ToPlanChangeView(r, ordersByConnectionId.GetValueOrDefault(r.ConnectionId))).ToArray();
    }

    public async Task<PlanChangeRequestView> SubmitPlanChangeAsync(int actorId, PlanChangeRequestInput input)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: false);
        var order = await operations.FindOrderWithConnectionByIdAsync(input.ConnectionId);
        if (order is null || order.Request.CustomerId != customer.Id)
            throw new UseCaseException(UseCaseFailure.NotFound, "Connection does not exist.");

        return await operationsService.SubmitPlanChangeAsync(input, employee.Id);
    }

    public async Task<IReadOnlyList<CustomerQueryView>> QueriesAsync(int actorId)
    {
        var (_, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: true);
        return await operationsService.QueriesAsync(null, null, customer.Id);
    }

    public async Task<CustomerQueryView> CreateQueryAsync(int actorId, CustomerSelfQueryInput input)
    {
        var (employee, customer) = await RequireCustomerActorAsync(actorId, allowSuspendedForRead: false);
        return await operationsService.CreateQueryAsync(
            new CustomerQueryInput(customer.Id, input.Subject, input.Category, input.Question),
            employee.Id);
    }

    private async Task<(Employee Employee, Customer Customer)> RequireCustomerActorAsync(
        int employeeId,
        bool allowSuspendedForRead,
        bool tracking = false)
    {
        var employee = await portal.FindEmployeeWithCustomerAsync(employeeId, tracking);
        if (employee is null || employee.Role != Roles.Customer || !employee.CustomerId.HasValue || employee.Customer is null)
            throw new UseCaseException(UseCaseFailure.Unauthorized, "Authenticated customer session required.");

        if (!employee.Active)
            throw new UseCaseException(UseCaseFailure.Forbidden, "Customer login is deactivated.");

        if (!allowSuspendedForRead && employee.Customer.IsSuspended)
            throw new UseCaseException(UseCaseFailure.Forbidden, "Customer account is suspended.");

        return (employee, employee.Customer);
    }

    private static CustomerProfileView ToProfileView(Customer customer, Employee employee) =>
        new(
            customer.Id,
            customer.Code,
            customer.Name,
            customer.Phone,
            customer.Address,
            customer.CityCode,
            customer.TaxId,
            customer.Email,
            customer.ContactPerson,
            customer.CustomerType,
            customer.Status ?? "ACTIVE",
            employee.Username,
            employee.Active);

    private static string? TrimOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
