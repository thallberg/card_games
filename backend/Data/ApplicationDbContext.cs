using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<FriendRequest> FriendRequests => Set<FriendRequest>();
    public DbSet<UserFriend> UserFriends => Set<UserFriend>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<GameSessionPlayer> GameSessionPlayers => Set<GameSessionPlayer>();
    public DbSet<FiveHundredState> FiveHundredStates => Set<FiveHundredState>();
    public DbSet<ChicagoState> ChicagoStates => Set<ChicagoState>();
    public DbSet<TexasHoldemState> TexasHoldemStates => Set<TexasHoldemState>();
    public DbSet<SkitgubbeState> SkitgubbeStates => Set<SkitgubbeState>();
    public DbSet<FinnsisjonState> FinnsisjonStates => Set<FinnsisjonState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.DisplayName).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256);
            e.Property(u => u.DisplayName).HasMaxLength(100);
            e.Property(u => u.AvatarEmoji).HasMaxLength(20);
            e.Property(u => u.AvatarImageData).HasColumnType("text");
        });

        modelBuilder.Entity<FriendRequest>(e =>
        {
            e.HasOne(f => f.FromUser).WithMany(u => u.SentFriendRequests).HasForeignKey(f => f.FromUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(f => f.ToUser).WithMany(u => u.ReceivedFriendRequests).HasForeignKey(f => f.ToUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(f => new { f.FromUserId, f.ToUserId });
        });

        modelBuilder.Entity<UserFriend>(e =>
        {
            e.HasKey(uf => new { uf.UserId, uf.FriendId });
            e.HasOne(uf => uf.User).WithMany(u => u.FriendsAsUser).HasForeignKey(uf => uf.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(uf => uf.Friend).WithMany(u => u.FriendsAsFriend).HasForeignKey(uf => uf.FriendId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GameSession>(e =>
        {
            e.HasOne(g => g.Leader).WithMany(u => u.LedGameSessions).HasForeignKey(g => g.LeaderId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GameSessionPlayer>(e =>
        {
            e.HasKey(gp => new { gp.GameSessionId, gp.UserId });
            e.HasOne(gp => gp.GameSession).WithMany(g => g.Players).HasForeignKey(gp => gp.GameSessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(gp => gp.User).WithMany(u => u.GameSessionPlayers).HasForeignKey(gp => gp.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FiveHundredState>(e =>
        {
            e.HasKey(f => f.GameSessionId);
            e.HasOne(f => f.GameSession).WithMany().HasForeignKey(f => f.GameSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChicagoState>(e =>
        {
            e.HasKey(c => c.GameSessionId);
            e.HasOne(c => c.GameSession).WithMany().HasForeignKey(c => c.GameSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TexasHoldemState>(e =>
        {
            e.HasKey(t => t.GameSessionId);
            e.HasOne(t => t.GameSession).WithMany().HasForeignKey(t => t.GameSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SkitgubbeState>(e =>
        {
            e.HasKey(s => s.GameSessionId);
            e.HasOne(s => s.GameSession).WithMany().HasForeignKey(s => s.GameSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FinnsisjonState>(e =>
        {
            e.HasKey(f => f.GameSessionId);
            e.HasOne(f => f.GameSession).WithMany().HasForeignKey(f => f.GameSessionId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
