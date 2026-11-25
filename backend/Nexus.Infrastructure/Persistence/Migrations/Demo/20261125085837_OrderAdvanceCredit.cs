using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexus.Infrastructure.Persistence.Migrations.Demo
{
    /// <inheritdoc />
    public partial class OrderAdvanceCredit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AdvancePerConnection",
                table: "Plans",
                type: "TEXT",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AdvanceAccounts",
                columns: table => new
                {
                    OrderId = table.Column<long>(type: "INTEGER", nullable: false),
                    PerConnectionAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: true),
                    GrossAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    DiscountPercent = table.Column<int>(type: "INTEGER", nullable: false),
                    QuotedAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    ReceivedAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    AllocatedAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    RefundedAmount = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false),
                    Origin = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Version = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdvanceAccounts", x => x.OrderId);
                    table.ForeignKey(
                        name: "FK_AdvanceAccounts_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AdvanceTransactions",
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
                    ActorId = table.Column<int>(type: "INTEGER", nullable: false),
                    RetailShopId = table.Column<int>(type: "INTEGER", nullable: true),
                    InvoiceId = table.Column<long>(type: "INTEGER", nullable: true),
                    PaymentId = table.Column<long>(type: "INTEGER", nullable: true),
                    AvailableAfter = table.Column<decimal>(type: "TEXT", precision: 12, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdvanceTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdvanceTransactions_AdvanceAccounts_OrderId",
                        column: x => x.OrderId,
                        principalTable: "AdvanceAccounts",
                        principalColumn: "OrderId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdvanceTransactions_Employees_ActorId",
                        column: x => x.ActorId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdvanceTransactions_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdvanceTransactions_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdvanceTransactions_RetailShops_RetailShopId",
                        column: x => x.RetailShopId,
                        principalTable: "RetailShops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdvanceTransactions_ActorId",
                table: "AdvanceTransactions",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_AdvanceTransactions_InvoiceId",
                table: "AdvanceTransactions",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_AdvanceTransactions_OperationId",
                table: "AdvanceTransactions",
                column: "OperationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdvanceTransactions_OrderId_Kind_Reference",
                table: "AdvanceTransactions",
                columns: new[] { "OrderId", "Kind", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdvanceTransactions_PaymentId",
                table: "AdvanceTransactions",
                column: "PaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdvanceTransactions_RetailShopId",
                table: "AdvanceTransactions",
                column: "RetailShopId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdvanceTransactions");

            migrationBuilder.DropTable(
                name: "AdvanceAccounts");

            migrationBuilder.DropColumn(
                name: "AdvancePerConnection",
                table: "Plans");
        }
    }
}
