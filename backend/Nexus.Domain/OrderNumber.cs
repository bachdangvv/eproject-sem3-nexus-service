using System.Globalization;

namespace Nexus.Domain;

public readonly record struct OrderNumber(string Type, long Serial)
{
    public override string ToString() => $"{Type}{Serial:D10}";

    public static OrderNumber? Parse(string value)
    {
        var code = value.Trim().ToUpperInvariant();
        if (code.Length != 11 || code[0] is not ('D' or 'B' or 'T') ||
            !long.TryParse(code.AsSpan(1), NumberStyles.None, CultureInfo.InvariantCulture, out var serial) || serial < 1)
            return null;

        return new OrderNumber(code[..1], serial);
    }
}
