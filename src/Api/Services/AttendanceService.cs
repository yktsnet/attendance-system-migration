using AttendanceApi.Hubs;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Npgsql;
using System.Text;

namespace AttendanceApi.Services;

// --- DTOs ---
public record AttendanceLogDto(
    int Id,
    string EmployeeId,
    DateTime? ClockIn,
    DateTime? ClockOut,
    int BreakMinutes,
    bool IsCorrected
);

public record CurrentAttendanceDto(string EmployeeId, string EmployeeName, DateTime ClockIn);

public record ClockInRequest(string EmployeeId);
public record ClockOutRequest(string EmployeeId);
public record CorrectAttendanceRequest(DateTime ClockIn, DateTime ClockOut, int BreakMinutes = 60);

public record MonthlySummaryDto(
    string EmployeeId,
    int Year,
    int Month,
    int WorkDays,
    decimal TotalHours,
    decimal OvertimeHours
);

public record MonthlyPayrollDto(
    string EmployeeId,
    int Year,
    int Month,
    decimal TotalHours,
    decimal OvertimeHours,
    decimal RegularPay,
    decimal OvertimePay,
    decimal TotalPay
);

public record DemoAttendanceRecord(
    string EmployeeId,
    DateTime ClockIn,
    DateTime ClockOut,
    bool IsCorrected
);

public class AttendanceService
{
    private readonly string _connectionString;
    private readonly IHubContext<AttendanceHub> _hub;
    private static readonly DateOnly DemoStartDate = new(2025, 12, 1);
    private const decimal OvertimeAlertThreshold = 5m; // 5h以上で警告（デモ用）

