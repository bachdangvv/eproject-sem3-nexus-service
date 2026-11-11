using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

public static class StaffEndpoints
{
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
    }

    private static async Task<IResult> Login(LoginInput input, StaffService service, HttpContext context)
    {
        var employee = await service.AuthenticateAsync(input);
        var identity = new ClaimsIdentity(
        [
            new(ClaimTypes.NameIdentifier, employee.Id.ToString()),
            new(ClaimTypes.Name, employee.Username),
            new(ClaimTypes.Role, employee.Role),
            new("displayName", employee.DisplayName)
        ], CookieAuthenticationDefaults.AuthenticationScheme);
        await context.SignInAsync(new ClaimsPrincipal(identity));
        return Results.NoContent();
    }
}
