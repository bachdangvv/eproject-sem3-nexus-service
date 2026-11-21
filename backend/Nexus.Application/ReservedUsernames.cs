using System.Text.RegularExpressions;

namespace Nexus.Application;

internal static partial class ReservedUsernames
{
    public static bool IsReservedCustomerCode(string username) =>
        CustomerCodePattern().IsMatch(username.Trim());

    [GeneratedRegex("^cus-[0-9]+$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CustomerCodePattern();
}
