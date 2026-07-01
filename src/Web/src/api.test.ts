import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from './api'

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  }
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getEmployees はエンドポイントを叩き JSON を返す', async () => {
    const employees = [{ id: 'EMP-001', name: '山田 太郎', hourlyWage: 1200, roundUnitMinutes: 15 }]
    const fetchMock = mockFetchOnce(employees)

    const result = await api.getEmployees()

    expect(fetchMock).toHaveBeenCalledWith('/employees')
    expect(result).toEqual(employees)
  })

  it('clockIn は POST で employeeId を送信する', async () => {
    const fetchMock = mockFetchOnce({})

    await api.clockIn('EMP-001')

    expect(fetchMock).toHaveBeenCalledWith('/attendances/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'EMP-001' }),
    })
  })

  it('clockOut は POST で employeeId を送信する', async () => {
    const fetchMock = mockFetchOnce({})

    await api.clockOut('EMP-001')

    expect(fetchMock).toHaveBeenCalledWith('/attendances/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'EMP-001' }),
    })
  })

  it('getHistory は社員IDを含む履歴エンドポイントを叩く', async () => {
    const logs = [{ id: 1, employeeId: 'EMP-001', clockIn: null, clockOut: null, breakMinutes: 60, isCorrected: false }]
    const fetchMock = mockFetchOnce(logs)

    const result = await api.getHistory('EMP-001')

    expect(fetchMock).toHaveBeenCalledWith('/attendances/EMP-001/history')
    expect(result).toEqual(logs)
  })

  it('getMonthlySummary は year/month をクエリに含める', async () => {
    const fetchMock = mockFetchOnce({})

    await api.getMonthlySummary('EMP-001', 2026, 7)

    expect(fetchMock).toHaveBeenCalledWith('/attendances/EMP-001/monthly?year=2026&month=7')
  })

  it('login は成功時にレスポンスの JSON を返す', async () => {
    mockFetchOnce({ token: 'abc123' }, { ok: true })

    const result = await api.login('admin', 'password')

    expect(result).toEqual({ token: 'abc123' })
  })

  it('login は失敗時（res.ok=false）に空オブジェクトを返す（JSONパースはしない）', async () => {
    mockFetchOnce({ error: 'invalid' }, { ok: false, status: 401 })

    const result = await api.login('admin', 'wrong-password')

    expect(result).toEqual({})
  })

  it('createEmployee は Authorization ヘッダーを付与する', async () => {
    const fetchMock = mockFetchOnce({})

    await api.createEmployee(
      { id: 'EMP-004', name: '鈴木 花子', hourlyWage: 1100, roundUnitMinutes: 5 },
      'token-xyz'
    )

    expect(fetchMock).toHaveBeenCalledWith('/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-xyz' },
      body: JSON.stringify({ id: 'EMP-004', name: '鈴木 花子', hourlyWage: 1100, roundUnitMinutes: 5 }),
    })
  })

  it('deleteEmployee は DELETE メソッドで Authorization ヘッダーのみ付与する', async () => {
    const fetchMock = mockFetchOnce({})

    await api.deleteEmployee('EMP-004', 'token-xyz')

    expect(fetchMock).toHaveBeenCalledWith('/employees/EMP-004', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-xyz' },
    })
  })

  it('correctAttendance は打刻IDのエンドポイントに PUT する', async () => {
    const fetchMock = mockFetchOnce({})
    const req = { clockIn: '2026-07-01T09:00:00.000Z', clockOut: '2026-07-01T18:00:00.000Z', breakMinutes: 60 }

    await api.correctAttendance(1, req, 'token-xyz')

    expect(fetchMock).toHaveBeenCalledWith('/attendances/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-xyz' },
      body: JSON.stringify(req),
    })
  })

  it('demoReset は POST でリセットエンドポイントを叩く', async () => {
    const fetchMock = mockFetchOnce({})

    await api.demoReset()

    expect(fetchMock).toHaveBeenCalledWith('/demo/reset', { method: 'POST' })
  })
})
