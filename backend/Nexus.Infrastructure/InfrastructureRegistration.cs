using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexus.Application;
using Nexus.Domain;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Infrastructure;

/// <summary>Registers EF Core persistence, stores, and Identity password hashing services.</summary>
public static class InfrastructureRegistration
{
    /// <summary>Configures SQLite demo or SQL Server database context and application store bindings.</summary>
    public static IServiceCollection AddNexusInfrastructure(this IServiceCollection services, bool demo, string connection)
    {
        // Demo mode uses SQLite with deterministic seeding; production uses SQL Server.
        if (demo)
        {
            services.AddDbContext<NexusDb, DemoDb>(options =>
                options.UseSqlite(connection).UseSeeding(NexusDb.SeedDemo));
        }
        else
        {
            services.AddDbContext<NexusDb, SqlServerDb>(options => options.UseSqlServer(connection));
        }

        services.AddScoped<EfNexusStore>();
        services.AddScoped<ICatalogStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IOperationsStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IBillingStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IStaffStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IInventoryStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<ICustomerPortalStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IDepositStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IAdvanceStore>(provider => provider.GetRequiredService<EfNexusStore>());
        services.AddScoped<IPasswordHasher<Employee>, PasswordHasher<Employee>>();
        services.AddScoped<IPasswordService, IdentityPasswordService>();
        return services;
    }

    /// <summary>Applies pending EF migrations and seeds the initial production admin if configured.</summary>
    public static void InitializeNexusDatabase(this IServiceProvider services, string? initialPassword)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NexusDb>();
        db.Database.Migrate();
        db.InitializeLegacyDeposits();
        db.InitializeLegacyAdvances();
        if (string.IsNullOrEmpty(initialPassword) || db.Employees.Any()) return;

        if (initialPassword.Length is < 12 or > 128)
            throw new InvalidOperationException("NexusBootstrapPassword must be 12 to 128 characters.");
        var admin = new Employee { Username = "admin", DisplayName = "Administrator", Role = Roles.Admin, PasswordHash = "" };
        admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordService>().Hash(admin, initialPassword);
        db.Employees.Add(admin);
        db.SaveChanges();
    }
}

internal sealed class IdentityPasswordService(IPasswordHasher<Employee> hasher) : IPasswordService
{
    public string Hash(Employee employee, string password) => hasher.HashPassword(employee, password);

    public bool Verify(Employee employee, string password) =>
        hasher.VerifyHashedPassword(employee, employee.PasswordHash, password) != PasswordVerificationResult.Failed;
}
