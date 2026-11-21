using Microsoft.AspNetCore.Diagnostics;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api;

/// <summary>Translates domain, application, and persistence exceptions into HTTP ProblemDetails responses.</summary>
public sealed class ApiExceptionHandler : IExceptionHandler
{
    /// <summary>Maps known application and database write conflicts to 400/401/403/404/409 responses.</summary>
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception switch
        {
            DomainRuleException { Failure: DomainRuleFailure.InvalidInput } => StatusCodes.Status400BadRequest,
            DomainRuleException { Failure: DomainRuleFailure.InvalidState } => StatusCodes.Status409Conflict,
            UseCaseException { Failure: UseCaseFailure.InvalidInput } => StatusCodes.Status400BadRequest,
            UseCaseException { Failure: UseCaseFailure.NotFound } => StatusCodes.Status404NotFound,
            UseCaseException { Failure: UseCaseFailure.Conflict } => StatusCodes.Status409Conflict,
            UseCaseException { Failure: UseCaseFailure.Unauthorized } => StatusCodes.Status401Unauthorized,
            UseCaseException { Failure: UseCaseFailure.Forbidden } => StatusCodes.Status403Forbidden,
            StoreWriteException => StatusCodes.Status409Conflict,
            _ => 0
        };
        if (status == 0) return false;

        var detail = exception switch
        {
            StoreWriteException { ConcurrentChange: true } =>
                "The record was modified by another request. Refresh and try again.",
            StoreWriteException =>
                "The changes could not be saved due to a data conflict.",
            _ => exception.Message
        };

        var response = status == StatusCodes.Status404NotFound
            ? Results.NotFound()
            : Results.Problem(detail, statusCode: status);
        await response.ExecuteAsync(context);
        return true;
    }
}
