using System.Text.Json.Serialization;

namespace Backend.DTOs;

/// <summary>Skitgubbe state – samma mönster som FiveHundredStateDto, tydliga typer för serialisering.</summary>
public class SkitgubbeStateDto
{
    public string Phase { get; set; } = "sticks";
    public int NumPlayers { get; set; } = 2;
    public string[] PlayerIds { get; set; } = Array.Empty<string>();
    public List<CardDto> Stock { get; set; } = new();
    public Dictionary<string, List<CardDto>> PlayerHands { get; set; } = new();
    public CardDto? LastRevealedCard { get; set; }
    public string? TrumpSuit { get; set; }
    public string? LastStickWinner { get; set; }
    public List<StickCardDto> TableStick { get; set; } = new();
    public string? StickLedRank { get; set; }
    public List<string> PlayersMustPlay { get; set; } = new();
    public List<string> StickFighters { get; set; } = new();
    public string CurrentPlayerId { get; set; } = "p1";
    public Dictionary<string, int> SticksWon { get; set; } = new();
    public Dictionary<string, List<CardDto>> WonCards { get; set; } = new();
    public bool HumanPendingKlar { get; set; }
    public string? NextPlayerIdAfterKlar { get; set; }
    public string? StickShowingWinner { get; set; }
    public List<TrickCardDto> TableTrick { get; set; } = new();
    public string? TrickLeader { get; set; }
    public int TrickLeadLength { get; set; }
    public List<int> TrickPlayLengths { get; set; } = new();
    public string? TrickLeadSuit { get; set; }
    public string? TrickHighRank { get; set; }
    public bool TrumpPlayedInTrick { get; set; }
    public string? WinnerId { get; set; }
    public string? SkitgubbePlayerId { get; set; }
    public string[] SkitgubbePlayerIds { get; set; } = Array.Empty<string>();
    public string? TrickShowingWinner { get; set; }
    public string? TrickPickUpBy { get; set; }
    public List<string> TrickFighters { get; set; } = new();
    public int TrickFightStartIndex { get; set; }
}

public class StickCardDto
{
    public string PlayerId { get; set; } = "";
    public CardDto Card { get; set; } = new();
}

public class TrickCardDto
{
    public string PlayerId { get; set; } = "";
    public CardDto Card { get; set; } = new();
}

public class SkitgubbeActionRequest
{
    [JsonPropertyName("newStateJson")]
    public string? NewStateJson { get; set; }
}
