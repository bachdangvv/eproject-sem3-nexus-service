using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Nexus.Application;
using Nexus.Domain;
using Nexus.Infrastructure.Persistence;

// Build a real pre-ledger SQLite database; migrations/backfill must preserve all issued amounts.
var directory = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "backend", "data", $"deposit-check-{Guid.NewGuid():N}"));
Directory.CreateDirectory(directory);
var path = Path.Combine(directory, "legacy.db");
var sqlServer = args.Contains("--sqlserver");
await BillingSafetyChecks.CheckLegacyAsync(sqlServer, directory);
var databaseName = $"NexusDepositCheck_{Guid.NewGuid():N}";
NexusDb CreateContext() => sqlServer
    ? new SqlServerDb(new DbContextOptionsBuilder<SqlServerDb>().UseSqlServer($"Server=(localdb)\\MSSQLLocalDB;Database={databaseName};Integrated Security=True;TrustServerCertificate=True;Connect Timeout=15").Options)
    : new DemoDb(new DbContextOptionsBuilder<DemoDb>().UseSqlite($"Data Source={path};Foreign Keys=True").Options);
using var db = CreateContext();
db.GetService<IMigrator>().Migrate(sqlServer ? "20261121083905_AddEmployeeCustomerLink" : "20261121083859_AddEmployeeCustomerLink");
var actor = new Employee { Username = "deposit.check", DisplayName = "Deposit Check", Role = Roles.Billing, PasswordHash = "fixture" };
var city = new City { Code = "101", Name = "Check City" };
var customer = new Customer { Name = "Legacy Check", SearchName = "LEGACY CHECK", Phone = "0900000091", Address = "Fixture", CityCode = "101", City = city, Status = "ACTIVE" };
var plan = new ServicePlan { Name = "BB Check", Type = "B", Description = "Legacy billing fixture", Price = 225 };
db.AddRange(actor, city, customer);
db.SaveChanges();
// Insert using the historical schema: AdvancePerConnection did not exist in this fixture version.
db.Database.ExecuteSqlInterpolated($"INSERT INTO Plans (Name, Type, Description, Price, Active, LocalCallRate, StdCallRate, MobileMsgRate, ValidityMonths) VALUES ({plan.Name}, {plan.Type}, {plan.Description}, {plan.Price}, {true}, {0m}, {0m}, {0m}, {1})");
plan.Id = db.Database.SqlQuery<int>($"SELECT Id AS Value FROM Plans WHERE Name = {plan.Name}").Single();
db.Attach(plan);

ServiceOrder Order()
{
    var request = new ServiceRequest
    {
        Customer = customer, Plan = plan, PlanName = plan.Name, Type = "B", CityCode = "101", Address = $"Fixture {Guid.NewGuid():N}",
        SnapshotPrice = 225, ConnectionCount = 1, CreatedById = actor.Id
    };
    var order = request.Confirm(actor.Id);
    order.Assess(true, true, null, "Old feasibility", actor.Id);
    order.Deposit!.CollectedAmount = 500; // Temporary fixture setup for the old activation, never persisted as evidence.
    order.Activate(actor.Id);
    order.Deposit = null;
    order.Advance = null;
    // This fixture intentionally predates the current model's connection/payment columns.
    db.Database.ExecuteSqlInterpolated($"INSERT INTO Requests (CustomerId, PlanId, PlanName, Type, CityCode, Address, HasNexusLandline, CreatedAt, CreatedById, Confirmed, ConnectionCount, SnapshotPrice) VALUES ({customer.Id}, {plan.Id}, {plan.Name}, {"B"}, {"101"}, {request.Address}, {false}, {request.CreatedAt}, {actor.Id}, {true}, {1}, {225m})");
    request.Id = db.Database.SqlQuery<int>($"SELECT Id AS Value FROM Requests WHERE Address = {request.Address}").Single();
    order.RequestId = request.Id;
    db.Database.ExecuteSqlInterpolated($"INSERT INTO Orders (RequestId, Status, CreatedAt) VALUES ({request.Id}, {3}, {order.CreatedAt})");
    order.Id = db.Database.SqlQuery<long>($"SELECT Id AS Value FROM Orders WHERE RequestId = {request.Id}").Single();
    order.Connection!.OrderId = order.Id;
    db.Database.ExecuteSqlInterpolated($"INSERT INTO Connections (OrderId, Type, CityCode, ActivatedAt, Status) VALUES ({order.Id}, {"B"}, {"101"}, {order.Connection.ActivatedAt}, {"Active"})");
    order.Connection.Id = db.Database.SqlQuery<long>($"SELECT Id AS Value FROM Connections WHERE OrderId = {order.Id}").Single();
    return order;
}

