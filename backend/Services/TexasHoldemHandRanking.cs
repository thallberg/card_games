using System.Text.Json;

namespace Backend.Services;

/// <summary>
/// Poker hand ranking for Texas Hold'em. Best 5 from 7 cards (2 hole + 5 board).
/// </summary>
public static class TexasHoldemHandRanking
{
    private static readonly Dictionary<string, int> RankValues = new()
    {
        ["2"] = 2, ["3"] = 3, ["4"] = 4, ["5"] = 5, ["6"] = 6, ["7"] = 7, ["8"] = 8, ["9"] = 9, ["10"] = 10,
        ["jack"] = 11, ["queen"] = 12, ["king"] = 13, ["ace"] = 14
    };

    private static readonly string[] HandOrder = {
        "highCard", "pair", "twoPair", "threeOfAKind", "straight", "flush",
        "fullHouse", "fourOfAKind", "straightFlush", "royalFlush"
    };

    private static int RankValue(string rank) => RankValues.GetValueOrDefault(rank?.ToLowerInvariant() ?? "", 0);

    /// <summary>Best 5-card hand from hole cards + board. holeCards and board are JsonElement arrays.</summary>
    public static (string Rank, List<int> Values) BestHand(JsonElement holeCards, JsonElement board)
    {
        var all = new List<JsonElement>();
        if (holeCards.ValueKind == JsonValueKind.Array)
            foreach (var c in holeCards.EnumerateArray()) all.Add(c);
        if (board.ValueKind == JsonValueKind.Array)
            foreach (var c in board.EnumerateArray()) all.Add(c);
        if (all.Count < 5) return ("highCard", new List<int>());

        var combos = Choose5(all);
        var best = ("highCard", new List<int>());
        foreach (var five in combos)
        {
            var (r, v) = RankHand(five);
            if (CompareHands(r, v, best.Item1, best.Item2) > 0)
                best = (r, v);
        }
        return best;
    }

    /// <summary>Compare two ranked hands. Returns &gt;0 if (rankA, valuesA) beats (rankB, valuesB).</summary>
    public static int CompareHands(string rankA, List<int> valuesA, string rankB, List<int> valuesB)
    {
        var ia = Array.IndexOf(HandOrder, rankA);
        var ib = Array.IndexOf(HandOrder, rankB);
        if (ia != ib) return ia - ib;
        var len = Math.Max(valuesA?.Count ?? 0, valuesB?.Count ?? 0);
        for (int i = 0; i < len; i++)
        {
            var va = i < (valuesA?.Count ?? 0) ? valuesA![i] : 0;
            var vb = i < (valuesB?.Count ?? 0) ? valuesB![i] : 0;
            if (va != vb) return va - vb;
        }
        return 0;
    }

    private static List<List<JsonElement>> Choose5(List<JsonElement> cards)
    {
        var result = new List<List<JsonElement>>();
        void Go(int start, List<JsonElement> chosen)
        {
            if (chosen.Count == 5) { result.Add(new List<JsonElement>(chosen)); return; }
            for (int i = start; i < cards.Count; i++)
            {
                chosen.Add(cards[i]);
                Go(i + 1, chosen);
                chosen.RemoveAt(chosen.Count - 1);
            }
        }
        Go(0, new List<JsonElement>());
        return result;
    }

    private static (string Rank, List<int> Values) RankHand(List<JsonElement> five)
    {
        var cards = five.Select(c =>
        {
            var suit = c.TryGetProperty("suit", out var sp) ? sp.GetString() ?? "" : "";
            var rank = c.TryGetProperty("rank", out var rp) ? rp.GetString() ?? "" : "";
            return (Suit: suit, Rank: rank);
        }).ToList();
        var values = cards.Select(c => RankValue(c.Rank)).OrderByDescending(x => x).ToList();
        var byRank = cards.GroupBy(c => RankValue(c.Rank)).ToDictionary(g => g.Key, g => g.ToList());
        var bySuit = cards.GroupBy(c => c.Suit).ToDictionary(g => g.Key!, g => g.ToList());
        var counts = byRank.Select(kv => (Val: kv.Key, Count: kv.Value.Count)).OrderByDescending(x => x.Count).ThenByDescending(x => x.Val).ToList();

        var flushSuit = bySuit.FirstOrDefault(s => s.Value.Count >= 5).Key;
        var flushCards = flushSuit != null ? bySuit[flushSuit] : new List<(string Suit, string Rank)>();
        var flushVals = flushCards.Select(c => RankValue(c.Rank)).ToList();
        var (isStr, straightHigh) = flushCards.Count >= 5 ? IsStraight(flushVals) : IsStraight(values);

        if (flushSuit != null && flushCards.Count >= 5)
        {
            var (sf, high) = IsStraight(flushVals);
            if (sf)
                return (high == 14 ? "royalFlush" : "straightFlush", new List<int> { high });
            return ("flush", flushVals.OrderByDescending(x => x).Take(5).ToList());
        }

        if (counts.Count > 0 && counts[0].Count == 4)
        {
            var quadVal = counts[0].Val;
            var kicker = counts.Count > 1 ? counts[1].Val : values.FirstOrDefault(v => v != quadVal);
            return ("fourOfAKind", new List<int> { quadVal, kicker });
        }

        if (counts.Count >= 2 && counts[0].Count == 3 && counts[1].Count == 2)
            return ("fullHouse", new List<int> { counts[0].Val, counts[1].Val });

        if (isStr)
            return ("straight", new List<int> { straightHigh });

        if (counts.Count > 0 && counts[0].Count == 3)
        {
            var tripVal = counts[0].Val;
            var kickers = values.Where(v => v != tripVal).OrderByDescending(x => x).Take(2).ToList();
            return ("threeOfAKind", new List<int> { tripVal }.Concat(kickers).ToList());
        }

        if (counts.Count >= 2 && counts[0].Count == 2 && counts[1].Count == 2)
        {
            var high = Math.Max(counts[0].Val, counts[1].Val);
            var low = Math.Min(counts[0].Val, counts[1].Val);
            var kicker = counts.Count > 2 ? counts[2].Val : values.FirstOrDefault(v => v != high && v != low);
            return ("twoPair", new List<int> { high, low, kicker });
        }

        if (counts.Count > 0 && counts[0].Count == 2)
        {
            var pairVal = counts[0].Val;
            var kickers = values.Where(v => v != pairVal).OrderByDescending(x => x).Take(3).ToList();
            return ("pair", new List<int> { pairVal }.Concat(kickers).ToList());
        }

        return ("highCard", values.Take(5).ToList());
    }

    private static (bool IsStraight, int High) IsStraight(List<int> values)
    {
        var uniq = values.Distinct().OrderByDescending(x => x).ToList();
        var withAceLow = uniq.Contains(14) ? uniq.Where(x => x != 14).Append(1).OrderByDescending(x => x).ToList() : new List<int>();
        foreach (var arr in new[] { uniq, withAceLow })
        {
            for (int i = 0; i <= arr.Count - 5; i++)
            {
                bool ok = true;
                for (int j = 1; j < 5; j++)
                    if (arr[i] - arr[i + j] != j) { ok = false; break; }
                if (ok) return (true, arr[i]);
            }
        }
        return (false, 0);
    }
}
