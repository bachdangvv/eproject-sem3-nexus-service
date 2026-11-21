using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Nexus.Infrastructure.Persistence;

// Design-time model selection keeps migration tooling independent of runtime credentials.
/// <summary>Design-time EF Core factory for the SQLite demo context.</summary>
public sealed class DemoFactory : IDesignTimeDbContextFactory<DemoDb>
{
    public DemoDb CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<DemoDb>().UseSqlite("Data Source=demo.db").Options);
}

/// <summary>Design-time EF Core factory for the SQL Server production context.</summary>
public sealed class SqlServerFactory : IDesignTimeDbContextFactory<SqlServerDb>
{
    public SqlServerDb CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<SqlServerDb>()
            .UseSqlServer("Server=localhost;Database=Nexus;Integrated Security=true;TrustServerCertificate=true")
            .Options);
}
