using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Nexus.Application;

namespace Nexus.Api.Endpoints;

/// <summary>Shared Minimal API endpoint utilities for actor claims extraction and optional JSON binding.</summary>
public static class EndpointHelpers
{
    /// <summary>Extracts the authenticated employee ID from the NameIdentifier claim.</summary>
    public static int ActorId(ClaimsPrincipal actor) =>
        int.TryParse(actor.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.None, CultureInfo.InvariantCulture, out var id) && id > 0
            ? id
            : throw new UseCaseException(UseCaseFailure.Unauthorized, "Authenticated session required.");

    /// <summary>Extracts the authenticated customer ID from the customerId claim.</summary>
    public static int CustomerId(ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue("customerId"), NumberStyles.None, CultureInfo.InvariantCulture, out var id) && id > 0
            ? id
            : throw new UseCaseException(UseCaseFailure.Unauthorized, "Customer session required.");

    /// <summary>Reads and DataAnnotation-validates an optional JSON body (supporting empty or chunked requests).</summary>
    public static async Task<(bool Success, T? Value, IResult? Error)> TryReadOptionalJsonAsync<T>(
        HttpContext httpContext,
        CancellationToken cancellationToken) where T : class
    {
        if (!httpContext.Request.HasJsonContentType())
            return (true, null, null);

        if (httpContext.Request.ContentLength == 0)
            return (true, null, null);

        string raw;
        try
        {
            using var reader = new StreamReader(httpContext.Request.Body, leaveOpen: true);
            raw = await reader.ReadToEndAsync(cancellationToken);
        }
        catch (BadHttpRequestException)
        {
            return (false, null, Results.Problem("Invalid request payload.", statusCode: 400));
        }
        catch (IOException) when (!cancellationToken.IsCancellationRequested)
        {
            return (false, null, Results.Problem("Invalid or incomplete request payload.", statusCode: 400));
        }

        if (string.IsNullOrWhiteSpace(raw))
            return (true, null, null);

        T? value;
        try
        {
            var jsonOptions = httpContext.RequestServices
                .GetRequiredService<IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>>()
                .Value.SerializerOptions;
            value = JsonSerializer.Deserialize<T>(raw, jsonOptions);
        }
        catch (JsonException)
        {
            return (false, null, Results.Problem("Invalid JSON request payload.", statusCode: 400));
        }

        if (value is null)
            return (true, null, null);

        var validationResults = new List<ValidationResult>();
        if (!Validator.TryValidateObject(value, new ValidationContext(value), validationResults, validateAllProperties: true))
        {
            var errors = validationResults
                .SelectMany(result => (result.MemberNames.Any() ? result.MemberNames : [""])
                    .Select(member => new { member, error = result.ErrorMessage ?? "Invalid value." }))
                .GroupBy(x => x.member)
                .ToDictionary(g => g.Key, g => g.Select(x => x.error).ToArray());
            return (false, null, Results.ValidationProblem(errors));
        }

        return (true, value, null);
    }
}
