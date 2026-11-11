using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Nexus.Infrastructure.Persistence;

// Design-time model selection keeps migration tooling independent of runtime credentials.
public sealed class DemoFactory : IDesignTimeDbContextFactory<DemoDb>
{
    public DemoDb CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<DemoDb>().UseSqlite("Data Source=demo.db").Options);
}

public sealed class SqlServerFactory : IDesignTimeDbContextFactory<SqlServerDb>
{
    public SqlServerDb CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<SqlServerDb>()
            .UseSqlServer("Server=localhost;Database=Nexus;Integrated Security=true;TrustServerCertificate=true")
            .Options);
}
