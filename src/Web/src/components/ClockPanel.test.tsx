import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClockPanel } from './ClockPanel'
import { api } from '../api'
import type { Employee, AttendanceLog } from '../types'

vi.mock('../api', () => ({
  api: {
    getHistory: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
    demoReset: vi.fn(),
  },
}))

const employees: Employee[] = [
  { id: 'EMP-001', name: '山田 太郎', hourlyWage: 1200, roundUnitMinutes: 15 },
]

function setup(logs: AttendanceLog[]) {
  vi.mocked(api.getHistory).mockResolvedValue(logs)
  return render(
    <ClockPanel employees={employees} selectedId="EMP-001" setSelectedId={() => {}} />
  )
}

describe('ClockPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('本日の打刻がない場合、出勤ボタンのみ活性化される', async () => {
    setup([])

    expect(await screen.findByText('未出勤')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '出勤' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '退勤' })).toBeDisabled()
  })

  it('出勤済み・未退勤の場合、退勤ボタンのみ活性化される', async () => {
    const today = new Date().toISOString()
    setup([{ id: 1, employeeId: 'EMP-001', clockIn: today, clockOut: null, breakMinutes: 60, isCorrected: false }])

    expect(await screen.findByText('出勤中')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '出勤' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '退勤' })).toBeEnabled()
  })

  it('退勤済みの場合、両方のボタンが不活性になる', async () => {
    const today = new Date().toISOString()
    setup([{ id: 1, employeeId: 'EMP-001', clockIn: today, clockOut: today, breakMinutes: 60, isCorrected: false }])

    expect(await screen.findByText('退勤済')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '出勤' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '退勤' })).toBeDisabled()
  })

  it('出勤打刻が成功すると状態が「出勤中」に変わりメッセージが表示される', async () => {
    const user = userEvent.setup()
    setup([])
    vi.mocked(api.clockIn).mockResolvedValue({ ok: true, status: 200 } as Response)

    await screen.findByText('未出勤')
    await user.click(screen.getByRole('button', { name: '出勤' }))

    await waitFor(() => expect(screen.getByText('出勤中')).toBeInTheDocument())
    expect(screen.getByText('✓ 出勤打刻しました')).toBeInTheDocument()
  })

  it('出勤打刻が409で失敗すると重複エラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    setup([])
    vi.mocked(api.clockIn).mockResolvedValue({ ok: false, status: 409 } as Response)

    await screen.findByText('未出勤')
    await user.click(screen.getByRole('button', { name: '出勤' }))

    expect(await screen.findByText('✕ 既に出勤打刻済みです')).toBeInTheDocument()
  })

  it('打刻APIが例外を投げると通信エラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    setup([])
    vi.mocked(api.clockIn).mockRejectedValue(new Error('network down'))

    await screen.findByText('未出勤')
    await user.click(screen.getByRole('button', { name: '出勤' }))

    expect(await screen.findByText('✕ 通信エラーが発生しました')).toBeInTheDocument()
  })
})
