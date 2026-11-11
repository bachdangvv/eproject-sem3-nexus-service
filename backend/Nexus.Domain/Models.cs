namespace Nexus.Domain;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Retail = "Retail";
    public const string Technical = "Technical";
    public const string Billing = "Billing";
    public static readonly string[] All = [Admin, Retail, Technical, Billing];
}

public sealed class Employee
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string DisplayName { get; set; }
    public required string Role { get; set; }
    public required string PasswordHash { get; set; }
}

public sealed class City
{
    public required string Code { get; set; }
    public required string Name { get; set; }
}

public sealed class Customer
{
    public int Id { get; set; }
    public string Code => $"CUS-{Id:D6}";
    public required string Name { get; set; }
    public required string SearchName { get; set; }
    public required string Phone { get; set; }
    public required string Address { get; set; }
    public required string CityCode { get; set; }
    public City City { get; set; } = null!;
}

public sealed class ServicePlan
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Type { get; set; }
    public required string Description { get; set; }
    public decimal Price { get; set; }
    public bool Active { get; set; } = true;
}

public sealed class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public bool Active { get; set; } = true;
}

public sealed class ServiceRequest
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int PlanId { get; set; }
    public ServicePlan Plan { get; set; } = null!;
    // Snapshot the selected plan and installation address when the request is filed.
    public required string PlanName { get; set; }
    public required string Type { get; set; }
    public required string CityCode { get; set; }
    public required string Address { get; set; }
    public bool HasNexusLandline { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedById { get; set; }
    public bool Confirmed { get; private set; }
    public ServiceOrder? Order { get; set; }

    public ServiceOrder Confirm(int actorId)
    {
        Confirmed = true;
        var order = new ServiceOrder { Request = this };
        order.History.Add(new OrderEvent
        {
            Status = OrderStatus.Pending, ActorId = actorId, Note = "Retail confirmed the request."
        });
        return order;
    }
}

public enum OrderStatus { Pending, Feasible, NotFeasible, Connected }

public sealed class ServiceOrder
{
    public long Id { get; set; }
    public int RequestId { get; set; }
    public ServiceRequest Request { get; set; } = null!;
    public string Code => new OrderNumber(Request.Type, Id).ToString();
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Connection? Connection { get; set; }
    public List<OrderEvent> History { get; set; } = [];
    public List<ServiceFeedback> Feedback { get; set; } = [];

    public void Assess(bool? distanceOk, bool? serverAvailable, bool? landlineFeasible, string? note, int actorId)
    {
        if (Status != OrderStatus.Pending)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Only Pending orders can be assessed.");

        var needsLandline = Request.Type == "D" && !Request.HasNexusLandline;
        if (needsLandline && landlineFeasible is null)
            throw new DomainRuleException(DomainRuleFailure.InvalidInput, "Check landline feasibility for this Dial-up order.");

        var feasible = distanceOk == true && serverAvailable == true && (!needsLandline || landlineFeasible == true);
        if (!feasible && string.IsNullOrWhiteSpace(note))
            throw new DomainRuleException(DomainRuleFailure.InvalidInput, "Enter the reason the order is not feasible.");

        Status = feasible ? OrderStatus.Feasible : OrderStatus.NotFeasible;
        History.Add(new OrderEvent
        {
            Status = Status, ActorId = actorId, Note = note?.Trim() ?? "",
            DistanceOk = distanceOk, ServerAvailable = serverAvailable,
            LandlineFeasible = needsLandline ? landlineFeasible : null
        });
    }

    public void Activate(int actorId)
    {
        if (Status != OrderStatus.Feasible)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Only Feasible orders can be connected.");

        Connection = new Connection { Type = Request.Type, CityCode = Request.CityCode };
        Status = OrderStatus.Connected;
        History.Add(new OrderEvent
        {
            Status = Status, ActorId = actorId, Note = "Technical activated the connection."
        });
    }

    public ServiceFeedback RecordFeedback(int rating, string comment, int actorId)
    {
        if (Status != OrderStatus.Connected)
            throw new DomainRuleException(DomainRuleFailure.InvalidState, "Feedback is available after the connection is active.");

        return new ServiceFeedback
        {
            OrderId = Id, RecordedById = actorId, Rating = rating, Comment = comment.Trim()
        };
    }
}

public sealed class OrderEvent
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public int ActorId { get; set; }
    public Employee Actor { get; set; } = null!;
    public required string Note { get; set; }
    public bool? DistanceOk { get; set; }
    public bool? ServerAvailable { get; set; }
    public bool? LandlineFeasible { get; set; }
}

public sealed class Connection
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public required string Type { get; set; }
    public required string CityCode { get; set; }
    public string AccountId => $"{Type}{CityCode}{Id:D12}";
    public DateTime ActivatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ServiceFeedback
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public int RecordedById { get; set; }
    public Employee RecordedBy { get; set; } = null!;
    public int Rating { get; set; }
    public required string Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