    public AttendanceService(IConfiguration config, IHubContext<AttendanceHub> hub)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection が設定されていません。");
        _hub = hub;
    }

    public async Task<bool> ClockInAsync(ClockInRequest req)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();
        using var tran = await conn.BeginTransactionAsync();
        var inserted = false;
        try
        {
            const string checkSql = @"
                SELECT COUNT(*) FROM attendance_logs
                WHERE employee_id = @EmployeeId
                  AND DATE(clock_in) = CURRENT_DATE
                  AND clock_out IS NULL";
            var count = await conn.ExecuteScalarAsync<int>(checkSql, new { req.EmployeeId }, tran);
            if (!ShouldAllowClockIn(count)) return false;

            const string sql = "INSERT INTO attendance_logs (employee_id, clock_in) VALUES (@EmployeeId, NOW())";
            await conn.ExecuteAsync(sql, new { req.EmployeeId }, tran);
            await tran.CommitAsync();
            inserted = true;
        }
        catch
        {
            await tran.RollbackAsync();
            throw;
        }

        if (inserted)
        {
            var name = await GetEmployeeNameAsync(req.EmployeeId);
            await _hub.Clients.All.SendAsync("ClockUpdate", new
            {
                employeeId   = req.EmployeeId,
                employeeName = name,
                action       = "clockIn",
                timestamp    = DateTime.Now,
            });
        }
        return inserted;
    }

    public async Task<bool> ClockOutAsync(ClockOutRequest req)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();
        using var tran = await conn.BeginTransactionAsync();
        var updated = false;
        try
        {
            const string findSql = @"
                SELECT id FROM attendance_logs
                WHERE employee_id = @EmployeeId
                  AND DATE(clock_in) = CURRENT_DATE
                  AND clock_out IS NULL
                LIMIT 1";
            var id = await conn.ExecuteScalarAsync<int?>(findSql, new { req.EmployeeId }, tran);
            if (!ShouldAllowClockOut(id)) return false;

            const string sql = "UPDATE attendance_logs SET clock_out = NOW() WHERE id = @Id";
            await conn.ExecuteAsync(sql, new { Id = id }, tran);
            await tran.CommitAsync();
            updated = true;
        }
        catch
        {
            await tran.RollbackAsync();
            throw;
        }

        if (updated)
        {
            var name = await GetEmployeeNameAsync(req.EmployeeId);
            await _hub.Clients.All.SendAsync("ClockUpdate", new
            {
                employeeId   = req.EmployeeId,
                employeeName = name,
                action       = "clockOut",
                timestamp    = DateTime.Now,
            });
            await CheckOvertimeAlertAsync(req.EmployeeId, name);
        }
        return updated;
    }

    public async Task<bool> CorrectAttendanceAsync(int id, CorrectAttendanceRequest req)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        const string sql = @"
            UPDATE attendance_logs
            SET clock_in      = @ClockIn,
                clock_out     = @ClockOut,
                break_minutes = @BreakMinutes,
                is_corrected  = TRUE
            WHERE id = @Id";
        var rows = await conn.ExecuteAsync(sql, new { req.ClockIn, req.ClockOut, req.BreakMinutes, Id = id });
        return rows > 0;
    }

    public async Task<IEnumerable<AttendanceLogDto>> GetHistoryAsync(string employeeId)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        const string sql = @"
            SELECT id, employee_id, clock_in, clock_out, break_minutes, is_corrected
            FROM attendance_logs
            WHERE employee_id = @EmployeeId
            ORDER BY clock_in DESC";
        return await conn.QueryAsync<AttendanceLogDto>(sql, new { EmployeeId = employeeId });
    }

    public async Task<IEnumerable<CurrentAttendanceDto>> GetCurrentAttendanceAsync()
    {
        using var conn = new NpgsqlConnection(_connectionString);
        const string sql = @"
            SELECT al.employee_id, e.name AS employee_name, al.clock_in
            FROM attendance_logs al
            JOIN employees e ON al.employee_id = e.id
            WHERE DATE(al.clock_in) = CURRENT_DATE
              AND al.clock_out IS NULL
            ORDER BY al.clock_in";
        return await conn.QueryAsync<CurrentAttendanceDto>(sql);
    }

    public async Task<MonthlySummaryDto> GetMonthlyAsync(string employeeId, int year, int month)
    {
        var logs = await GetMonthlyLogsAsync(employeeId, year, month);
        var emp  = await GetEmployeeRecordAsync(employeeId);
        return AttendanceCalculator.CalcSummary(employeeId, year, month, logs, emp.RoundUnitMinutes);
    }

    public async Task<MonthlyPayrollDto> CalcMonthlyPayrollAsync(string employeeId, int year, int month)
    {
        var logs = await GetMonthlyLogsAsync(employeeId, year, month);
        var emp  = await GetEmployeeRecordAsync(employeeId);
        return AttendanceCalculator.CalcPayroll(employeeId, year, month, logs, emp.HourlyWage, emp.RoundUnitMinutes);
    }

    public async Task<byte[]> ExportMonthlyCsvAsync(string employeeId, int year, int month)
    {
        var logs = await GetMonthlyLogsAsync(employeeId, year, month);
        var csv  = FormatMonthlyCsv(logs);
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
    }

    /// <summary>
    /// 月次勤怠ログをCSV文字列（ヘッダ行含む、BOMなし）に整形する。DB非依存で単体テスト可能。
    /// </summary>
    public static string FormatMonthlyCsv(IEnumerable<AttendanceLogDto> logs)
    {
        var sb = new StringBuilder();
        sb.AppendLine("日付,出勤時刻,退勤時刻,休憩(分),勤務時間(h),修正フラグ");
        foreach (var log in logs)
        {
            var workMinutes = log.ClockIn.HasValue && log.ClockOut.HasValue
                ? Math.Max(0m, (decimal)(log.ClockOut.Value - log.ClockIn.Value).TotalMinutes - log.BreakMinutes)
                : 0m;
            var hours = workMinutes > 0 ? (workMinutes / 60).ToString("F2") : "";
            sb.AppendLine(
                $"{log.ClockIn:yyyy-MM-dd}," +
                $"{log.ClockIn:HH:mm:ss}," +
                $"{log.ClockOut:HH:mm:ss}," +
                $"{log.BreakMinutes}," +
                $"{hours}," +
                $"{log.IsCorrected}");
        }
        return sb.ToString();
    }

    public async Task ResetForDemoAsync()
    {
        var yesterday = DateOnly.FromDateTime(DateTime.Today.AddDays(-1));
        var rng = new Random(42);

        using var conn = new NpgsqlConnection(_connectionString);

        await conn.ExecuteAsync(
            "DELETE FROM attendance_logs WHERE DATE(clock_in) = CURRENT_DATE");

        var employees = await conn.QueryAsync<EmployeeRecord>(
            "SELECT id, hourly_wage, round_unit_minutes FROM employees");

        foreach (var emp in employees)
        {
            var existingDates = (await conn.QueryAsync<DateTime>(
                "SELECT DATE(clock_in) FROM attendance_logs WHERE employee_id = @Id AND clock_in IS NOT NULL",
                new { Id = emp.Id }))
                .Select(DateOnly.FromDateTime)
                .ToHashSet();

            var records = GenerateDemoRecords(emp.Id, existingDates, DemoStartDate, yesterday, emp.RoundUnitMinutes, rng);
            foreach (var rec in records)
            {
                await conn.ExecuteAsync(
                    @"INSERT INTO attendance_logs (employee_id, clock_in, clock_out, is_corrected)
                      VALUES (@EmployeeId, @ClockIn, @ClockOut, @IsCorrected)
                      ON CONFLICT DO NOTHING",
                    new { EmployeeId = rec.EmployeeId, ClockIn = rec.ClockIn, ClockOut = rec.ClockOut, IsCorrected = rec.IsCorrected });
            }
        }
    }

    /// <summary>
    /// 1名分のデモ勤怠データを生成する（DB非依存）。土日・既存日付はスキップし、
    /// 対象期間内で重複のない1日1件のレコード群を返す。投入整合性（必須項目充足・重複なし）を単体テスト可能。
    /// </summary>
    public static List<DemoAttendanceRecord> GenerateDemoRecords(
        string employeeId,
        IEnumerable<DateOnly> existingDates,
        DateOnly demoStartDate,
        DateOnly lastDate,
        int roundUnitMinutes,
        Random rng)
    {
        var existing = existingDates as ISet<DateOnly> ?? existingDates.ToHashSet();
        var records  = new List<DemoAttendanceRecord>();
        var current  = demoStartDate;
        while (current <= lastDate)
        {
            if (current.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday
                && !existing.Contains(current))
            {
                var (clockIn, clockOut) = GenerateWorkTime(current, roundUnitMinutes, rng);
                var corrected = rng.NextDouble() < 0.05;
                records.Add(new DemoAttendanceRecord(employeeId, clockIn, clockOut, corrected));
            }
            current = current.AddDays(1);
        }
        return records;
    }

    /// <summary>当日に未退勤の打刻が既に存在する場合は出勤打刻を許可しない（重複打刻判定）。DB非依存で単体テスト可能。</summary>
    public static bool ShouldAllowClockIn(int existingOpenEntryCount) => existingOpenEntryCount == 0;

    /// <summary>当日の未退勤打刻が存在する場合のみ退勤打刻を許可する。DB非依存で単体テスト可能。</summary>
    public static bool ShouldAllowClockOut(int? openEntryId) => openEntryId != null;

    // --- private ---
    private async Task<string> GetEmployeeNameAsync(string employeeId)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        return await conn.ExecuteScalarAsync<string>(
            "SELECT name FROM employees WHERE id = @Id", new { Id = employeeId }) ?? employeeId;
    }

    private async Task CheckOvertimeAlertAsync(string employeeId, string employeeName)
    {
        var now  = DateTime.Now;
        var logs = await GetMonthlyLogsAsync(employeeId, now.Year, now.Month);
        var emp  = await GetEmployeeRecordAsync(employeeId);
        var summary = AttendanceCalculator.CalcSummary(
            employeeId, now.Year, now.Month, logs, emp.RoundUnitMinutes);

        if (summary.OvertimeHours >= OvertimeAlertThreshold)
        {
            await _hub.Clients.Group("admins").SendAsync("OvertimeAlert", new
            {
                employeeId    = employeeId,
                employeeName  = employeeName,
                overtimeHours = summary.OvertimeHours,
                threshold     = OvertimeAlertThreshold,
            });
        }
    }

    private static (DateTime clockIn, DateTime clockOut) GenerateWorkTime(DateOnly date, int roundUnit, Random rng)
    {
        var r = rng.NextDouble();
        int raw = r < 0.70 ? 480 + rng.Next(-10, 11)
                : r < 0.90 ? 480 + rng.Next(60, 181)
                :             rng.Next(360, 421);
        var rounded  = (raw / roundUnit) * roundUnit;
        var clockIn  = date.ToDateTime(TimeOnly.MinValue).AddHours(8).AddMinutes(30 + rng.Next(0, 61));
        var clockOut = clockIn.AddMinutes(rounded);
        return (clockIn, clockOut);
    }

    private async Task<IEnumerable<AttendanceLogDto>> GetMonthlyLogsAsync(string employeeId, int year, int month)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        const string sql = @"
            SELECT id, employee_id, clock_in, clock_out, break_minutes, is_corrected
            FROM attendance_logs
            WHERE employee_id = @EmployeeId
              AND clock_in IS NOT NULL
              AND EXTRACT(YEAR  FROM clock_in) = @Year
              AND EXTRACT(MONTH FROM clock_in) = @Month
            ORDER BY clock_in";
        return await conn.QueryAsync<AttendanceLogDto>(sql, new { EmployeeId = employeeId, Year = year, Month = month });
    }

    private async Task<EmployeeRecord> GetEmployeeRecordAsync(string employeeId)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        const string sql = "SELECT id, hourly_wage, round_unit_minutes FROM employees WHERE id = @Id";
        return await conn.QuerySingleAsync<EmployeeRecord>(sql, new { Id = employeeId });
    }

    private record EmployeeRecord(string Id, decimal HourlyWage, int RoundUnitMinutes);
}
