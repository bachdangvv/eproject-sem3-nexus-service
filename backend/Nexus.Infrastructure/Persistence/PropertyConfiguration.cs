using Microsoft.EntityFrameworkCore;
using Nexus.Domain;

namespace Nexus.Infrastructure.Persistence;

public abstract partial class NexusDb
{
    private static void ConfigureProperties(ModelBuilder model)
    {
        model.Entity<Employee>(entity =>
        {
            entity.Property(user => user.Username).HasMaxLength(40);
            entity.Property(user => user.DisplayName).HasMaxLength(100);
            entity.Property(user => user.Role).HasMaxLength(20);
            entity.Property(user => user.PasswordHash).HasMaxLength(512);
        });

        model.Entity<City>(entity =>
        {
            entity.HasKey(city => city.Code);
            entity.Property(city => city.Code).HasMaxLength(3);
            entity.Property(city => city.Name).HasMaxLength(100);
        });

        model.Entity<Customer>(entity =>
        {
            entity.Ignore(customer => customer.Code);
            entity.Property(customer => customer.Name).HasMaxLength(120);
            entity.Property(customer => customer.SearchName).HasMaxLength(120);
            entity.Property(customer => customer.Phone).HasMaxLength(16);
            entity.Property(customer => customer.Address).HasMaxLength(240);
            entity.Property(customer => customer.CityCode).HasMaxLength(3);
            entity.Property(customer => customer.TaxId).HasMaxLength(32);
            entity.Property(customer => customer.Email).HasMaxLength(160);
            entity.Property(customer => customer.ContactPerson).HasMaxLength(120);
            entity.Property(customer => customer.CustomerType).HasMaxLength(40);
            entity.Property(customer => customer.Status).HasMaxLength(40);
        });

        model.Entity<ServicePlan>(entity =>
        {
            entity.Property(plan => plan.Name).HasMaxLength(100);
            entity.Property(plan => plan.Type).HasMaxLength(1);
            entity.Property(plan => plan.Description).HasMaxLength(240);
        });

        model.Entity<Product>(entity =>
        {
            entity.Property(product => product.Name).HasMaxLength(100);
            entity.Property(product => product.Description).HasMaxLength(240);
        });

        model.Entity<ServiceRequest>(entity =>
        {
            entity.Property(request => request.PlanName).HasMaxLength(100);
            entity.Property(request => request.Type).HasMaxLength(1);
            entity.Property(request => request.CityCode).HasMaxLength(3);
            entity.Property(request => request.Address).HasMaxLength(240);
            entity.Property(request => request.Confirmed).IsConcurrencyToken();
        });

        model.Entity<ServiceOrder>(entity =>
        {
            entity.Ignore(order => order.Code);
            entity.Property(order => order.Status).IsConcurrencyToken();
        });

        model.Entity<OrderEvent>().Property(entry => entry.Note).HasMaxLength(500);

        model.Entity<Connection>(entity =>
        {
            entity.Ignore(connection => connection.AccountId);
            entity.Property(connection => connection.Type).HasMaxLength(1);
            entity.Property(connection => connection.CityCode).HasMaxLength(3);
        });

        model.Entity<ServiceFeedback>().Property(entry => entry.Comment).HasMaxLength(600);
    }
}
