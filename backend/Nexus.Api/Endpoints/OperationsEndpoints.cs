using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.Net.Http.Headers;
using Nexus.Application;
using Nexus.Domain;

namespace Nexus.Api.Endpoints;

/// <summary>Minimal API endpoints for customer onboarding, order lifecycle, documents, plan changes, and queries.</summary>
public static class OperationsEndpoints
{
    /// <summary>Maps customer, request, order, connection lifecycle, document, plan-change, and FAQ/query routes.</summary>
    public static void MapOperations(this RouteGroupBuilder api)
    {
        var retail = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Retail));
        var customers = api.MapGroup("/customers")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Retail, Roles.Admin));
        var operations = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Retail, Roles.Technical));
        var technical = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Technical));
        var staffAll = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Retail, Roles.Technical, Roles.Admin));
        var staffRetailAdmin = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Retail, Roles.Admin));
        var staffAdminTech = api.MapGroup("").RequireAuthorization(policy => policy.RequireRole(Roles.Admin, Roles.Technical));

        customers.MapGet("", (string? q, OperationsService service) => service.CustomersAsync(q));
        customers.MapPost("", async (CustomerInput input, OperationsService service) =>
            Results.Json(await service.CreateCustomerAsync(input), statusCode: 201));
        customers.MapPut("/{id:int}", (int id, CustomerInput input, OperationsService service) =>
            service.UpdateCustomerAsync(id, input));
        retail.MapGet("/requests", (OperationsService service) => service.PendingRequestsAsync());
        retail.MapPost("/requests", async (RequestInput input, OperationsService service, ClaimsPrincipal actor) =>
            Results.Json(await service.CreateRequestAsync(input, ActorId(actor)), statusCode: 201));
        retail.MapPost("/requests/{id:int}/confirm", async (int id, OperationsService service, ClaimsPrincipal actor) =>
            CreatedOrExisting(await service.ConfirmAsync(id, ActorId(actor))));
        retail.MapPost("/orders/{code}/feedback", async (string code, FeedbackInput input, OperationsService service, ClaimsPrincipal actor) =>
            Results.Json(await service.RecordFeedbackAsync(code, input, ActorId(actor)), statusCode: 201));

        operations.MapGet("/orders", (string? code, string? status, OperationsService service) => service.OrdersAsync(code, status));
        operations.MapGet("/orders/{code}", (string code, OperationsService service) => service.DetailAsync(code));

        technical.MapPost("/orders/{code}/assessment", (string code, AssessmentInput input, OperationsService service, ClaimsPrincipal actor) =>
            service.AssessAsync(code, input, ActorId(actor)));
        technical.MapPost("/orders/{code}/connection", async (string code, HttpContext httpContext, OperationsService service, ClaimsPrincipal actor, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<ConnectInput>(httpContext, cancellationToken);
            if (!ok) return error!;
            return CreatedOrExisting(await service.ConnectAsync(code, input?.ProductId, ActorId(actor)));
        });

        // --- Group 3.1: Connection Lifecycle & 5-Criteria Search ---
        staffAll.MapGet("/connections", (
            string? q,
            string? code,
            string? customerName,
            string? serviceType,
            string? phone,
            string? fromDate,
            string? toDate,
            string? status,
            string? cityCode,
            OperationsService service) =>
            service.ConnectionsAsync(q, code, customerName, serviceType, phone, fromDate, toDate, status, cityCode));
        staffAll.MapGet("/connections/{accountId}", (string accountId, OperationsService service) =>
            service.ConnectionDetailAsync(accountId));

        technical.MapPost("/technical/connections/{accountId}/suspend", (string accountId, SuspendConnectionInput input, OperationsService service, ClaimsPrincipal actor) =>
            service.SuspendConnectionAsync(accountId, input, ActorId(actor)));
        technical.MapPost("/technical/connections/{accountId}/reactivate", (string accountId, OperationsService service, ClaimsPrincipal actor) =>
            service.ReactivateConnectionAsync(accountId, ActorId(actor)));
        technical.MapPost("/technical/connections/{accountId}/terminate", async (string accountId, HttpContext httpContext, OperationsService service, ClaimsPrincipal actor, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<TerminateConnectionInput>(httpContext, cancellationToken);
            if (!ok) return error!;
            return Results.Ok(await service.TerminateConnectionAsync(accountId, input, ActorId(actor)));
        });

        // --- Group 3.2: 5-Criteria Advanced Search ---
        staffAll.MapGet("/orders/search", (string? code, string? customerName, string? serviceType, string? phone, string? fromDate, string? toDate, string? status, OperationsService service) =>
            service.SearchOrdersAsync(code, customerName, serviceType, phone, fromDate, toDate, status));

        // --- Group 4.1: Customer Document Archival ---
        staffRetailAdmin.MapGet("/documents", (int? year, string? cityCode, int? customerId, string? documentType, OperationsService service) =>
            service.DocumentsAsync(year, cityCode, customerId, documentType));
        staffRetailAdmin.MapPost("/documents", async (HttpContext httpContext, OperationsService service, ClaimsPrincipal actor, CancellationToken cancellationToken) =>
        {
            if (httpContext.Request.HasFormContentType)
            {
                IFormCollection form;
                try
                {
                    form = await httpContext.Request.ReadFormAsync(cancellationToken);
                }
                catch (InvalidDataException)
                {
                    return Results.Problem("Invalid or oversized multipart form payload.", statusCode: 400);
                }
                catch (BadHttpRequestException)
                {
                    return Results.Problem("Invalid multipart form payload.", statusCode: 400);
                }
                catch (IOException) when (!cancellationToken.IsCancellationRequested)
                {
                    return Results.Problem("Invalid or incomplete multipart form payload.", statusCode: 400);
                }

                var file = form.Files.GetFile("file");
                if (file is null)
                    return Results.Problem("A document file is required.", statusCode: 400);

                if (!int.TryParse(form["customerId"].ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var customerId))
                    return Results.Problem("A valid customerId is required.", statusCode: 400);

                if (!int.TryParse(form["year"].ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var year))
                    return Results.Problem("A valid year is required.", statusCode: 400);

                var documentType = form["documentType"].ToString();
                var title = form["title"].ToString();
                var cityCode = form["cityCode"].ToString();

                await using var stream = file.OpenReadStream();
                var uploadRequest = new DocumentUploadRequest(
                    customerId,
                    documentType,
                    title,
                    year,
                    cityCode,
                    stream,
                    file.FileName,
                    file.ContentType,
                    file.Length);

                var created = await service.UploadDocumentAsync(uploadRequest, ActorId(actor), cancellationToken);
                return Results.Json(created, statusCode: 201);
            }

            if (httpContext.Request.HasJsonContentType())
            {
                CustomerDocumentInput? input;
                try
                {
                    input = await httpContext.Request.ReadFromJsonAsync<CustomerDocumentInput>(cancellationToken);
                }
                catch (JsonException)
                {
                    return Results.Problem("Invalid JSON payload.", statusCode: 400);
                }
                catch (BadHttpRequestException)
                {
                    return Results.Problem("Invalid request payload.", statusCode: 400);
                }
                catch (IOException) when (!cancellationToken.IsCancellationRequested)
                {
                    return Results.Problem("Invalid or incomplete JSON payload.", statusCode: 400);
                }

                if (input is null)
                    return Results.Problem("Request body is required.", statusCode: 400);

                var validationResults = new List<ValidationResult>();
                if (!Validator.TryValidateObject(input, new ValidationContext(input), validationResults, validateAllProperties: true))
                {
                    var errors = validationResults
                        .SelectMany(result => (result.MemberNames.Any() ? result.MemberNames : [""]).Select(member => new { member, error = result.ErrorMessage ?? "Invalid value." }))
                        .GroupBy(x => x.member)
                        .ToDictionary(g => g.Key, g => g.Select(x => x.error).ToArray());
                    return Results.ValidationProblem(errors);
                }

                var created = await service.RecordDocumentAsync(input, ActorId(actor));
                return Results.Json(created, statusCode: 201);
            }

            return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
        });
        staffRetailAdmin.MapGet("/documents/{id:int}/download", async (int id, bool? inline, HttpContext httpContext, OperationsService service) =>
        {
            var download = await service.OpenDocumentDownloadAsync(id);
            httpContext.Response.Headers.XContentTypeOptions = "nosniff";
            if (inline == true)
            {
                var disposition = new ContentDispositionHeaderValue("inline");
                disposition.SetHttpFileName(download.DownloadFileName);
                httpContext.Response.Headers.ContentDisposition = disposition.ToString();
                return Results.File(download.Stream, download.ContentType);
            }

            return Results.File(download.Stream, download.ContentType, fileDownloadName: download.DownloadFileName);
        });

        // --- Group 4.2: Plan Change Requests ---
        staffAll.MapGet("/plan-changes", (string? status, long? connectionId, OperationsService service) =>
            service.PlanChangesAsync(status, connectionId));
        staffRetailAdmin.MapPost("/plan-changes", async (PlanChangeRequestInput input, OperationsService service, ClaimsPrincipal actor) =>
            Results.Json(await service.SubmitPlanChangeAsync(input, ActorId(actor)), statusCode: 201));
        staffAdminTech.MapPost("/plan-changes/{id:int}/approve", (int id, OperationsService service, ClaimsPrincipal actor) =>
            service.ApprovePlanChangeAsync(id, ActorId(actor)));
        staffAdminTech.MapPost("/plan-changes/{id:int}/reject", async (int id, HttpContext httpContext, OperationsService service, ClaimsPrincipal actor, CancellationToken cancellationToken) =>
        {
            var (ok, input, error) = await EndpointHelpers.TryReadOptionalJsonAsync<RejectPlanChangeInput>(httpContext, cancellationToken);
            if (!ok) return error!;
            return Results.Ok(await service.RejectPlanChangeAsync(id, input, ActorId(actor)));
        });

        // --- Group 4.3: Customer Queries & Dynamic FAQ Catalog ---
        staffRetailAdmin.MapGet("/queries", (string? status, string? category, int? customerId, OperationsService service) =>
            service.QueriesAsync(status, category, customerId));
        staffRetailAdmin.MapPost("/queries", async (CustomerQueryInput input, OperationsService service, ClaimsPrincipal actor) =>
            Results.Json(await service.CreateQueryAsync(input, ActorId(actor)), statusCode: 201));
        staffRetailAdmin.MapPost("/queries/{id:int}/answer", (int id, AnswerQueryInput input, OperationsService service, ClaimsPrincipal actor) =>
            service.AnswerQueryAsync(id, input, ActorId(actor)));
        staffRetailAdmin.MapPost("/queries/{id:int}/close", (int id, OperationsService service, ClaimsPrincipal actor) =>
            service.CloseQueryAsync(id, ActorId(actor)));

        api.MapGet("/faq", (string? category, OperationsService service) =>
            service.FaqCatalogAsync(category));
    }

    private static int ActorId(ClaimsPrincipal actor) => EndpointHelpers.ActorId(actor);

    private static IResult CreatedOrExisting(Creation<OrderView> result) =>
        result.Created ? Results.Json(result.Value, statusCode: 201) : Results.Ok(result.Value);
}
