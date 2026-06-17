import { useState, useEffect } from 'react'
import { api } from '../api'
import type { MonthlySummary as Summary } from '../types'

interface Props {
  employeeId: string
  employeeName: string
}

export function MonthlySummary({ employeeId, employeeName }: Props) {
  const now = new Date()
  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!employeeId) return
    setLoading(true)
    api.getMonthlySummary(employeeId, year, month)
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [employeeId, year, month])

  const prev = () => month === 1 ? (setYear(y => y - 1), setMonth(12)) : setMonth(m => m - 1)
  const next = () => month === 12 ? (setYear(y => y + 1), setMonth(1))  : setMonth(m => m + 1)

  const downloadCsv = async () => {
    if (!employeeId) return
    const res  = await api.downloadCsv(employeeId, year, month)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance_${employeeId}_${year}${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = [
    { label: '出勤日数', value: summary ? `${summary.workDays} 日` : '-' },
    { label: '合計勤務', value: summary ? `${summary.totalHours} h` : '-' },
    { label: '残業時間', value: summary ? `${summary.overtimeHours} h` : '-' },
  ]

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-slate-700 font-semibold">月次サマリー</h2>
          <p className="text-xs text-slate-400 mt-0.5">対象: {employeeId}　{employeeName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm self-end sm:self-auto">
          <button onClick={prev} className="px-2 text-slate-400 hover:text-slate-700 text-lg">‹</button>
          <span className="font-medium text-slate-700 w-24 text-center">{year}年{month}月</span>
          <button onClick={next} className="px-2 text-slate-400 hover:text-slate-700 text-lg">›</button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm text-center py-6">読み込み中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {stats.map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                <div className="text-2xl font-semibold text-slate-800">{s.value}</div>
              </div>
            ))}
          </div>
          <button
            onClick={downloadCsv}
            disabled={!employeeId}
            className="w-full border border-emerald-600 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            月次CSVダウンロード
          </button>
        </>
      )}
    </div>
  )
}
