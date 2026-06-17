import { useState } from 'react'
import { api } from '../api'
import type { AttendanceLog } from '../types'

interface Props {
  log: AttendanceLog
  employeeName: string
  token: string
  onClose: () => void
  onSaved: () => void
}

/** ISO文字列 → datetime-local input用ローカル時刻文字列 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d   = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

function fmtJst(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit', day: '2-digit',
    hour:  '2-digit', minute: '2-digit',
  })
}

const BASE_BREAK_MINUTES = 60

export function AttendanceCorrectionModal({
  log, employeeName, token, onClose, onSaved,
}: Props) {
  const [clockIn,           setClockIn]           = useState(toDatetimeLocal(log.clockIn))
  const [clockOut,          setClockOut]          = useState(toDatetimeLocal(log.clockOut))
  const [adjustmentMinutes, setAdjustmentMinutes] = useState(log.breakMinutes - BASE_BREAK_MINUTES)
  const [error,             setError]             = useState('')
  const [saving,            setSaving]            = useState(false)

  const actualBreak = BASE_BREAK_MINUTES + adjustmentMinutes

  const handleSave = async () => {
    if (!clockIn || !clockOut)   { setError('出勤・退勤時刻は両方必須です。'); return }
    if (clockIn >= clockOut)     { setError('退勤は出勤より後の時刻にしてください。'); return }
    if (actualBreak < 0)         { setError('休憩時間は 0分 以上にしてください。'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.correctAttendance(
        log.id,
        {
          clockIn:      new Date(clockIn).toISOString(),
          clockOut:     new Date(clockOut).toISOString(),
          breakMinutes: actualBreak,
        },
        token
      )
      if (res.ok) {
        onSaved()
      } else {
        setError('修正に失敗しました。')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-slate-800 mb-1">打刻修正</h3>
        <p className="text-sm text-slate-500 mb-4">
          {employeeName}　
          <span className="font-mono text-xs text-slate-400">#{log.id}</span>
        </p>

        {/* 現在値 */}
        <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-600 mb-4 space-y-1">
          <div>現在の出勤: <span className="font-mono">{fmtJst(log.clockIn)}</span></div>
          <div>現在の退勤: <span className="font-mono">{fmtJst(log.clockOut)}</span></div>
          <div>現在の休憩: <span className="font-mono">{log.breakMinutes}分</span></div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              修正後 出勤時刻
            </label>
            <input
              type="datetime-local"
              value={clockIn}
              onChange={e => setClockIn(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              修正後 退勤時刻
            </label>
            <input
              type="datetime-local"
              value={clockOut}
              onChange={e => setClockOut(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 休憩調整 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              休憩調整（申請 {BASE_BREAK_MINUTES}分 ± 分）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={adjustmentMinutes}
                onChange={e => setAdjustmentMinutes(Number(e.target.value))}
                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                min={-BASE_BREAK_MINUTES}
                max={180}
              />
              <span className="text-sm text-slate-500">
                分　→　実際の休憩:
                <span className={`ml-1 font-mono font-semibold ${
                  actualBreak < 0 ? 'text-red-600' : 'text-slate-800'
                }`}>
                  {actualBreak}分
                </span>
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300
                       rounded-lg hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg
                       hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {saving ? '保存中...' : '修正を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
