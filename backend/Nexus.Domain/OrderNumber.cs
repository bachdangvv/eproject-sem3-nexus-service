using System.Globalization;

namespace Nexus.Domain;

/// <summary>Represents the 11-character public service order identifier (<c>[D|B|T]0000000001</c>).</summary>
public readonly record struct OrderNumber(string Type, long Serial)
{
    /// <summary>Formats the service type prefix and 10-digit zero-padded serial.</summary>
    public override string ToString() => $"{Type}{Serial:D10}";

    /// <summary>Parses a canonical 11-character order code into its service type and positive serial.</summary>
    public static OrderNumber? Parse(string value)
    {
        var code = value.Trim().ToUpperInvariant();
        if (code.Length != 11 || code[0] is not ('D' or 'B' or 'T') ||
            !long.TryParse(code.AsSpan(1), NumberStyles.None, CultureInfo.InvariantCulture, out var serial) || serial < 1)
            return null;

        return new OrderNumber(code[..1], serial);
    }
}