Invoice Bill(ServiceOrder order, string suffix, string status, decimal paid)
{
    var invoice = new Invoice
    {
        ConnectionId = order.Connection!.Id, InvoiceNumber = $"LEGACY-{suffix}", RentalAmount = 225,
        Subtotal = 225, TaxAmount = 27.54m, DepositAmount = 500, TotalAmount = 752.54m,
        PaidAmount = paid, DueAmount = status == "RolledOver" ? 0 : 752.54m - paid, Status = status,
        PaidAt = status == "Paid" ? DateTime.UtcNow.AddDays(-2) : null,
        PaidById = status == "Paid" ? actor.Id : null
    };
    db.Database.ExecuteSqlInterpolated($"INSERT INTO Invoices (ConnectionId, InvoiceNumber, BillingPeriodStart, BillingPeriodEnd, RentalAmount, LocalMinutes, StdMinutes, MobileMinutes, CallUsageAmount, EquipmentFee, Subtotal, DiscountAmount, DiscountPercent, TaxRate, TaxAmount, DepositAmount, PreviousDueBalance, TotalAmount, PaidAmount, DueAmount, Status, CreatedAt, PaidAt, PaidById) VALUES ({invoice.ConnectionId}, {invoice.InvoiceNumber}, {invoice.BillingPeriodStart}, {invoice.BillingPeriodEnd}, {225m}, {0m}, {0m}, {0m}, {0m}, {0m}, {225m}, {0m}, {0}, {invoice.TaxRate}, {27.54m}, {500m}, {0m}, {752.54m}, {paid}, {invoice.DueAmount}, {status}, {invoice.CreatedAt}, {invoice.PaidAt}, {invoice.PaidById})");
    invoice.Id = db.Database.SqlQuery<long>($"SELECT Id AS Value FROM Invoices WHERE InvoiceNumber = {invoice.InvoiceNumber}").Single();
    if (paid > 0)
        db.Database.ExecuteSqlInterpolated($"INSERT INTO Payments (InvoiceId, Amount, PaidById, Channel, PaidAt) VALUES ({invoice.Id}, {paid}, {actor.Id}, {"CityOffice"}, {DateTime.UtcNow.AddDays(-2)})");
    return invoice;
}

var paidOrder = Order(); Bill(paidOrder, "PAID", "Paid", 752.54m);
var partialOrder = Order(); Bill(partialOrder, "PARTIAL", "PartiallyPaid", 300);
var unknownOrder = Order();
db.Database.ExecuteSqlInterpolated($"UPDATE Connections SET RefundAmount = {500m}, RefundStatus = {"Pending"} WHERE Id = {unknownOrder.Connection!.Id}");
var refundedOrder = Order(); Bill(refundedOrder, "REFUNDED", "Paid", 752.54m);
db.Database.ExecuteSqlInterpolated($"UPDATE Connections SET Status = {"PermanentlyInactive"}, RefundStatus = {"Refunded"}, RefundAmount = {500m}, RefundedAt = {DateTime.UtcNow.AddDays(-1)}, RefundedById = {actor.Id} WHERE Id = {refundedOrder.Connection!.Id}");
var rolledOrder = Order(); Bill(rolledOrder, "ROLLED", "RolledOver", 300);
var multipleOrder = Order(); Bill(multipleOrder, "MULTIPLE-1", "Paid", 752.54m); Bill(multipleOrder, "MULTIPLE-2", "Paid", 752.54m);
db.SaveChanges();
var snapshots = db.Invoices.AsNoTracking().ToDictionary(i => i.Id, Snapshot);
db.ChangeTracker.Clear();
db.Database.Migrate();
db.InitializeLegacyDeposits();
db.InitializeLegacyDeposits(); // Re-running startup must not import receipts twice.
db.InitializeLegacyAdvances();
db.InitializeLegacyAdvances();
db.ChangeTracker.Clear();
var store = new EfNexusStore(db);
var deposits = new DepositService(store, store);

