using Microsoft.EntityFrameworkCore;
using Nexus.Application;
using Nexus.Domain;
using Nexus.Infrastructure.Persistence;

internal static class AdvanceChecks
{
    public static async Task RunAsync(Func<NexusDb> createContext, int actorId, int customerId)
    {
        void Check(bool ok, string label)
        {
            if (!ok) throw new InvalidOperationException($"FAIL {label}");
            Console.WriteLine($"PASS {label}");
        }
        async Task Reject(Func<Task> action, string label)
        {
            try { await action(); }
            catch (UseCaseException e) when (e.Failure is UseCaseFailure.Conflict or UseCaseFailure.InvalidInput or UseCaseFailure.NotFound)
            { Console.WriteLine($"PASS {label}"); return; }
            throw new InvalidOperationException($"FAIL {label}");
        }
        DepositMoneyInput Money(decimal amount, string note) => new(amount, Guid.NewGuid().ToString(), "Cash", Guid.NewGuid().ToString(), note);
        async Task<string> Create(decimal? perLine, int count = 10)
        {
            using var db = createContext();
            var plan = new ServicePlan { Name = $"Advance fixture {Guid.NewGuid():N}", Type = "B", Price = 225, Description = "Explicit test advance, not a specification price", AdvancePerConnection = perLine };
            db.Plans.Add(plan); await db.SaveChangesAsync();
            var request = new ServiceRequest
            {
                Customer = (await db.Customers.FindAsync(customerId))!, Plan = plan, PlanName = plan.Name, Type = "B",
                CityCode = "101", Address = "Advance fixture", SnapshotPrice = 225, ConnectionCount = count, CreatedById = actorId
            };
            var order = request.Confirm(actorId);
            order.Assess(true, true, null, "Fixture feasibility", actorId);
            db.Orders.Add(order); await db.SaveChangesAsync(); return order.Code;
        }
        async Task<AdvanceView> Read(string code)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            return await new AdvanceService(store, store).FindAsync(code);
        }
        async Task<AdvanceView> Collect(string code, DepositMoneyInput input)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            return await new AdvanceService(store, store).CollectAsync(code, input, actorId);
        }
        async Task<AdvanceView> Allocate(string code, AllocateAdvanceInput input)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            return await new AdvanceService(store, store).AllocateAsync(code, input, actorId);
        }
        async Task<AdvanceView> Refund(string code, DepositMoneyInput input)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            return await new AdvanceService(store, store).RefundAsync(code, input, actorId);
        }
        async Task<string> Activate(string code)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            var deposit = await new DepositService(store, store).FindAsync(code);
            if (deposit.RemainingToCollect > 0)
                await new DepositService(store, store).PostAsync(code, Money(deposit.RemainingToCollect, "Fixture deposit receipt"), actorId, false);
            var outcome = await new OperationsService(store, store, new UnusedDocuments()).ConnectAsync(code, null, actorId);
            return outcome.Value.AccountId!;
        }
        async Task<BillingView> Bill(string account, CreateInvoiceInput? input = null)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            return await new BillingService(store, store).CreateAsync(account, input, actorId);
        }
        async Task Close(string account)
        {
            using var db = createContext(); var store = new EfNexusStore(db);
            await new OperationsService(store, store, new UnusedDocuments()).TerminateConnectionAsync(account, new("Advance withdrawal"), actorId);
        }
        AllocateAdvanceInput Allocation(long invoiceId, decimal amount) => new(invoiceId, amount, Guid.NewGuid().ToString(), Guid.NewGuid().ToString(), "Explicit fixture invoice allocation");

        using (var legacy = createContext())
            Check(legacy.AdvanceAccounts.Count(a => a.Origin == "Legacy") >= 6 &&
                legacy.AdvanceAccounts.Where(a => a.Origin == "Legacy").All(a => a.PerConnectionAmount == null && a.ReceivedAmount == 0 && a.AllocatedAmount == 0 && a.RefundedAmount == 0),
                "A00 legacy invoices and deposits never become fabricated advance credit");

        foreach (var (count, percent, expected) in new[] { (9, 0, 900m), (10, 25, 750m), (14, 25, 1050m), (15, 50, 750m), (24, 50, 1200m), (25, 75, 625m), (50, 75, 1250m), (51, 100, 0m) })
        {
            var quote = await Read(await Create(100, count));
            Check(quote.DiscountPercent == percent && quote.QuotedAmount == expected && quote.AvailableAmount == 0 && quote.Transactions.Count == 0,
                $"A01 {count} lines: bulk affects the quote, never creates spendable credit");
        }
        var unconfigured = await Create(null);
        var zero = await Create(0);
        Check((await Read(unconfigured)).Status == "NotConfigured" && (await Read(zero)).Status == "NotRequired", "A02 null policy and explicit zero are distinct");
        await Reject(async () => { await Collect(unconfigured, Money(1, "No configured quote")); }, "A03 no collection without a configured quote");

        var code = await Create(100);
        using (var config = createContext())
        {
            var order = config.Orders.Include(o => o.Request).ThenInclude(r => r.Plan).Single(o => o.Id == OrderNumber.Parse(code)!.Value.Serial);
            order.Request.Plan.AdvancePerConnection = 200; config.SaveChanges();
        }
        Check((await Read(code)).QuotedAmount == 750 && (await Read(code)).PerConnectionAmount == 100, "A04 Admin edits do not change a confirmed advance snapshot");
        var receipt = Money(750, "Advance actually received");
        await Collect(code, receipt);
        var retry = await Collect(code, receipt);
        Check(retry.AvailableAmount == 750 && retry.Transactions.Count == 1, "A05 receipt retry records actual 750, not the gross quote 1000");
        await Reject(async () => { await Collect(code, receipt with { Amount = 749 }); }, "A06 changed receipt retry rejected");
        var account = await Activate(code);
        var firstBill = await Bill(account);
        var allocation = Allocation(firstBill.InvoiceId!.Value, 500);
        await Allocate(code, allocation);
        var applied = await Allocate(code, allocation);
        using (var check = createContext())
        {
            var invoice = check.Invoices.Single(i => i.Id == firstBill.InvoiceId);
            Check(applied.AvailableAmount == 250 && applied.AllocatedAmount == 500 && check.Payments.Count(p => p.InvoiceId == invoice.Id && p.Channel == "Advance") == 1 &&
                invoice.TotalAmount == 2525.40m && invoice.TaxAmount == 275.40m && invoice.PaidAmount == 500 && invoice.DueAmount == 2025.40m,
                "A07 allocation/retry is one invoice payment; original charges and tax are unchanged");
            Check(check.SecurityDeposits.Single(d => d.OrderId == OrderNumber.Parse(code)!.Value.Serial).CollectedAmount == 3750,
                "A08 invoice allocation cannot spend security deposit money");
        }
        var nextBill = await Bill(account, new CreateInvoiceInput(PeriodStart: new DateTime(2027, 1, 1), PeriodEnd: new DateTime(2027, 2, 1)));
        await Reject(async () => { await Allocate(code, Allocation(firstBill.InvoiceId.Value, 50)); }, "A09 cannot allocate to a rolled-over invoice");
        await Allocate(code, Allocation(nextBill.InvoiceId!.Value, 250));
        using (var check = createContext())
        {
            var invoice = check.Invoices.Single(i => i.Id == nextBill.InvoiceId);
            Check(nextBill.PreviousDueBalance == 2025.40m && nextBill.TotalAmount == 4550.80m && invoice.DueAmount == 4300.80m && (await Read(code)).AvailableAmount == 0,
                "A10 rollover carries only unpaid debt; previously used advance is not applied twice");
        }

        var refundCode = await Create(100);
        await Collect(refundCode, Money(750, "Refund scenario receipt"));
        var refundAccount = await Activate(refundCode);
        var refundBill = await Bill(refundAccount);
        await Allocate(refundCode, Allocation(refundBill.InvoiceId!.Value, 500));
        await Close(refundAccount);
        await Reject(async () => { await Refund(refundCode, Money(251, "Over refund")); }, "A11 cannot refund already allocated advance");
        var refundInput = Money(250, "Return unused advance");
        await Refund(refundCode, refundInput); var refundRetry = await Refund(refundCode, refundInput);
        Check(refundRetry.AvailableAmount == 0 && refundRetry.RefundedAmount == 250 && refundRetry.AllocatedAmount == 500 && refundRetry.Transactions.Count == 3,
            "A12 unused refund/retry preserves applied credit and service debt");

        // A cash payment changes only PaidAmount/DueAmount while Status remains PartiallyPaid and PaidAt stays null.
        var cashCode = await Create(100); await Collect(cashCode, Money(750, "Cash race receipt"));
        var cashAccount = await Activate(cashCode); var cashBill = await Bill(cashAccount);
        using (var cash = createContext()) { var s = new EfNexusStore(cash); await new BillingService(s, s).PayAsync(cashAccount, new(100, OperationId: Guid.NewGuid().ToString()), actorId); }
        using (var stale = createContext())
        {
            var s = new EfNexusStore(stale); await s.FindAdvanceOrderAsync(OrderNumber.Parse(cashCode)!.Value);
            using (var cash = createContext()) { var c = new EfNexusStore(cash); await new BillingService(c, c).PayAsync(cashAccount, new(50, OperationId: Guid.NewGuid().ToString()), actorId); }
            await Reject(async () => { await new AdvanceService(s, s).AllocateAsync(cashCode, Allocation(cashBill.InvoiceId!.Value, 50), actorId); },
                "A13 stale advance allocation cannot overwrite concurrent partial cash payment");
        }
        using (var check = createContext())
            Check(check.Invoices.Single(i => i.Id == cashBill.InvoiceId).PaidAmount == 150 && (await Read(cashCode)).AllocatedAmount == 0 && (await Read(cashCode)).AvailableAmount == 750,
                "A14 failed allocation rolls back both credit consumption and invoice payment");

        var raceCode = await Create(100, 1);
        using (var stale = createContext())
        {
            var s = new EfNexusStore(stale); var order = (await s.FindAdvanceOrderAsync(OrderNumber.Parse(raceCode)!.Value))!;
            using (var writer = createContext()) { var w = new EfNexusStore(writer); await new OperationsService(w, w, new UnusedDocuments()).CancelOrderAsync(raceCode, new("Concurrent closure"), actorId); }
            await stale.Entry(order.Advance!).ReloadAsync();
            await Reject(async () => { await new AdvanceService(s, s).CollectAsync(raceCode, Money(100, "Stale lifecycle"), actorId); },
                "A15 stale order state plus refreshed credit version cannot accept cash after cancellation");
        }
        Check((await Read(raceCode)).ReceivedAmount == 0, "A16 cancelled receipt failure leaves zero advance credit");

        var optionalCode = await Create(100, 1);
        await Activate(optionalCode);
        Check((await Read(optionalCode)).ReceivedAmount == 0, "A17 optional advance does not add an activation prerequisite");
        var afterActivation = await Collect(optionalCode, Money(100, "Optional receipt after activation"));
        Check(afterActivation.AvailableAmount == 100, "A18 an open activated service can still receive its quoted optional advance");

        // Regression against a real migrated database: the account above has two invoices and two advance payments.
        async Task<BillingView> History()
        {
            using var context = createContext(); var store = new EfNexusStore(context);
            return await new BillingService(store, store).FindAsync(account);
        }
        async Task<BillingView> Pay(decimal amount, int collector, string channel, string note)
        {
            using var context = createContext(); var store = new EfNexusStore(context);
            return await new BillingService(store, store).PayAsync(account, new(amount, note, Guid.NewGuid().ToString()), collector, channel);
        }
        var before = await History();
        var originalIds = before.Payments!.Select(p => p.Id).ToArray();
        Check(before.Payments!.Count == 2 && before.Payments.Sum(p => p.Amount) == 750 &&
            before.Payments.Any(p => p.InvoiceId == firstBill.InvoiceId && p.InvoiceStatus == "RolledOver") && before.PaidAmount == 250,
            "H01 all-period history retains earlier advance payment without changing current-period paid amount");
        int cashierId, shopId;
        using (var setup = createContext())
        {
            var shop = new RetailShop { Code = "HISTORY-CHECK", Name = "History Check Outlet", CityCode = "101", Address = "Isolated test outlet", Phone = "0900000086" };
            var cashier = new Employee { Username = "history.cashier", DisplayName = "History Cashier", Role = Roles.Retail, PasswordHash = "isolated-test-no-login", RetailShop = shop };
            setup.Add(cashier); await setup.SaveChangesAsync(); cashierId = cashier.Id; shopId = shop.Id;
        }
        await Pay(40, cashierId, "RetailOutlet", "History receipt at outlet");
        var withOutlet = await History();
        var retailPayment = withOutlet.Payments!.Single(p => p.PaidByUsername == "history.cashier");
        Check(retailPayment.RetailShopId == shopId && retailPayment.RetailShopName == "History Check Outlet" &&
            retailPayment.PaidByDisplayName == "History Cashier" && retailPayment.ReceiptCode == $"PAY-{retailPayment.Id:D10}",
            "H02 history shows persisted collector, outlet and an internal code derived from the real payment ID");
        var thirdBill = await Bill(account, new CreateInvoiceInput(PeriodStart: new DateTime(2027, 3, 1), PeriodEnd: new DateTime(2027, 4, 1)));
        Check(thirdBill.PaidAmount == 0 && thirdBill.DueAmount == 6786.20m && thirdBill.Payments!.Count == 3 &&
            originalIds.All(id => thirdBill.Payments.Any(p => p.Id == id)),
            "H03 another rollover preserves original transaction IDs and carries only unpaid debt");
        await Pay(20, actorId, "CityOffice", "Office payment on third bill");
        await Pay(10, actorId, "CustomerPortal", "Portal-channel persistence check");
        var all = await History();
        Check(all.Payments!.Count == 5 && all.Payments.Sum(p => p.Amount) == 820 && all.PaidAmount == 30 && all.DueAmount == 6756.20m &&
            all.Payments.Select(p => p.Channel).Distinct().Count() == 4 && all.Payments.All(p => !string.IsNullOrWhiteSpace(p.InvoiceNumber) && p.PaidAt.Kind == DateTimeKind.Utc),
            "H04 four recorded channels across three periods; historical total does not overwrite current paid or due");
        using (var context = createContext())
        {
            var store = new EfNexusStore(context);
            var list = (await new BillingService(store, store).ListAsync(account, null, null)).Single();
            var owned = (await store.ListCustomerBillingOrdersAsync(customerId)).Single(o => o.Connection!.AccountId == account);
            var ownedPayments = owned.Connection!.Invoices.SelectMany(i => i.Payments).ToArray();
            Check(list.Payments!.Select(p => p.Id).SequenceEqual(all.Payments.Select(p => p.Id)) && ownedPayments.Length == 5 &&
                ownedPayments.Single(p => p.Id == retailPayment.Id).RetailShop!.Name == "History Check Outlet",
                "H05 staff listing and owner-scoped customer query load the same complete history including outlet");
            Check(all.Payments.Select(p => p.Id).Distinct().Count() == 5 &&
                context.Payments.Count(p => p.Invoice.ConnectionId == owned.Connection.Id) == 5 &&
                all.Payments.OrderByDescending(p => p.PaidAt).ThenByDescending(p => p.Id).Select(p => p.Id).SequenceEqual(all.Payments.Select(p => p.Id)),
                "H06 history is exactly saved transactions in stable newest-first order, without generated payments");
        }
        await Reject(async () => { await Pay(9999, cashierId, "RetailOutlet", "Exceeds debt"); }, "H07 overpayment is rejected rather than silently reducing the receipt amount");
        Check((await History()).Payments!.Count == 5, "H08 rejected payment adds no history");
        using (var stale = createContext())
        {
            var staleStore = new EfNexusStore(stale);
            var staleOrder = (await staleStore.FindOrderByAccountIdAsync(account))!;
            await staleStore.FindLatestInvoiceAsync(staleOrder.Connection!.Id);
            await Pay(6756.20m, actorId, "CityOffice", "Concurrent full settlement");
            await Reject(async () => { await new BillingService(staleStore, staleStore).PayAsync(account, new(1, "Stale receipt", Guid.NewGuid().ToString()), cashierId, "RetailOutlet"); },
                "H09 a competing full settlement cannot be reported as success for an unsaved receipt");
        }
        var settled = await History();
        Check(settled.Status == "Paid" && settled.Payments!.Count == 6 && settled.Payments.All(p => p.Note != "Stale receipt"),
            "H10 concurrency rolls back the losing payment and preserves full multi-period history");
        using (var legacyGap = createContext())
        {
            // Persist a historical data defect in this isolated database, with no receipt to invent or recover.
            var connectionId = (await new EfNexusStore(legacyGap).FindOrderByAccountIdAsync(account))!.Connection!.Id;
            legacyGap.Invoices.Add(new Invoice { ConnectionId = connectionId, InvoiceNumber = "HISTORY-GAP-CHECK",
                BillingPeriodStart = DateTime.UtcNow, BillingPeriodEnd = DateTime.UtcNow.AddMonths(1),
                TotalAmount = 12, PaidAmount = 12, DueAmount = 0, Status = "Paid", PaidAt = DateTime.UtcNow });
            await legacyGap.SaveChangesAsync();
        }
        var gap = await History();
        Check(gap.PaymentHistoryGaps!.Count == 1 && gap.PaymentHistoryGaps[0].InvoiceNumber == "HISTORY-GAP-CHECK" &&
            gap.PaymentHistoryGaps[0].RecordedPaidAmount == 12 && gap.PaymentHistoryGaps[0].RecordedPaymentTotal == 0,
            "H11 a legacy paid amount without receipts is explicitly flagged for reconciliation");
        Check(gap.Payments!.Count == 6 && gap.Payments.Select(p => p.Id).SequenceEqual(settled.Payments!.Select(p => p.Id)),
            "H12 reading an incomplete legacy history never creates a synthetic payment");
    }

    private sealed class UnusedDocuments : IDocumentStorage
    {
        public Task<StoredDocumentFile> SaveAsync(Stream content, string fileName, string? contentType, int year, string cityCode, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public bool Exists(string? path) => false;
        public Stream? OpenRead(string? path) => null;
        public Task DeleteAsync(string? path, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
