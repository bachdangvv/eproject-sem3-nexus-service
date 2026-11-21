using Nexus.Domain;

namespace Nexus.Application;

/// <summary>Projected user account DTO omitting credential hashes.</summary>
public sealed record EmployeeView(int Id, string Username, string DisplayName, string Role, bool Active, int? RetailShopId, int? CustomerId = null);

/// <summary>Application service managing login authentication, staff creation, updates, and soft deactivation.</summary>
public sealed class StaffService(IStaffStore store, IPasswordService passwords)
{
    /// <summary>Authenticates active staff or customer portal credentials.</summary>
    public async Task<EmployeeView> AuthenticateAsync(LoginInput input)
    {
        var user = await store.FindEmployeeAsync(input.Username.Trim().ToLowerInvariant());
        if (user is null || !passwords.Verify(user, input.Password))
            throw new UseCaseException(UseCaseFailure.Unauthorized, "Invalid username or password.");

        var isCustomer = user.Role == Roles.Customer || user.CustomerId.HasValue;
        if (!user.Active)
        {
            if (isCustomer)
                throw new UseCaseException(UseCaseFailure.Forbidden, "Customer login is deactivated.");
            throw new UseCaseException(UseCaseFailure.Unauthorized, "Invalid username or password.");
        }

        if (isCustomer && (!user.CustomerId.HasValue || user.Customer is null || user.Customer.IsSuspended))
            throw new UseCaseException(UseCaseFailure.Forbidden, "Customer account is suspended.");

        return ToView(user);
    }

    public async Task<IReadOnlyList<EmployeeView>> EmployeesAsync() =>
        (await store.ListEmployeesAsync()).Select(ToView).ToArray();

    public async Task<EmployeeView> CreateAsync(EmployeeInput input)
    {
        if (!Roles.Staff.Contains(input.Role))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select a valid staff role.");

        var username = input.Username.Trim().ToLowerInvariant();
        if (ReservedUsernames.IsReservedCustomerCode(username))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Usernames matching CUS-<number> are reserved.");

        if (string.IsNullOrWhiteSpace(input.DisplayName))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Display name is required.");

        if (string.IsNullOrWhiteSpace(input.Password))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Password cannot be blank.");

        if (input.RetailShopId.HasValue)
            await ValidateRetailShopAsync(input.RetailShopId.Value, checkActive: true);

        var user = new Employee
        {
            Username = username,
            DisplayName = input.DisplayName.Trim(),
            Role = input.Role,
            PasswordHash = "",
            Active = true,
            RetailShopId = input.RetailShopId
        };
        const string duplicate = "That username already exists.";
        if (await store.FindEmployeeAsync(user.Username) is not null)
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);

        user.PasswordHash = passwords.Hash(user, input.Password);
        store.Add(user);
        try { await store.SaveChangesAsync(); }
        catch (StoreWriteException)
        {
            if (await store.FindEmployeeAsync(user.Username) is null) throw;
            throw new UseCaseException(UseCaseFailure.Conflict, duplicate);
        }
        return ToView(user);
    }

    public async Task<EmployeeView> UpdateAsync(int id, EmployeeUpdateInput input, int? actorId = null)
    {
        var user = await store.FindTrackedEmployeeByIdAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Employee not found.");

        if (string.IsNullOrWhiteSpace(input.DisplayName))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Display name is required.");

        if (user.Role == Roles.Customer)
        {
            if (input.Role != Roles.Customer)
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Customer login role cannot be changed.");
            if (input.RetailShopId.HasValue)
                throw new UseCaseException(UseCaseFailure.InvalidInput, "Customer logins cannot be assigned to a retail shop.");
        }
        else if (!Roles.Staff.Contains(input.Role))
        {
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Select a valid staff role.");
        }

        if (user.Active && user.Role == Roles.Admin && input.Role != Roles.Admin && await store.CountActiveAdminsAsync() <= 1)
            throw new UseCaseException(UseCaseFailure.Conflict, "Cannot change the role of the last active administrator.");

        if (input.Active is { } active)
        {
            if (!active)
            {
                if (actorId.HasValue && user.Id == actorId.Value)
                    throw new UseCaseException(UseCaseFailure.Conflict, "You cannot deactivate your own account.");
                if (user.Active && user.Role == Roles.Admin && await store.CountActiveAdminsAsync() <= 1)
                    throw new UseCaseException(UseCaseFailure.Conflict, "Cannot deactivate the last active administrator.");
            }
            user.Active = active;
        }

        if (input.RetailShopId.HasValue)
            await ValidateRetailShopAsync(input.RetailShopId.Value, checkActive: user.RetailShopId != input.RetailShopId.Value);

        if (input.Password is not null && string.IsNullOrWhiteSpace(input.Password))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Password cannot be blank.");

        user.DisplayName = input.DisplayName.Trim();
        user.Role = input.Role;
        user.RetailShopId = input.RetailShopId;
        if (!string.IsNullOrWhiteSpace(input.Password))
        {
            user.PasswordHash = passwords.Hash(user, input.Password);
        }

        await store.SaveChangesAsync();
        return ToView(user);
    }

    /// <summary>Soft-deactivates a staff account while preventing self-deactivation or removing the last active Admin.</summary>
    public async Task<EmployeeView> DeactivateAsync(int id, int actorId)
    {
        var user = await store.FindTrackedEmployeeByIdAsync(id)
            ?? throw new UseCaseException(UseCaseFailure.NotFound, "Employee not found.");

        if (user.Id == actorId)
            throw new UseCaseException(UseCaseFailure.Conflict, "You cannot deactivate your own account.");

        if (user.Active && user.Role == Roles.Admin && await store.CountActiveAdminsAsync() <= 1)
            throw new UseCaseException(UseCaseFailure.Conflict, "Cannot deactivate the last active administrator.");

        user.Active = false;
        await store.SaveChangesAsync();
        return ToView(user);
    }

    private async Task ValidateRetailShopAsync(int retailShopId, bool checkActive)
    {
        var shop = await store.FindRetailShopAsync(retailShopId)
            ?? throw new UseCaseException(UseCaseFailure.InvalidInput, "Selected retail shop does not exist.");
        if (checkActive && !shop.Active)
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Selected retail shop is inactive.");
    }

    internal static EmployeeView ToView(Employee employee) =>
        new(employee.Id, employee.Username, employee.DisplayName, employee.Role, employee.Active, employee.RetailShopId, employee.CustomerId);
}
