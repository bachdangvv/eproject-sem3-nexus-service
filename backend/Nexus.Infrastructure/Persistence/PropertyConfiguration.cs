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
            entity.Property(product => product.ReplacementPrice).HasPrecision(12, 2);
        });

        model.Entity<RetailShop>(entity =>
        {
            entity.Property(s => s.Code).HasMaxLength(30);
            entity.Property(s => s.Name).HasMaxLength(120);
            entity.Property(s => s.CityCode).HasMaxLength(3);
            entity.Property(s => s.Address).HasMaxLength(240);
            entity.Property(s => s.Phone).HasMaxLength(20);
        });

        model.Entity<Vendor>(entity =>
        {
            entity.Property(v => v.Code).HasMaxLength(30);
            entity.Property(v => v.Name).HasMaxLength(120);
            entity.Property(v => v.ContactPerson).HasMaxLength(120);
            entity.Property(v => v.Phone).HasMaxLength(20);
            entity.Property(v => v.Email).HasMaxLength(160);
            entity.Property(v => v.Address).HasMaxLength(240);
        });

        model.Entity<PurchaseOrder>(entity =>
        {
            entity.Property(p => p.OrderNumber).HasMaxLength(30);
            entity.Property(p => p.Status).HasMaxLength(20).IsConcurrencyToken();
            entity.Property(p => p.UnitPrice).HasPrecision(12, 2);
            entity.Property(p => p.TotalAmount).HasPrecision(12, 2);
            entity.Property(p => p.Note).HasMaxLength(500);
        });

        model.Entity<VendorPayment>(entity =>
        {
            entity.Property(p => p.PaymentNumber).HasMaxLength(30);
            entity.Property(p => p.Amount).HasPrecision(12, 2);
            entity.Property(p => p.Method).HasMaxLength(30);
            entity.Property(p => p.Reference).HasMaxLength(100);
            entity.Property(p => p.Note).HasMaxLength(500);
        });

        model.Entity<EquipmentIncident>(entity =>
        {
            entity.Property(i => i.Description).HasMaxLength(500);
            entity.Property(i => i.ReplacementFee).HasPrecision(12, 2);
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

        model.Entity<Invoice>(entity =>
        {
            entity.Property(invoice => invoice.InvoiceNumber).HasMaxLength(60);
            entity.Property(invoice => invoice.Status).HasMaxLength(20);
        });

        model.Entity<PaymentTransaction>(entity =>
        {
            entity.Property(payment => payment.Channel).HasMaxLength(30);
            entity.Property(payment => payment.Note).HasMaxLength(250);
        });

        model.Entity<ServiceFeedback>().Property(entry => entry.Comment).HasMaxLength(600);
    }
}
