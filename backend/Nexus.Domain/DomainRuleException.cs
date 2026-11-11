namespace Nexus.Domain;

public enum DomainRuleFailure { InvalidInput, InvalidState }

public sealed class DomainRuleException(DomainRuleFailure failure, string message) : Exception(message)
{
    public DomainRuleFailure Failure { get; } = failure;
}
