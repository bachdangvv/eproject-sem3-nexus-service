using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexus.Infrastructure.Persistence.Migrations.Demo
{
    /// <inheritdoc />
    public partial class RemediationSchemaUpdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RetailShopId",
                table: "Requests",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HoursAllowance",
                table: "Plans",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SpeedKbps",
                table: "Plans",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ValidityMonths",
                table: "Plans",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "RequestedById",
                table: "PlanChangeRequests",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetailShopId",
                table: "Payments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatedById",
                table: "Invoices",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Active",
                table: "Employees",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "RetailShopId",
                table: "Employees",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosedAt",
                table: "CustomerQueries",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ClosedById",
                table: "CustomerQueries",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatedById",
                table: "CustomerQueries",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundNote",
                table: "Connections",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundedAt",
                table: "Connections",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RefundedById",
                table: "Connections",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Requests_RetailShopId",
                table: "Requests",
                column: "RetailShopId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Plans_ValidityMonths",
                table: "Plans",
                sql: "ValidityMonths IN (1, 3, 6, 12)");

            migrationBuilder.CreateIndex(
                name: "IX_PlanChangeRequests_RequestedById",
                table: "PlanChangeRequests",
                column: "RequestedById");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_RetailShopId",
                table: "Payments",
                column: "RetailShopId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CreatedById",
                table: "Invoices",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_RetailShopId",
                table: "Employees",
                column: "RetailShopId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQueries_ClosedById",
                table: "CustomerQueries",
                column: "ClosedById");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerQueries_CreatedById",
                table: "CustomerQueries",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Connections_RefundedById",
                table: "Connections",
                column: "RefundedById");

            migrationBuilder.AddForeignKey(
                name: "FK_Connections_Employees_RefundedById",
                table: "Connections",
                column: "RefundedById",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerQueries_Employees_ClosedById",
                table: "CustomerQueries",
                column: "ClosedById",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerQueries_Employees_CreatedById",
                table: "CustomerQueries",
                column: "CreatedById",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_RetailShops_RetailShopId",
                table: "Employees",
                column: "RetailShopId",
                principalTable: "RetailShops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Employees_CreatedById",
                table: "Invoices",
                column: "CreatedById",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_RetailShops_RetailShopId",
                table: "Payments",
                column: "RetailShopId",
                principalTable: "RetailShops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanChangeRequests_Employees_RequestedById",
                table: "PlanChangeRequests",
                column: "RequestedById",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_RetailShops_RetailShopId",
                table: "Requests",
                column: "RetailShopId",
                principalTable: "RetailShops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Connections_Employees_RefundedById",
                table: "Connections");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomerQueries_Employees_ClosedById",
                table: "CustomerQueries");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomerQueries_Employees_CreatedById",
                table: "CustomerQueries");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_RetailShops_RetailShopId",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Employees_CreatedById",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_RetailShops_RetailShopId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_PlanChangeRequests_Employees_RequestedById",
                table: "PlanChangeRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_Requests_RetailShops_RetailShopId",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_RetailShopId",
                table: "Requests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Plans_ValidityMonths",
                table: "Plans");

            migrationBuilder.DropIndex(
                name: "IX_PlanChangeRequests_RequestedById",
                table: "PlanChangeRequests");

            migrationBuilder.DropIndex(
                name: "IX_Payments_RetailShopId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_CreatedById",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_InvoiceNumber",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Employees_RetailShopId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQueries_ClosedById",
                table: "CustomerQueries");

            migrationBuilder.DropIndex(
                name: "IX_CustomerQueries_CreatedById",
                table: "CustomerQueries");

            migrationBuilder.DropIndex(
                name: "IX_Connections_RefundedById",
                table: "Connections");

            migrationBuilder.DropColumn(
                name: "RetailShopId",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "HoursAllowance",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "SpeedKbps",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "ValidityMonths",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "RequestedById",
                table: "PlanChangeRequests");

            migrationBuilder.DropColumn(
                name: "RetailShopId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Active",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "RetailShopId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ClosedAt",
                table: "CustomerQueries");

            migrationBuilder.DropColumn(
                name: "ClosedById",
                table: "CustomerQueries");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "CustomerQueries");

            migrationBuilder.DropColumn(
                name: "RefundNote",
                table: "Connections");

            migrationBuilder.DropColumn(
                name: "RefundedAt",
                table: "Connections");

            migrationBuilder.DropColumn(
                name: "RefundedById",
                table: "Connections");
        }
    }
}
