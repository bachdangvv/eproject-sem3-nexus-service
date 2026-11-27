using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexus.Infrastructure.Persistence.Migrations.SqlServer
{
    /// <inheritdoc />
    public partial class BillingRetrySafety : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OperationId",
                table: "Payments",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestFingerprint",
                table: "Payments",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "BillingVersion",
                table: "Connections",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OperationId",
                table: "Payments",
                column: "OperationId",
                unique: true,
                filter: "[OperationId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_OperationId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "OperationId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "RequestFingerprint",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "BillingVersion",
                table: "Connections");
        }
    }
}
