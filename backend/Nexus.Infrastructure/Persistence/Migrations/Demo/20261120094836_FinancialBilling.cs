using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexus.Infrastructure.Persistence.Migrations.Demo
{
    /// <inheritdoc />
    public partial class FinancialBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(name: "BillingRecords", newName: "LegacyBillingRecords");

            migrationBuilder.AddColumn<int>(
                name: "ConnectionCount",
                table: "Requests",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "SnapshotPrice",
                table: "Requests",
                type: "TEXT",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LocalCallRate",
                table: "Plans",
                type: "TEXT",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MobileMsgRate",
                table: "Plans",
                type: "TEXT",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "StdCallRate",
                table: "Plans",
                type: "TEXT",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ConnectionId = table.Column<long>(type: "INTEGER", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "TEXT", maxLength: 60, nullable: false),
                    BillingPeriodStart = table.Column<DateTime>(type: "TEXT", nullable: false),
                    BillingPeriodEnd = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RentalAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    LocalMinutes = table.Column<decimal>(type: "TEXT", precision: 10, scale: 2, nullable: false),
                    StdMinutes = table.Column<decimal>(type: "TEXT", precision: 10, scale: 2, nullable: false),
                    MobileMinutes = table.Column<decimal>(type: "TEXT", precision: 10, scale: 2, nullable: false),
                    CallUsageAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    EquipmentFee = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    Subtotal = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    DiscountPercent = table.Column<int>(type: "INTEGER", nullable: false),
                    TaxRate = table.Column<decimal>(type: "TEXT", precision: 6, scale: 4, nullable: false),
                    TaxAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    DepositAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    PreviousDueBalance = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    PaidAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    DueAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    PaidById = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invoices_Connections_ConnectionId",
                        column: x => x.ConnectionId,
                        principalTable: "Connections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Invoices_Employees_PaidById",
                        column: x => x.PaidById,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    InvoiceId = table.Column<long>(type: "INTEGER", nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    PaidAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PaidById = table.Column<int>(type: "INTEGER", nullable: false),
                    Channel = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    Note = table.Column<string>(type: "TEXT", maxLength: 250, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Payments_Employees_PaidById",
                        column: x => x.PaidById,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_ConnectionId",
                table: "Invoices",
                column: "ConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_PaidById",
                table: "Invoices",
                column: "PaidById");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_InvoiceId",
                table: "Payments",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaidById",
                table: "Payments",
                column: "PaidById");

            LegacyBillingMigration.Import(migrationBuilder);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "Invoices");

            migrationBuilder.DropColumn(
                name: "ConnectionCount",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "SnapshotPrice",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "LocalCallRate",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "MobileMsgRate",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "StdCallRate",
                table: "Plans");

            LegacyBillingMigration.Restore(migrationBuilder);
        }
    }
}
