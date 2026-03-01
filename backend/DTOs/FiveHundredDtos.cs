namespace Backend.DTOs;

/// <summary>
/// 500 state som serialiseras till/från JSON. Måste matcha frontend GameState.
/// </summary>
public class FiveHundredStateDto
{
    public List<CardDto> Stock { get; set; } = new();
    public List<CardDto> Discard { get; set; } = new();
    public List<MeldDto> Melds { get; set; } = new();
    public string? CurrentPlayerId { get; set; }
    public Dictionary<string, List<CardDto>> PlayerHands { get; set; } = new();
    public Dictionary<string, int> PlayerScores { get; set; } = new();
    public string Phase { get; set; } = "draw";
    public string? LastDraw { get; set; }
    public int RoundNumber { get; set; } = 1;
    public string? WinnerId { get; set; }
}

public class CardDto
{
    public string Suit { get; set; } = "";
    public string Rank { get; set; } = "";
}

public class MeldDto
{
    public string Id { get; set; } = "";
    public List<CardDto> Cards { get; set; } = new();
    public string Type { get; set; } = "set";
}

public class FiveHundredActionRequest
{
    public string Action { get; set; } = "";
    public int? CardIndex { get; set; }
    public List<int>? CardIndices { get; set; }
    public string? MeldId { get; set; }
}