void Check(bool condition, string label)
{
    if (!condition) throw new InvalidOperationException($"FAIL {label}");
    Console.WriteLine($"PASS {label}");
}
async Task Conflict(Func<Task> action, string label)
{
    try { await action(); }
    catch (UseCaseException e) when (e.Failure is UseCaseFailure.Conflict or UseCaseFailure.InvalidInput) { Console.WriteLine($"PASS {label}"); return; }
    throw new InvalidOperationException($"FAIL {label}");
}

var paid = await deposits.FindAsync(paidOrder.Code);
Check(paid.CollectedAmount == 500 && paid.Transactions.Count == 1 && !paid.NeedsReconciliation && paid.Transactions[0].SourceInvoiceId.HasValue,
    "L01 fully settled legacy invoice imports exactly one evidenced deposit allocation");
foreach (var (order, label) in new[] { (partialOrder, "partial payment"), (unknownOrder, "no receipt"), (rolledOrder, "rolled-over invoice"), (multipleOrder, "multiple deposit invoices") })
{
    var view = await deposits.FindAsync(order.Code);
    Check(view.NeedsReconciliation && view.CollectedAmount == 0 && view.RefundableAmount == 0, $"L02 {label} never invents received/refundable cash");
}
var returned = await deposits.FindAsync(refundedOrder.Code);
Check(!returned.NeedsReconciliation && returned.CollectedAmount == 500 && returned.RefundedAmount == 500 && returned.Balance == 0 && returned.Transactions.Count == 2,
    "L03 recorded legacy refund is preserved and cannot be paid twice");
var forbiddenRefund = new DepositMoneyInput(500, Guid.NewGuid().ToString(), "Cash", "NO-EVIDENCE", "Attempt without receipt");
await Conflict(async () => { await deposits.PostAsync(unknownOrder.Code, forbiddenRefund, actor.Id, true); }, "L04 unresolved legacy refund blocked");

var reconcile = new ReconcileDepositInput(200, 0, Guid.NewGuid().ToString(), "ARCHIVE-RECEIPT-200", "Verified archived allocation: 200 deposit, 100 service payment");
var reconciled = await deposits.ReconcileAsync(partialOrder.Code, reconcile, actor.Id);
var retry = await deposits.ReconcileAsync(partialOrder.Code, reconcile, actor.Id);
Check(reconciled.CollectedAmount == 200 && !reconciled.NeedsReconciliation && retry.Transactions.Count == 1 && retry.Transactions[0].Kind == "Reconciliation",
    "L05 evidenced reconciliation and replay do not create a new cash collection");
await Conflict(async () => { await deposits.ReconcileAsync(partialOrder.Code, reconcile with { CollectedAmount = 300 }, actor.Id); }, "L06 changed reconciliation replay rejected");

// Emulate the persisted Technical closure; endpoint role/state coverage runs in deposit-scenarios.ps1.
var closed = await store.FindDepositOrderAsync(OrderNumber.Parse(partialOrder.Code)!.Value);
closed!.Connection!.Status = "PermanentlyInactive";
closed.Deposit!.Version++;
await store.SaveChangesAsync();
var refund = await deposits.PostAsync(partialOrder.Code, new DepositMoneyInput(200, Guid.NewGuid().ToString(), "BankTransfer", "REFUND-ARCHIVE-200", "Return verified held deposit"), actor.Id, true);
Check(refund.RefundedAmount == 200 && refund.Balance == 0, "L07 legacy partial invoice refunds only evidence-backed deposit allocation");
Check(db.Invoices.AsNoTracking().AsEnumerable().All(i => snapshots[i.Id] == Snapshot(i)), "L08 migration/reconciliation/refund preserve every legacy invoice amount and status");
Check(db.SecurityDeposits.Count() == 6 && db.DepositTransactions.Count(t => t.OperationId.StartsWith("legacy-")) == 3,
    "L09 startup backfill is idempotent");

