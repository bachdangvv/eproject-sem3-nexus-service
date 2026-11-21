using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

/// <summary>Minimal API endpoints for cookie authentication and Admin staff lifecycle management.</summary>
public static class StaffEndpoints
{
    /// <summary>Maps login, logout, and Admin employee CRUD and soft-deactivation endpoints.</summary>
    public static void MapStaff(this RouteGroupBuilder api)
    {
        api.MapPost("/login", Login).RequireRateLimiting("login");
        api.MapPost("/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        var users = api.MapGroup("/employees").RequireAuthorization(policy => policy.RequireRole(Roles.Admin));
        users.MapGet("", (StaffService service) => service.EmployeesAsync());
        users.MapPost("", async (EmployeeInput input, StaffService service) =>
            Results.Json(await service.CreateAsync(input), statusCode: 201));
        users.MapPut("/{id:int}", (int id, EmployeeUpdateInput input, StaffService service, ClaimsPrincipal actor) =>
            service.UpdateAsync(id, input, EndpointHelpers.ActorId(actor)));
        users.MapDelete("/{id:int}", async (int id, StaffService service, ClaimsPrincipal actor) =>
            Results.Ok(await service.DeactivateAsync(id, EndpointHelpers.ActorId(actor))));
    }

    private static async Task<IResult> Login(LoginInput input, StaffService service, HttpContext context)
    {
        var employee = await service.AuthenticateAsync(input);
        await SignInUserAsync(context, employee);
        return Results.NoContent();
    }

    internal static async Task SignInUserAsync(HttpContext context, EmployeeView employee)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, employee.Id.ToString(CultureInfo.InvariantCulture)),
            new(ClaimTypes.Name, employee.Username),
            new(ClaimTypes.Role, employee.Role),
            new("displayName", employee.DisplayName)
        };
        if (employee.CustomerId is int cid)
        {
            claims.Add(new("customerId", cid.ToString(CultureInfo.InvariantCulture)));
            claims.Add(new("customerCode", $"CUS-{cid:D6}"));
        }

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await context.SignInAsync(new ClaimsPrincipal(identity));
    }
}
