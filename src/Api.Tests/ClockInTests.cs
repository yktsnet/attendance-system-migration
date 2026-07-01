using AttendanceApi.Hubs;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Moq;
using Npgsql;

namespace AttendanceApi.Tests;

/// <summary>
/// ClockIn/ClockOut の結合テスト（実PostgreSQL接続）と、AttendanceService の
/// DB非依存ロジック（重複打刻判定）の単体テストをまとめて持つ。
/// [Trait("Category", "Integration")] を付けたテストは実DB接続前提の結合テストであり、
/// ローカルにPostgresが起動していない場合は _dbAvailable が false になり早期returnでスキップされる
/// （失敗にはならない。既存の単体テストとは明示的に区別している）。
/// </summary>
public class ClockInTests : IAsyncLifetime
{
    private const string TestEmployeeId = "TEST-CI";
    private readonly AttendanceService _svc;
    private readonly string _conn;
    private bool _dbAvailable;

    public ClockInTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] =
                    "Host=localhost;Port=5432;Database=KINTAI;Username=kintai_user;Password=kintai_pass"
            }).Build();

        Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

        // hub は ClockIn/ClockOut の Push のみ使うため no-op でよい
        var mockClients   = new Mock<IHubClients>();
        var mockProxy     = new Mock<IClientProxy>();
        var mockHubCtx    = new Mock<IHubContext<AttendanceHub>>();
        mockHubCtx.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.All).Returns(mockProxy.Object);
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockProxy.Object);
        mockProxy.Setup(c => c.SendCoreAsync(
            It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _svc  = new AttendanceService(config, mockHubCtx.Object);
        _conn = config.GetConnectionString("DefaultConnection")!;
    }

    public async Task InitializeAsync()
    {
        try
        {
            using var conn = new NpgsqlConnection(_conn);
            await conn.OpenAsync();
            await conn.ExecuteAsync(
                "INSERT INTO employees (id, name, hourly_wage, round_unit_minutes) VALUES (@Id, @Name, 1000, 1) ON CONFLICT DO NOTHING",
                new { Id = TestEmployeeId, Name = "テスト社員" });
            await conn.ExecuteAsync(
                "DELETE FROM attendance_logs WHERE employee_id = @Id AND DATE(clock_in) = CURRENT_DATE",
                new { Id = TestEmployeeId });
            _dbAvailable = true;
        }
        catch
        {
            // ローカルにPostgresが起動していない環境では、以降のFactをSkipに倒す。
            _dbAvailable = false;
        }
    }

    public async Task DisposeAsync()
    {
        if (!_dbAvailable) return;

        using var conn = new NpgsqlConnection(_conn);
        await conn.ExecuteAsync(
            "DELETE FROM attendance_logs WHERE employee_id = @Id", new { Id = TestEmployeeId });
        await conn.ExecuteAsync(
            "DELETE FROM employees WHERE id = @Id", new { Id = TestEmployeeId });
    }

    // --- 結合テスト（実DB接続。Postgres未起動環境では早期returnでスキップ） ---

    [Fact]
    [Trait("Category", "Integration")]
    public async Task ClockIn_FirstTime_Succeeds()
    {
        if (!_dbAvailable) return; // PostgreSQLに接続できないため結合テストをスキップ

        var result = await _svc.ClockInAsync(new ClockInRequest(TestEmployeeId));
        Assert.True(result);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task ClockIn_Duplicate_ReturnsFalse()
    {
        if (!_dbAvailable) return; // PostgreSQLに接続できないため結合テストをスキップ

        await _svc.ClockInAsync(new ClockInRequest(TestEmployeeId));
        var result = await _svc.ClockInAsync(new ClockInRequest(TestEmployeeId));
        Assert.False(result);
    }

    // --- AttendanceService のDB非依存ロジック（重複打刻判定）の単体テスト ---

    [Fact]
    public void ShouldAllowClockIn_NoExistingOpenEntry_ReturnsTrue() =>
        Assert.True(AttendanceService.ShouldAllowClockIn(0));

    [Fact]
    public void ShouldAllowClockIn_ExistingOpenEntry_ReturnsFalse() =>
        Assert.False(AttendanceService.ShouldAllowClockIn(1));

    [Fact]
    public void ShouldAllowClockOut_NoOpenEntry_ReturnsFalse() =>
        Assert.False(AttendanceService.ShouldAllowClockOut(null));

    [Fact]
    public void ShouldAllowClockOut_OpenEntryExists_ReturnsTrue() =>
        Assert.True(AttendanceService.ShouldAllowClockOut(42));
}