// Reproduce an inconsistent tracked read: old Feasible status plus a refreshed ledger version after cancellation.
// The atomic money write must still check the lifecycle predicate, not only the ledger version.
long raceId;
using (var setup = CreateContext())
{
    var request = new ServiceRequest
    {
        Customer = setup.Customers.Single(), Plan = setup.Plans.Single(), PlanName = "BB Check", Type = "B",
        CityCode = "101", Address = "Race fixture", SnapshotPrice = 225, CreatedById = actor.Id
    };
    var order = request.Confirm(actor.Id);
    order.Assess(true, true, null, "Race feasibility", actor.Id);
    setup.Add(order); setup.SaveChanges(); raceId = order.Id;
}
using (var stale = CreateContext())
{
    var staleStore = new EfNexusStore(stale);
    var number = new OrderNumber("B", raceId);
    var staleOrder = (await staleStore.FindDepositOrderAsync(number))!;
    using (var writer = CreateContext())
    {
        var writerStore = new EfNexusStore(writer);
        var order = (await writerStore.FindDepositOrderAsync(number))!;
        order.Cancel("Concurrent cancellation", actor.Id);
        await writerStore.SaveChangesAsync();
    }
    await stale.Entry(staleOrder.Deposit!).ReloadAsync();
    await Conflict(async () =>
    {
        await new DepositService(staleStore, staleStore).PostAsync(number.ToString(),
            new DepositMoneyInput(500, Guid.NewGuid().ToString(), "Cash", "STALE-LIFECYCLE", "Stale feasibility read"), actor.Id, false);
    }, "L10 receipt with stale lifecycle and refreshed ledger version is rejected atomically");
}
using (var verify = CreateContext())
    Check(verify.SecurityDeposits.Single(d => d.OrderId == raceId).CollectedAmount == 0,
        "L11 failed stale-state receipt leaves no received money");

// A historical over-collection is evidence to refund, not a reason to discard customer money.
var multiple = await deposits.ReconcileAsync(multipleOrder.Code,
    new ReconcileDepositInput(1000, 0, Guid.NewGuid().ToString(), "TWO-OLD-RECEIPTS", "Two independently verified historical deposit receipts of 500 each"), actor.Id);
Check(multiple.Balance == 1000 && multiple.RequiredAmount == 500 && !multiple.NeedsReconciliation,
    "L12 evidenced historical over-collection remains fully accounted for");
var multipleClosed = (await store.FindDepositOrderAsync(OrderNumber.Parse(multipleOrder.Code)!.Value))!;
multipleClosed.Connection!.Status = "PermanentlyInactive"; multipleClosed.Deposit!.Version++;
await store.SaveChangesAsync();
var excessRefund = await deposits.PostAsync(multipleOrder.Code,
    new DepositMoneyInput(1000, Guid.NewGuid().ToString(), "Cheque", "RETURN-TWO-RECEIPTS", "Return all historical deposit cash actually held"), actor.Id, true);
Check(excessRefund.Balance == 0 && excessRefund.RefundedAmount == 1000, "L13 historical excess cash can be returned without permitting new over-collection");
await AdvanceChecks.RunAsync(CreateContext, actor.Id, customer.Id);
await BillingSafetyChecks.RunAsync(CreateContext, actor.Id, customer.Id);
Console.WriteLine($"Legacy deposit, advance and payment-history checks passed. Isolated database: {(sqlServer ? databaseName : path)}");

static string Snapshot(Invoice invoice) => JsonSerializer.Serialize(new
{
    invoice.RentalAmount, invoice.Subtotal, invoice.TaxAmount, invoice.DepositAmount, invoice.DiscountAmount,
    invoice.DiscountPercent, invoice.TotalAmount, invoice.PaidAmount, invoice.DueAmount, invoice.Status, invoice.PaidAt
});
