using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexus.Infrastructure.Persistence.Migrations.Demo
{
    /// <inheritdoc />
    public partial class OrderDepositLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SecurityDeposits",
                columns: table => new
                {
                    OrderId = table.Column<long>(type: "INTEGER", nullable: false),
                    GrossAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    DiscountPercent = table.Column<int>(type: "INTEGER", nullable: false),
                    RequiredAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    CollectedAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    RefundedAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    NeedsReconciliation = table.Column<bool>(type: "INTEGER", nullable: false),
                    Origin = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Version = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityDeposits", x => x.OrderId);
                    table.ForeignKey(
                        name: "FK_SecurityDeposits_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DepositTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OrderId = table.Column<long>(type: "INTEGER", nullable: false),
                    OperationId = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Kind = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    Reference = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Note = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    At = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ActorId = table.Column<int>(type: "INTEGER", nullable: true),
                    RetailShopId = table.Column<int>(type: "INTEGER", nullable: true),
                    SourceInvoiceId = table.Column<long>(type: "INTEGER", nullable: true),
                    CollectedAfter = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    RefundedAfter = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepositTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepositTransactions_Employees_ActorId",
                        column: x => x.ActorId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DepositTransactions_Invoices_SourceInvoiceId",
                        column: x => x.SourceInvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DepositTransactions_RetailShops_RetailShopId",
                        column: x => x.RetailShopId,
                        principalTable: "RetailShops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DepositTransactions_SecurityDeposits_OrderId",
                        column: x => x.OrderId,
                        principalTable: "SecurityDeposits",
                        principalColumn: "OrderId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DepositTransactions_ActorId",
                table: "DepositTransactions",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_DepositTransactions_OperationId",
                table: "DepositTransactions",
                column: "OperationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DepositTransactions_OrderId_Kind_Reference",
                table: "DepositTransactions",
                columns: new[] { "OrderId", "Kind", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DepositTransactions_RetailShopId",
                table: "DepositTransactions",
                column: "RetailShopId");

            migrationBuilder.CreateIndex(
                name: "IX_DepositTransactions_SourceInvoiceId",
                table: "DepositTransactions",
                column: "SourceInvoiceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DepositTransactions");

            migrationBuilder.DropTable(
                name: "SecurityDeposits");
        }
    }
}
