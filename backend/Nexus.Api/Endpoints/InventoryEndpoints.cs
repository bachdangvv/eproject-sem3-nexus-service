using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

/// <summary>Minimal API endpoints for retail shops, vendors, purchase orders, vendor payments, and technical equipment.</summary>
public static class InventoryEndpoints
{
    /// <summary>Maps retail shop, vendor, procurement, and technical equipment/incident endpoints.</summary>
    public static void MapInventory(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Admin));
        var technicalOrAdmin = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Technical, Roles.Admin));
        var technical = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Technical));

        // Retail shops lookup (authenticated for staff)
        api.MapGet("/retail-shops", (string? cityCode, InventoryService service) =>
            service.RetailShopsAsync(cityCode, false)).RequireAuthorization(policy => policy.RequireRole(Roles.Staff));

        // Admin Retail shops CRUD
        admin.MapGet("/admin/retail-shops", (string? cityCode, InventoryService service) =>
            service.RetailShopsAsync(cityCode, true));
        admin.MapPost("/admin/retail-shops", async (RetailShopInput input, InventoryService service) =>
            Results.Json(await service.CreateRetailShopAsync(input), statusCode: 201));
        admin.MapPut("/admin/retail-shops/{id:int}", async (int id, RetailShopInput input, InventoryService service) =>
            Results.Ok(await service.UpdateRetailShopAsync(id, input)));
        admin.MapDelete("/admin/retail-shops/{id:int}", async (int id, InventoryService service) =>
        {
            await service.ArchiveRetailShopAsync(id);
            return Results.NoContent();
        });

        // Admin Vendors CRUD
        admin.MapGet("/admin/vendors", (InventoryService service) =>
            service.VendorsAsync(true));
        admin.MapPost("/admin/vendors", async (VendorInput input, InventoryService service) =>
            Results.Json(await service.CreateVendorAsync(input), statusCode: 201));
        admin.MapPut("/admin/vendors/{id:int}", async (int id, VendorInput input, InventoryService service) =>
            Results.Ok(await service.UpdateVendorAsync(id, input)));
        admin.MapDelete("/admin/vendors/{id:int}", async (int id, InventoryService service) =>
        {
            await service.ArchiveVendorAsync(id);
            return Results.NoContent();
        });

        // Admin Purchases & Payments
        admin.MapGet("/admin/purchases", (string? status, InventoryService service) =>
            service.PurchaseOrdersAsync(status));
        admin.MapPost("/admin/purchases", async (PurchaseOrderInput input, InventoryService service) =>
            Results.Json(await service.CreatePurchaseOrderAsync(input), statusCode: 201));
        admin.MapPost("/admin/purchases/{id:int}/receive", async (int id, InventoryService service) =>
            Results.Ok(await service.ReceivePurchaseOrderAsync(id)));
        admin.MapPost("/admin/purchases/{id:int}/cancel", async (int id, InventoryService service) =>
            Results.Ok(await service.CancelPurchaseOrderAsync(id)));

        admin.MapGet("/admin/vendor-payments", (int? purchaseOrderId, InventoryService service) =>
            service.VendorPaymentsAsync(purchaseOrderId));
        admin.MapPost("/admin/vendor-payments", async (VendorPaymentInput input, InventoryService service) =>
            Results.Json(await service.CreateVendorPaymentAsync(input), statusCode: 201));

        // Technical Equipment Overview & Incidents
        technicalOrAdmin.MapGet("/technical/equipment", (InventoryService service) =>
            service.EquipmentStockAsync());
        technicalOrAdmin.MapGet("/technical/equipment/summary", (InventoryService service) =>
            service.EquipmentSummaryAsync());
        technicalOrAdmin.MapGet("/technical/incidents", (bool? settled, InventoryService service) =>
            service.IncidentsAsync(settled));

        technical.MapPost("/technical/incidents", async (EquipmentIncidentInput input, InventoryService service, ClaimsPrincipal actor) =>
            Results.Json(await service.RecordIncidentAsync(input, EndpointHelpers.ActorId(actor)), statusCode: 201));
    }
}
