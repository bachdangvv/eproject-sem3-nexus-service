using Nexus.Domain;

namespace Nexus.Application;

public sealed record EmployeeView(int Id, string Username, string DisplayName, string Role);

public sealed class StaffService(IStaffStore store, IPasswordService passwords)
{
    public async Task<EmployeeView> AuthenticateAsync(LoginInput input)
    {
        var user = await store.FindEmployeeAsync(input.Username.Trim().ToLowerInvariant());
        if (user is null || !passwords.Verify(user, input.Password))
            throw new UseCaseException(UseCaseFailure.Unauthorized, "Invalid username or password.");
        return ToView(user);
    }

    public async Task<IReadOnlyList<EmployeeView>> EmployeesAsync() =>
        (await store.ListEmployeesAsync()).Select(ToView).ToArray();

    public async Task<EmployeeView> CreateAsync(EmployeeInput input)
    {
        if (!Roles.All.Contains(input.Role))
            throw new UseCaseException(UseCaseFailure.InvalidInput, "Unknown role.");

        var user = new Employee
        {
            Username = input.Username.ToLowerInvariant(), DisplayName = input.DisplayName.Trim(),
            Role = input.Role, PasswordHash = ""
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

    private static EmployeeView ToView(Employee employee) =>
        new(employee.Id, employee.Username, employee.DisplayName, employee.Role);
}
