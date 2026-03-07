namespace Backend.DTOs;

public record TexasHoldemActionRequest(string Action, int? Amount = null, string? StateJson = null);

public record TexasHoldemStartRequest(int BuyIn = 2000, int BigBlind = 20);
