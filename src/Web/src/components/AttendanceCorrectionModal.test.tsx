import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal'
import { api } from '../api'
import type { AttendanceLog } from '../types'

vi.mock('../api', () => ({
  api: {
    correctAttendance: vi.fn(),
  },
}))

const baseLog: AttendanceLog = {
  id: 42,
  employeeId: 'EMP-001',
  clockIn: '2026-07-01T00:00:00.000Z',
  clockOut: '2026-07-01T09:00:00.000Z',
  breakMinutes: 60,
  isCorrected: false,
}

function setup(log: AttendanceLog = baseLog) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <AttendanceCorrectionModal
      log={log}
      employeeName="山田 太郎"
      token="token-xyz"
      onClose={onClose}
      onSaved={onSaved}
    />
  )
  return { onClose, onSaved }
}

describe('AttendanceCorrectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('出勤・退勤時刻が空の場合は保存せずエラーを表示する', async () => {
    const user = userEvent.setup()
    const { onSaved } = setup()

    const clockInInput = screen.getByLabelText('修正後 出勤時刻')
    await user.clear(clockInInput)
    await user.click(screen.getByRole('button', { name: '修正を保存' }))

    expect(await screen.findByText('出勤・退勤時刻は両方必須です。')).toBeInTheDocument()
    expect(api.correctAttendance).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('退勤が出勤より前の場合はエラーを表示する', async () => {
    const user = userEvent.setup()
    setup()

    const clockInInput = screen.getByLabelText('修正後 出勤時刻') as HTMLInputElement
    const clockOutInput = screen.getByLabelText('修正後 退勤時刻') as HTMLInputElement

    await user.clear(clockInInput)
    await user.type(clockInInput, '2026-07-01T18:00')
    await user.clear(clockOutInput)
    await user.type(clockOutInput, '2026-07-01T09:00')
    await user.click(screen.getByRole('button', { name: '修正を保存' }))

    expect(await screen.findByText('退勤は出勤より後の時刻にしてください。')).toBeInTheDocument()
    expect(api.correctAttendance).not.toHaveBeenCalled()
  })

  it('休憩調整により実際の休憩がマイナスになる場合はエラーを表示する', async () => {
    const user = userEvent.setup()
    setup()

    const adjustmentInput = screen.getByLabelText(/休憩調整/)
    fireEvent.change(adjustmentInput, { target: { value: '-120' } })
    await user.click(screen.getByRole('button', { name: '修正を保存' }))

    expect(await screen.findByText('休憩時間は 0分 以上にしてください。')).toBeInTheDocument()
    expect(api.correctAttendance).not.toHaveBeenCalled()
  })

  it('正常な入力では correctAttendance を呼び出し保存後に onSaved を呼ぶ', async () => {
    const user = userEvent.setup()
    vi.mocked(api.correctAttendance).mockResolvedValue({ ok: true } as Response)
    const { onSaved } = setup()

    await user.click(screen.getByRole('button', { name: '修正を保存' }))

    expect(api.correctAttendance).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ breakMinutes: 60 }),
      'token-xyz'
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('保存APIが失敗した場合はエラーメッセージを表示し onSaved を呼ばない', async () => {
    const user = userEvent.setup()
    vi.mocked(api.correctAttendance).mockResolvedValue({ ok: false } as Response)
    const { onSaved } = setup()

    await user.click(screen.getByRole('button', { name: '修正を保存' }))

    expect(await screen.findByText('修正に失敗しました。')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('キャンセルボタンで onClose が呼ばれる', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onClose).toHaveBeenCalled()
  })
})
