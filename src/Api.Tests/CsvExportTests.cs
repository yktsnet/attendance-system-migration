namespace AttendanceApi.Tests;

public class CsvExportTests
{
    // --- FormatMonthlyCsv: 行整形・カラム順・日時フォーマット ---

    private static AttendanceLogDto Log(int id, DateTime? clockIn, DateTime? clockOut, int breakMinutes = 0, bool corrected = false) =>
        new(id, "EMP-T", clockIn, clockOut, breakMinutes, corrected);

    [Fact]
    public void FormatMonthlyCsv_EmptyLogs_HeaderOnly()
    {
        var csv = AttendanceService.FormatMonthlyCsv(Array.Empty<AttendanceLogDto>());
        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        Assert.Single(lines);
        Assert.Equal("日付,出勤時刻,退勤時刻,休憩(分),勤務時間(h),修正フラグ", lines[0]);
    }

    [Fact]
    public void FormatMonthlyCsv_SingleLog_FormatsColumnsInOrder()
    {
        var logs = new[] { Log(1, new DateTime(2026, 5, 1, 9, 0, 0), new DateTime(2026, 5, 1, 18, 0, 0), breakMinutes: 60) };
        var csv = AttendanceService.FormatMonthlyCsv(logs);
        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, lines.Length);
        Assert.Equal("2026-05-01,09:00:00,18:00:00,60,8.00,False", lines[1]);
    }

    [Fact]
    public void FormatMonthlyCsv_NoClockOut_HoursColumnIsBlank()
    {
        var logs = new[] { Log(1, new DateTime(2026, 5, 1, 9, 0, 0), null) };
        var csv = AttendanceService.FormatMonthlyCsv(logs);
        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("2026-05-01,09:00:00,,0,,False", lines[1]);
    }

    [Fact]
    public void FormatMonthlyCsv_IsCorrectedTrue_RendersTrue()
    {
        var logs = new[] { Log(1, new DateTime(2026, 5, 1, 9, 0, 0), new DateTime(2026, 5, 1, 17, 0, 0), corrected: true) };
        var csv = AttendanceService.FormatMonthlyCsv(logs);
        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);

        Assert.EndsWith(",True", lines[1]);
    }

    [Fact]
    public void FormatMonthlyCsv_MultipleLogs_PreservesOrderAndRowCount()
    {
        var logs = new[]
        {
            Log(1, new DateTime(2026, 5, 1, 9, 0, 0), new DateTime(2026, 5, 1, 17, 0, 0)),
            Log(2, new DateTime(2026, 5, 2, 9, 0, 0), new DateTime(2026, 5, 2, 19, 0, 0)),
        };
        var csv = AttendanceService.FormatMonthlyCsv(logs);
        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(3, lines.Length); // ヘッダ + 2行
        Assert.StartsWith("2026-05-01,", lines[1]);
        Assert.StartsWith("2026-05-02,", lines[2]);
    }

    // --- GenerateDemoRecords: デモデータ投入の整合性（必須項目充足・重複なし） ---

    [Fact]
    public void GenerateDemoRecords_SkipsWeekends()
    {
        // 2026-05-01(金)〜2026-05-03(日) の3日間 → 土日(05-02,05-03)を除き1件のみ
        var records = AttendanceService.GenerateDemoRecords(
            "EMP-T", Array.Empty<DateOnly>(),
            new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3), 15, new Random(1));

        Assert.Single(records);
        Assert.Equal(new DateOnly(2026, 5, 1), DateOnly.FromDateTime(records[0].ClockIn));
    }

    [Fact]
    public void GenerateDemoRecords_SkipsExistingDates()
    {
        var existing = new[] { new DateOnly(2026, 5, 1) };
        var records = AttendanceService.GenerateDemoRecords(
            "EMP-T", existing,
            new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 1), 15, new Random(1));

        Assert.Empty(records);
    }

    [Fact]
    public void GenerateDemoRecords_AllRecordsHaveRequiredFieldsAndValidTimeOrder()
    {
        var records = AttendanceService.GenerateDemoRecords(
            "EMP-T", Array.Empty<DateOnly>(),
            new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 31), 15, new Random(7));

        Assert.NotEmpty(records);
        foreach (var r in records)
        {
            Assert.Equal("EMP-T", r.EmployeeId);
            Assert.True(r.ClockOut > r.ClockIn, "退勤時刻は出勤時刻より後であること");
        }
    }

    [Fact]
    public void GenerateDemoRecords_NoDuplicateDatesForSameEmployee()
    {
        var records = AttendanceService.GenerateDemoRecords(
            "EMP-T", Array.Empty<DateOnly>(),
            new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 31), 15, new Random(7));

        var dates = records.Select(r => DateOnly.FromDateTime(r.ClockIn)).ToList();
        Assert.Equal(dates.Count, dates.Distinct().Count());
    }
}
