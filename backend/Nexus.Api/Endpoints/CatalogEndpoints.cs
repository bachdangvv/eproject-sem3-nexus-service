using System.Security.Claims;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

/// <summary>Minimal API endpoints for cities, service plans, and equipment product catalog.</summary>
public static class CatalogEndpoints
{
    /// <summary>Maps authenticated catalog reads and Admin/Technical write routes.</summary>
    public static void MapCatalog(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Admin));
        var technicalOrAdmin = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Admin, Roles.Technical));
        api.MapGet("/cities", (CatalogService service) => service.CitiesAsync()).RequireAuthorization();
        api.MapGet("/plans", (CatalogService service, ClaimsPrincipal user) =>
            service.PlansAsync(user.IsInRole(Roles.Admin))).RequireAuthorization();

        admin.MapPost("/cities", async (CityInput input, CatalogService service) =>
            Results.Json(await service.CreateCityAsync(input), statusCode: 201));
        admin.MapPut("/cities/{code}", (string code, CityUpdateInput input, CatalogService service) =>
            service.UpdateCityAsync(code, input));
        admin.MapPost("/plans", async (PlanInput input, CatalogService service) =>
            Results.Json(await service.CreatePlanAsync(input), statusCode: 201));
        admin.MapPut("/plans/{id:int}", (int id, PlanInput input, CatalogService service) =>
            service.UpdatePlanAsync(id, input));
        admin.MapDelete("/plans/{id:int}", async (int id, CatalogService service) =>
        {
            await service.ArchivePlanAsync(id);
            return Results.NoContent();
        });

        technicalOrAdmin.MapGet("/products", (CatalogService service) => service.ProductsAsync());
        technicalOrAdmin.MapPost("/products", async (ProductInput input, CatalogService service) =>
            Results.Json(await service.CreateProductAsync(input), statusCode: 201));
        technicalOrAdmin.MapPut("/products/{id:int}", (int id, ProductInput input, CatalogService service) =>
            service.UpdateProductAsync(id, input));
        admin.MapDelete("/products/{id:int}", async (int id, CatalogService service) =>
        {
            await service.ArchiveProductAsync(id);
            return Results.NoContent();
        });
    }
}
