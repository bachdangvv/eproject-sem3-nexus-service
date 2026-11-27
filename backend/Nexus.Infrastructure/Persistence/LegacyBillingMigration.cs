using Microsoft.EntityFrameworkCore.Migrations;

namespace Nexus.Infrastructure.Persistence;

/// <summary>Preserve Review 1 billing evidence without recalculating old charges or inventing a billing period.</summary>
internal static class LegacyBillingMigration
{
    public static void Restore(MigrationBuilder migration)
    {
        // Databases upgraded before the import fix do not have an archive to rename back.
        if (migration.ActiveProvider == "Microsoft.EntityFrameworkCore.Sqlite")
            migration.Sql("""
                CREATE TABLE IF NOT EXISTS LegacyBillingRecords (
                    ConnectionId INTEGER NOT NULL PRIMARY KEY,
                    Amount TEXT NOT NULL, PaidAt TEXT NULL, PaidById INTEGER NULL,
                    FOREIGN KEY (ConnectionId) REFERENCES Connections (Id) ON DELETE RESTRICT,
                    FOREIGN KEY (PaidById) REFERENCES Employees (Id) ON DELETE RESTRICT
                );
                CREATE INDEX IF NOT EXISTS IX_BillingRecords_PaidById ON LegacyBillingRecords (PaidById);
                """);
        else
            migration.Sql("""
                IF OBJECT_ID(N'LegacyBillingRecords', N'U') IS NULL
                BEGIN
                    CREATE TABLE LegacyBillingRecords (
                        ConnectionId bigint NOT NULL CONSTRAINT PK_BillingRecords PRIMARY KEY,
                        Amount decimal(12,2) NOT NULL, PaidAt datetime2 NULL, PaidById int NULL,
                        CONSTRAINT FK_BillingRecords_Connections_ConnectionId FOREIGN KEY (ConnectionId) REFERENCES Connections (Id),
                        CONSTRAINT FK_BillingRecords_Employees_PaidById FOREIGN KEY (PaidById) REFERENCES Employees (Id)
                    );
                    CREATE INDEX IX_BillingRecords_PaidById ON LegacyBillingRecords (PaidById);
                END;
                """);
        migration.RenameTable(name: "LegacyBillingRecords", newName: "BillingRecords");
    }

    public static void Import(MigrationBuilder migration)
    {
        var sqlite = migration.ActiveProvider == "Microsoft.EntityFrameworkCore.Sqlite";
        var account = sqlite
            ? "c.Type || c.CityCode || printf('%012d', c.Id)"
            : "c.Type + c.CityCode + RIGHT('000000000000' + CAST(c.Id AS varchar(12)), 12)";
        // Legacy billing had no period, tax breakdown or receipt number. Equal period boundaries
        // explicitly mean unknown; the original table remains available for reconciliation.
        migration.Sql($"""
            INSERT INTO Invoices
              (ConnectionId, InvoiceNumber, BillingPeriodStart, BillingPeriodEnd,
               RentalAmount, LocalMinutes, StdMinutes, MobileMinutes, CallUsageAmount,
               EquipmentFee, Subtotal, DiscountAmount, DiscountPercent, TaxRate, TaxAmount,
               DepositAmount, PreviousDueBalance, TotalAmount, PaidAmount, DueAmount,
               Status, CreatedAt, PaidAt, PaidById)
            SELECT b.ConnectionId, {(sqlite ? "'LEGACY-' || " : "'LEGACY-' + ")}{account},
               c.ActivatedAt, c.ActivatedAt,
               b.Amount, 0, 0, 0, 0, 0, b.Amount, 0, 0, 0, 0, 0, 0, b.Amount,
               CASE WHEN b.PaidAt IS NOT NULL THEN b.Amount ELSE 0 END,
               CASE WHEN b.PaidAt IS NULL THEN b.Amount ELSE 0 END,
               CASE WHEN b.PaidAt IS NOT NULL THEN 'Paid' ELSE 'Unpaid' END,
               c.ActivatedAt, b.PaidAt, b.PaidById
            FROM LegacyBillingRecords b JOIN Connections c ON c.Id = b.ConnectionId;
            """);
        // A recorded full settlement with its collector is existing evidence. Missing collectors
        // remain paymentHistoryGaps instead of assigning an arbitrary employee to old money.
        migration.Sql("""
            INSERT INTO Payments (InvoiceId, Amount, PaidAt, PaidById, Channel, Note)
            SELECT i.Id, b.Amount, b.PaidAt, b.PaidById, 'LegacyBilling',
                   'Imported Review 1 full settlement; no new money received.'
            FROM LegacyBillingRecords b JOIN Invoices i ON i.ConnectionId = b.ConnectionId
            WHERE b.PaidAt IS NOT NULL AND b.PaidById IS NOT NULL;
            """);
        migration.Sql("""
            UPDATE Requests SET ConnectionCount = 1;
            UPDATE Requests SET SnapshotPrice = (SELECT Price FROM Plans WHERE Plans.Id = Requests.PlanId);
            """);
    }
}
