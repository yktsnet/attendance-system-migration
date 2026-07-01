using AttendanceApi.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace AttendanceApi.Tests;

public class LateStayCheckServiceTests
{
    // --- IsLateStay: 境界値（ちょうど1時間・1時間未満・1時間超過） ---

    [Fact]
    public void IsLateStay_ExactlyOneHourOver_ReturnsFalse()
    {
        var avgClockout = new TimeSpan(18, 0, 0);
        var now         = new TimeSpan(19, 0, 0); // ちょうど+1時間
        Assert.False(LateStayCheckService.IsLateStay(now, avgClockout));
    }

    [Fact]
    public void IsLateStay_LessThanOneHourOver_ReturnsFalse()
    {
        var avgClockout = new TimeSpan(18, 0, 0);
        var now         = new TimeSpan(18, 59, 0); // +59分
        Assert.False(LateStayCheckService.IsLateStay(now, avgClockout));
    }

    [Fact]
    public void IsLateStay_MoreThanOneHourOver_ReturnsTrue()
    {
        var avgClockout = new TimeSpan(18, 0, 0);
        var now         = new TimeSpan(19, 1, 0); // +1時間1分
        Assert.True(LateStayCheckService.IsLateStay(now, avgClockout));
    }

    // --- NotifyLateStaysAsync: SignalR Push（モック）検証 ---

    private static (LateStayCheckService svc, Mock<IClientProxy> adminsProxy) CreateService()
    {
        var config = new ConfigurationBuilder().Build();
        var logger = new Mock<ILogger<LateStayCheckService>>();

        var mockClients = new Mock<IHubClients>();
        var adminsProxy  = new Mock<IClientProxy>();
        var mockHubCtx   = new Mock<IHubContext<AttendanceHub>>();
        mockHubCtx.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.Group("admins")).Returns(adminsProxy.Object);
        adminsProxy.Setup(c => c.SendCoreAsync(
            It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var svc = new LateStayCheckService(config, mockHubCtx.Object, logger.Object);
        return (svc, adminsProxy);
    }

    [Fact]
    public async Task NotifyLateStaysAsync_LateCandidate_SendsAlert()
    {
        var (svc, adminsProxy) = CreateService();
        var now = new DateTime(2026, 5, 1, 19, 1, 0); // avg 18:00 + 1h1m
        var candidates = new[]
        {
            new LateStayCheckService.LateStayRecord(
                "EMP-1", "テスト社員", new TimeSpan(18, 0, 0), now.Date.AddHours(9))
        };

        await svc.NotifyLateStaysAsync(candidates, now);

        adminsProxy.Verify(c => c.SendCoreAsync(
            "LateStayAlert", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotifyLateStaysAsync_NotYetLateCandidate_DoesNotSendAlert()
    {
        var (svc, adminsProxy) = CreateService();
        var now = new DateTime(2026, 5, 1, 18, 30, 0); // avg 18:00 + 30分（1時間未満）
        var candidates = new[]
        {
            new LateStayCheckService.LateStayRecord(
                "EMP-1", "テスト社員", new TimeSpan(18, 0, 0), now.Date.AddHours(9))
        };

        await svc.NotifyLateStaysAsync(candidates, now);

        adminsProxy.Verify(c => c.SendCoreAsync(
            It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task NotifyLateStaysAsync_MixedCandidates_SendsOnlyForLateOnes()
    {
        var (svc, adminsProxy) = CreateService();
        var now = new DateTime(2026, 5, 1, 19, 1, 0);
        var candidates = new[]
        {
            new LateStayCheckService.LateStayRecord(
                "EMP-LATE", "遅い社員", new TimeSpan(18, 0, 0), now.Date.AddHours(9)), // +1h1m → 対象
            new LateStayCheckService.LateStayRecord(
                "EMP-OK", "定時社員", new TimeSpan(19, 0, 0), now.Date.AddHours(9)),   // +1m → 対象外
        };

        await svc.NotifyLateStaysAsync(candidates, now);

        adminsProxy.Verify(c => c.SendCoreAsync(
            "LateStayAlert", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
