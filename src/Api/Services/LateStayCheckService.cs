using AttendanceApi.Hubs;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Npgsql;

namespace AttendanceApi.Services;

/// <summary>
/// 定期チェック（30分ごと）:
/// 当日 clock_in あり・clock_out なし・現在時刻 > avg_clockout_time + 1h
/// の社員を検知して管理者グループへ Push。
/// </summary>
public class LateStayCheckService : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly IHubContext<AttendanceHub> _hub;
    private readonly ILogger<LateStayCheckService> _logger;

    public LateStayCheckService(
        IConfiguration config,
        IHubContext<AttendanceHub> hub,
        ILogger<LateStayCheckService> logger)
    {
        _config = config;
        _hub    = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
            if (!stoppingToken.IsCancellationRequested)
                await CheckLateStaysAsync();
        }
    }

    /// <summary>
    /// 「現在時刻が平均退勤時刻+1時間を超過しているか」の判定のみを行う純粋関数。
    /// DB非依存で境界値（ちょうど1時間・未満・超過）を単体テスト可能。
    /// </summary>
    public static bool IsLateStay(TimeSpan currentTimeOfDay, TimeSpan avgClockoutTime) =>
        currentTimeOfDay > avgClockoutTime + TimeSpan.FromHours(1);

    /// <summary>
    /// DB問い合わせ結果（候補者一覧）を受け取り、境界値判定とPush送信のみを行う。
    /// DB非依存で、IHubContext をモックにした単体テストが可能。
    /// </summary>
    public async Task NotifyLateStaysAsync(IEnumerable<LateStayRecord> candidates, DateTime now)
    {
        foreach (var r in candidates)
        {
            if (!IsLateStay(now.TimeOfDay, r.AvgClockoutTime)) continue;

            await _hub.Clients.Group("admins").SendAsync("LateStayAlert", new
            {
                employeeId   = r.EmployeeId,
                employeeName = r.EmployeeName,
                avgClockout  = r.AvgClockoutTime.ToString(@"hh\:mm"),
                clockIn      = r.ClockIn,
            });
            _logger.LogInformation("[LateStay] Alert sent for {EmployeeId}", r.EmployeeId);
        }
    }

    private async Task CheckLateStaysAsync()
    {
        try
        {
            var connStr = _config.GetConnectionString("DefaultConnection")!;
            using var conn = new NpgsqlConnection(connStr);

            const string sql = @"
                SELECT al.employee_id,
                       e.name            AS employee_name,
                       ep.avg_clockout_time,
                       al.clock_in
                FROM attendance_logs al
                JOIN employees        e  ON al.employee_id = e.id
                JOIN employee_profiles ep ON al.employee_id = ep.employee_id
                WHERE DATE(al.clock_in) = CURRENT_DATE
                  AND al.clock_out IS NULL";

            var candidates = await conn.QueryAsync<LateStayRecord>(sql);
            await NotifyLateStaysAsync(candidates, DateTime.Now);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[LateStay] Check failed");
        }
    }

    public record LateStayRecord(
        string EmployeeId,
        string EmployeeName,
        TimeSpan AvgClockoutTime,
        DateTime ClockIn);
}
