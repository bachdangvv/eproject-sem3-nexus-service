using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Nexus.Application;
using Nexus.Domain;
using Nexus.Infrastructure.Persistence;

internal static class BillingSafetyChecks
{
    private static void Check(bool ok, string label)
    {
        if (!ok) throw new InvalidOperationException($"FAIL {label}");
        Console.WriteLine($"PASS {label}");
    }

    private static async Task Reject(Func<Task> action, string label, UseCaseFailure expected = UseCaseFailure.Conflict)
    {
        try { await action(); }
        catch (UseCaseException e) when (e.Failure == expected) { Check(true, label); return; }
        throw new InvalidOperationException($"FAIL {label}");
    }

    public static async Task CheckLegacyAsync(bool sqlServer, string directory)
    {
        var database = $"NexusReview1Check_{Guid.NewGuid():N}";
        using NexusDb db = sqlServer
            ? new SqlServerDb(new DbContextOptionsBuilder<SqlServerDb>().UseSqlServer($"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=True;TrustServerCertificate=True").Options)
            : new DemoDb(new DbContextOptionsBuilder<DemoDb>().UseSqlite($"Data Source={Path.Combine(directory, "review1.db")};Foreign Keys=True").Options);
        var migrator = db.GetService<IMigrator>();
        var review1 = sqlServer ? "20261116023315_Review1Billing" : "20261116023312_Review1Billing";
        await migrator.MigrateAsync(review1);
        var activated = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
        var paidAt = activated.AddDays(1);
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Cities (Code, Name) VALUES ('101', 'Legacy city')");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Employees (Username, DisplayName, Role, PasswordHash) VALUES ('review1.cashier', 'Original cashier', 'Billing', 'fixture')");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Customers (Name, SearchName, Phone, Address, CityCode) VALUES ('Review 1 customer', 'REVIEW 1 CUSTOMER', '0900000001', 'Legacy address', '101')");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Plans (Name, Type, Description, Price, Active) VALUES ({"Original plan"}, {"B"}, {"Legacy fixture"}, {225m}, {true})");
        for (var id = 1; id <= 3; id++)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Requests (CustomerId, PlanId, PlanName, Type, CityCode, Address, HasNexusLandline, CreatedAt, CreatedById, Confirmed) VALUES ({1}, {1}, {"Original plan"}, {"B"}, {"101"}, {"Legacy address"}, {false}, {activated}, {1}, {true})");
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Orders (RequestId, Status, CreatedAt) VALUES ({id}, {3}, {activated})");
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Connections (OrderId, Type, CityCode, ActivatedAt) VALUES ({id}, {"B"}, {"101"}, {activated})");
            decimal amount = id == 1 ? 252.54m : id == 2 ? 100m : 50m;
            DateTime? settled = id == 2 ? null : paidAt;
            int? collector = id == 1 ? 1 : null;
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO BillingRecords (ConnectionId, Amount, PaidAt, PaidById) VALUES ({id}, {amount}, {settled}, {collector})");
        }
        await db.Database.MigrateAsync();
        db.InitializeLegacyDeposits(); db.InitializeLegacyAdvances();
        var invoices = await db.Invoices.AsNoTracking().Include(i => i.Payments).OrderBy(i => i.ConnectionId).ToListAsync();
        Check(invoices.Count == 3 && invoices[0].TotalAmount == 252.54m && invoices[0].PaidAmount == 252.54m &&
            invoices[0].DueAmount == 0 && invoices[0].Status == "Paid" && invoices[0].PaidAt == paidAt && invoices[0].PaidById == 1 &&
            invoices[0].InvoiceNumber == "LEGACY-B101000000000001", "B01.1 Review 1 paid bill, amount, collector, timestamp and account reference survive migration");
        Check(invoices[1].TotalAmount == 100 && invoices[1].PaidAmount == 0 && invoices[1].DueAmount == 100 &&
            invoices[1].Status == "Unpaid" && invoices[1].Payments.Count == 0, "B01.2 unpaid legacy debt remains unpaid without a synthetic receipt");
        Check(invoices[0].TaxAmount == 0 && invoices[0].DepositAmount == 0 && invoices[0].BillingPeriodStart == invoices[0].BillingPeriodEnd &&
            invoices[0].Payments.Single().Channel == "LegacyBilling" && invoices[2].Payments.Count == 0 && invoices[2].PaidAmount == 50,
            "B01.3 migration imports existing settlement evidence without invented tariff, period or collector");
        Check(await db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM LegacyBillingRecords").SingleAsync() == 3,
            "B01.4 original billing table is retained for reconciliation");
        var legacyStore = new EfNexusStore(db);
        var gap = await new BillingService(legacyStore, legacyStore).FindAsync("B101000000000003");
        Check(gap.PaymentHistoryGaps!.Count == 1 && gap.PaymentHistoryGaps[0].RecordedPaidAmount == 50 && gap.Payments!.Count == 0,
            "B01.4b legacy settlement without a collector remains visible as a reconciliation gap");
        await db.Database.MigrateAsync();
        Check(await db.Invoices.CountAsync() == 3 && await db.Payments.CountAsync() == 1, "B01.5 repeated startup never imports legacy bills/payments twice");
        await migrator.MigrateAsync(review1);
        Check(await db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM BillingRecords").SingleAsync() == 3,
            "B01.6 downgrade restores the original Review 1 table");
        await db.Database.MigrateAsync();
        await db.Database.ExecuteSqlRawAsync("DROP TABLE LegacyBillingRecords");
        await migrator.MigrateAsync(review1);
        Check(await db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM BillingRecords").SingleAsync() == 0,
            "B01.7 downgrade also supports older databases that have no archive");
    }

    public static async Task RunAsync(Func<NexusDb> createContext, int actorId, int customerId)
    {
        var start = new DateTime(2031, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var cycle = new CreateInvoiceInput(PeriodStart: start, PeriodEnd: start.AddMonths(1));
        async Task<string> Account()
        {
            using var db = createContext();
            var plan = new ServicePlan { Name = "Billing safety fixture", Type = "B", Price = 225, Description = "Isolated regression" };
            var request = new ServiceRequest { CustomerId = customerId, Plan = plan, PlanName = plan.Name, Type = "B", CityCode = "101", Address = "Fixture", SnapshotPrice = 225, CreatedById = actorId };
            var order = request.Confirm(actorId);
            order.Assess(true, true, null, "Fixture", actorId);
            order.Deposit!.CollectedAmount = order.Deposit.RequiredAmount;
            order.Activate(actorId);
            db.Orders.Add(order); await db.SaveChangesAsync();
            return order.Connection!.AccountId;
        }
        async Task<BillingView> Bill(string account, CreateInvoiceInput input)
        {
            using var db = createContext(); var s = new EfNexusStore(db);
            return await new BillingService(s, s).CreateAsync(account, input, actorId);
        }
        async Task<BillingView> Pay(string account, RecordPaymentInput? input, string channel = "CityOffice", int? collector = null)
        {
            using var db = createContext(); var s = new EfNexusStore(db);
            return await new BillingService(s, s).PayAsync(account, input, collector ?? actorId, channel);
        }
        RecordPaymentInput Money(decimal? amount, long? invoice = null) => new(amount, "Real test receipt", Guid.NewGuid().ToString(), invoice);

        var account = await Account(); var first = await Bill(account, cycle);
        await Reject(async () => { await Bill(account, cycle); }, "B02.1 same period retry is rejected");
        await Reject(async () => { await Bill(account, cycle with { PeriodStart = start.AddDays(10) }); }, "B02.2 overlapping period is rejected");
        using (var db = createContext())
        {
            var s = new EfNexusStore(db); var unchanged = await new BillingService(s, s).FindAsync(account);
            Check(unchanged.Invoices!.Count == 1 && unchanged.DueAmount == 252.54m && unchanged.Status == "Unpaid", "B02.3 rejected issuance does not roll over debt or add charges");
        }

        var payment = Money(100, first.InvoiceId);
        var paid = await Pay(account, payment); var replay = await Pay(account, payment);
        Check(paid.PaidAmount == 100 && replay.PaidAmount == 100 && replay.Payments!.Count == 1 && replay.Payments[0].Id == paid.Payments![0].Id,
            "B03.1 retry of partial receipt returns the same saved payment");
        Check((await Pay(account, payment with { Amount = 100.00m })).Payments!.Count == 1,
            "B03.1b equivalent decimal representations share the same receipt");
        await Reject(async () => { await Pay(account, payment with { Amount = 101 }); }, "B03.2 operation ID cannot change amount");
        await Reject(async () => { await Pay(account, payment with { Note = "Changed note" }); }, "B03.3 operation ID cannot change note");
        await Reject(async () => { await Pay(account, payment, "RetailOutlet"); }, "B03.4 operation ID cannot change channel");
        int secondActor;
        using (var db = createContext())
        {
            var collector = new Employee { Username = $"other.collector.{Guid.NewGuid():N}"[..40], DisplayName = "Other collector", Role = Roles.Billing, PasswordHash = "fixture" };
            db.Employees.Add(collector); await db.SaveChangesAsync(); secondActor = collector.Id;
        }
        await Reject(async () => { await Pay(account, payment, collector: secondActor); }, "B03.4b operation ID cannot change collector");
        await Reject(async () => { await Pay(account, new(1)); }, "B03.5 unkeyed receipts are rejected", UseCaseFailure.InvalidInput);
        var other = await Account(); await Bill(other, cycle);
        await Reject(async () => { await Pay(other, payment); }, "B03.6 operation ID cannot be reused for another account");
        var next = await Bill(account, cycle with { PeriodStart = start.AddMonths(1), PeriodEnd = start.AddMonths(2) });
        Check(next.PreviousDueBalance == 152.54m && next.DueAmount == 405.08m, "B02.4 adjacent next period carries remaining debt exactly once");
        var afterRollover = await Pay(account, payment);
        Check(afterRollover.PaidAmount == 0 && afterRollover.DueAmount == 405.08m && afterRollover.Payments!.Count == 1,
            "B03.7 a successful old receipt can replay after rollover without paying the new invoice");
        await Reject(async () => { await Pay(account, payment with { InvoiceId = next.InvoiceId }); }, "B03.7b operation ID cannot be retargeted to a new invoice");
        await Reject(async () => { await Pay(account, Money(1, first.InvoiceId)); }, "B03.8 new receipts cannot target the rolled-over invoice");
        var full = Money(null, next.InvoiceId);
        await Pay(account, full); var settled = await Pay(account, full);
        Check(settled.Status == "Paid" && settled.Payments!.Count == 2, "B03.9 full settlement retry preserves the original receipt");
        await Reject(async () => { await Pay(account, Money(1, next.InvoiceId)); }, "B03.10 a new receipt on a paid invoice is rejected");

        var lateAccount = await Account(); var lateBill = await Bill(lateAccount, cycle);
        var latePayment = Money(null, lateBill.InvoiceId);
        using (var late = createContext())
        {
            var s = new EfNexusStore(late);
            var interleaved = new GatedBillingStore(s, beforeLatest: async () => { await Pay(lateAccount, latePayment); });
            var result = await new BillingService(s, interleaved).PayAsync(lateAccount, latePayment, actorId);
            Check(result.Status == "Paid" && result.Payments!.Count == 1,
                "B03.10b retry rechecks its operation when settlement commits between lookup and invoice read");
        }

        // Pause both writers after validation but before SaveChanges: this exercises the database
        // concurrency predicate even on an empty account, rather than merely rechecking the list.
        async Task<(bool Success, BillingView? View)> Attempt(Func<Task<BillingView>> work)
        {
            try { return (true, await work()); }
            catch (UseCaseException e) when (e.Failure == UseCaseFailure.Conflict) { return (false, null); }
        }
        var raceAccount = await Account();
        var gate = new SaveGate();
        var issuance = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => Task.Run(async () =>
        {
            using var db = createContext(); var s = new EfNexusStore(db);
            return await Attempt(() => new BillingService(s, new GatedBillingStore(s, gate)).CreateAsync(raceAccount, cycle, actorId));
        })));
        using (var db = createContext())
        {
            var s = new EfNexusStore(db); var result = await new BillingService(s, s).FindAsync(raceAccount);
            Check(issuance.Count(r => r.Success) == 1 && result.Invoices!.Count == 1 && result.TotalAmount == 252.54m,
                "B02.5 simultaneous first issuance commits one bill and rolls back the losing transaction");
        }
        async Task CheckConcurrentPayment(bool sameOperation)
        {
            var target = await Account(); var invoice = await Bill(target, cycle);
            var same = Money(100, invoice.InvoiceId); var paymentGate = new SaveGate();
            var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(index => Task.Run(async () =>
            {
                using var db = createContext(); var s = new EfNexusStore(db);
                var input = sameOperation || index == 0 ? same : Money(100, invoice.InvoiceId);
                return await Attempt(() => new BillingService(s, new GatedBillingStore(s, paymentGate)).PayAsync(target, input, actorId));
            })));
            using var verify = createContext(); var store = new EfNexusStore(verify);
            var current = await new BillingService(store, store).FindAsync(target);
            Check(results.Count(r => r.Success) == (sameOperation ? 2 : 1) && current.PaidAmount == 100 && current.Payments!.Count == 1,
                sameOperation ? "B03.11 concurrent identical operations share one saved receipt" : "B03.12 concurrent distinct receipts cannot overwrite each other");
        }
        await CheckConcurrentPayment(true); await CheckConcurrentPayment(false);
    }

    private sealed class SaveGate
    {
        private int arrivals;
        private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async Task WaitAsync()
        {
            if (Interlocked.Increment(ref arrivals) == 2) ready.TrySetResult();
            await ready.Task.WaitAsync(TimeSpan.FromSeconds(20));
        }
    }

    private sealed class GatedBillingStore(IBillingStore inner, SaveGate? gate = null, Func<Task>? beforeLatest = null) : IBillingStore
    {
        public Task<PaymentTransaction?> FindPaymentByOperationIdAsync(string id) => inner.FindPaymentByOperationIdAsync(id);
        public async Task<Invoice?> FindLatestInvoiceAsync(long id)
        {
            if (beforeLatest is not null) await beforeLatest();
            return await inner.FindLatestInvoiceAsync(id);
        }
        public Task<Invoice?> ReadLatestInvoiceAsync(long id) => inner.ReadLatestInvoiceAsync(id);
        public Task<IReadOnlyList<Invoice>> ListInvoicesAsync(long id) => inner.ListInvoicesAsync(id);
        public Task<IReadOnlyList<Invoice>> ListOpenTrackedInvoicesAsync(long id) => inner.ListOpenTrackedInvoicesAsync(id);
        public Task<IReadOnlyList<EquipmentIncident>> ListUnsettledIncidentsForConnectionAsync(long id) => inner.ListUnsettledIncidentsForConnectionAsync(id);
        public Task<IReadOnlyList<ServiceOrder>> ListConnectedOrdersAsync(string? q, string? status, string? city) => inner.ListConnectedOrdersAsync(q, status, city);
        public void Add(Invoice invoice) => inner.Add(invoice);
        public void Add(PaymentTransaction payment) => inner.Add(payment);
        public async Task SaveChangesAsync()
        {
            if (gate is not null) await gate.WaitAsync();
            await inner.SaveChangesAsync();
        }
    }
}
