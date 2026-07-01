using AttendanceApi.Services;
namespace AttendanceApi.Endpoints;
public static class AttendanceEndpoints
{
    public static void MapAttendanceEndpoints(this WebApplication app)
    {
        app.MapPost("/attendances/clock-in", async (ClockInRequest req, AttendanceService svc) =>
        {
            var ok = await svc.ClockInAsync(req);
            return ok ? Results.Ok() : Results.Conflict("既に出勤打刻済みです。");
        })
        .WithName("ClockIn").WithTags("Attendances");

        app.MapPost("/attendances/clock-out", async (ClockOutRequest req, AttendanceService svc) =>
        {
            var ok = await svc.ClockOutAsync(req);
            return ok ? Results.Ok() : Results.NotFound("出勤打刻が見つかりません。");
        })
        .WithName("ClockOut").WithTags("Attendances");

        app.MapPut("/attendances/{id}", async (int id, CorrectAttendanceRequest req, AttendanceService svc) =>
        {
            var ok = await svc.CorrectAttendanceAsync(id, req);
            return ok ? Results.Ok() : Results.NotFound();
        })
        .WithName("CorrectAttendance").WithTags("Attendances")
        .RequireAuthorization();

        app.MapGet("/attendances/current",
            async (AttendanceService svc) =>
            Results.Ok(await svc.GetCurrentAttendanceAsync()))
           .WithName("GetCurrentAttendance").WithTags("Attendances");

        app.MapGet("/attendances/{employeeId}/monthly",
            async (string employeeId, int? year, int? month, AttendanceService svc) =>
        {
            var (y, m) = ResolveYearMonth(year, month);
            return Results.Ok(await svc.GetMonthlyAsync(employeeId, y, m));
        })
        .WithName("GetMonthlySummary").WithTags("Attendances");

        app.MapGet("/attendances/{employeeId}/history",
            async (string employeeId, AttendanceService svc) =>
            Results.Ok(await svc.GetHistoryAsync(employeeId)))
           .WithName("GetHistory").WithTags("Attendances");

        app.MapGet("/attendances/{employeeId}/monthly/csv",
            async (string employeeId, int? year, int? month, AttendanceService svc, HttpResponse response) =>
        {
            var (y, m) = ResolveYearMonth(year, month);
            var csv = await svc.ExportMonthlyCsvAsync(employeeId, y, m);
            response.Headers["Content-Disposition"] =
                $"attachment; filename=attendance_{employeeId}_{y}{m:D2}.csv";
            return Results.File(csv, "text/csv; charset=utf-8");
        })
        .WithName("ExportMonthlyCsv").WithTags("Attendances");

        app.MapGet("/attendances/{employeeId}/payroll",
            async (string employeeId, int? year, int? month, AttendanceService svc) =>
        {
            var (y, m) = ResolveYearMonth(year, month);
            return Results.Ok(await svc.CalcMonthlyPayrollAsync(employeeId, y, m));
        })
        .WithName("GetMonthlyPayroll").WithTags("Attendances");

        app.MapPost("/demo/reset", async (AttendanceService svc) =>
        {
            await svc.ResetForDemoAsync();
            return Results.Ok();
        })
        .WithName("DemoReset").WithTags("Demo");
    }

    // year/month 未指定時は現在年月を使う（各エンドポイント共通の解決ロジック）
    private static (int Year, int Month) ResolveYearMonth(int? year, int? month)
    {
        var now = DateTime.Now;
        return (year ?? now.Year, month ?? now.Month);
    }
}
