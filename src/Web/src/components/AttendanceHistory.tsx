import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { AttendanceLog } from '../types'
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal'

interface Props {
  employeeId: string
  employeeName: string
  isAdmin: boolean
  token: string | null
}

function calcHours(log: AttendanceLog): string {
  if (!log.clockIn || !log.clockOut) return '—'
  const diff =
    (new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / 3_600_000
    - log.breakMinutes / 60
  return `${Math.max(0, diff).toFixed(1)}h`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d   = new Date(iso)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${dow})`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit',
  })
}

export function AttendanceHistory({ employeeId, employeeName, isAdmin, token }: Props) {
  const now = new Date()
  const [logs,        setLogs]        = useState<AttendanceLog[]>([])
  const [correcting,  setCorrecting]  = useState<AttendanceLog | null>(null)
  const [csvYear,     setCsvYear]     = useState(now.getFullYear())
  const [csvMonth,    setCsvMonth]    = useState(now.getMonth() + 1)
  const [csvLoading,  setCsvLoading]  = useState(false)

  const load = useCallback(() => {
    if (!employeeId) return
    api.getHistory(employeeId).then(setLogs)
  }, [employeeId])

  useEffect(() => { load() }, [load])

  const handleCsvDownload = async () => {
    setCsvLoading(true)
    try {
      const res = await api.downloadCsv(employeeId, csvYear, csvMonth)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `attendance_${employeeId}_${csvYear}${String(csvMonth).padStart(2, '0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setCsvLoading(false)
    }
  }

  if (!employeeId) {
    return <p className="text-slate-500 text-sm">社員を選択してください。</p>
  }

  return (
    <div>
      {/* ヘッダー: タイトル + CSVダウンロード */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          打刻履歴 — {employeeName}
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <input
            type="number"
            value={csvYear}
            onChange={e => setCsvYear(Number(e.target.value))}
            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded text-right
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
            min={2020}
            max={2099}
          />
          <span className="text-slate-500 text-sm">年</span>
          <input
            type="number"
            value={csvMonth}
            onChange={e => setCsvMonth(Math.min(12, Math.max(1, Number(e.target.value))))}
            className="w-14 px-2 py-1 text-sm border border-slate-300 rounded text-right
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
            min={1}
            max={12}
          />
          <span className="text-slate-500 text-sm">月</span>
          <button
            onClick={handleCsvDownload}
            disabled={csvLoading}
            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded
                       hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {csvLoading ? 'DL中...' : 'CSV'}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-slate-500 text-sm">打刻履歴がありません。</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left   text-slate-600 font-medium">日付</th>
                <th className="px-4 py-3 text-right  text-slate-600 font-medium">出勤</th>
                <th className="px-4 py-3 text-right  text-slate-600 font-medium">退勤</th>
                <th className="px-4 py-3 text-right  text-slate-600 font-medium">休憩</th>
                <th className="px-4 py-3 text-right  text-slate-600 font-medium">勤務時間</th>
                <th className="px-4 py-3 text-center text-slate-600 font-medium">フラグ</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-center text-slate-600 font-medium">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(log => (
                <tr
                  key={log.id}
                  className={`transition-colors hover:bg-slate-50 ${
                    log.isCorrected ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-slate-700">{fmtDate(log.clockIn)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {fmtTime(log.clockIn)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {fmtTime(log.clockOut)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 text-xs">
                    {log.breakMinutes}分
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{calcHours(log)}</td>
                  <td className="px-4 py-3 text-center">
                    {log.isCorrected && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                        修正済
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setCorrecting(log)}
                        className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded
                                   hover:bg-amber-100 hover:text-amber-700 transition-colors"
                      >
                        修正
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {correcting && token && (
        <AttendanceCorrectionModal
          log={correcting}
          employeeName={employeeName}
          token={token}
          onClose={() => setCorrecting(null)}
          onSaved={() => { setCorrecting(null); load() }}
        />
      )}
    </div>
  )
}
