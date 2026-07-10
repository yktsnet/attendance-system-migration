import { useState, useEffect } from 'react'
import { api } from '../api'
import type { Employee, AttendanceLog } from '../types'

interface Props {
  employees: Employee[]
  selectedId: string
  setSelectedId: (id: string) => void
}

type ClockStatus = 'loading' | 'none' | 'clocked-in' | 'clocked-out'

const STATUS_LABEL: Record<ClockStatus, string> = {
  loading:       '...',
  none:          '未出勤',
  'clocked-in':  '出勤中',
  'clocked-out': '退勤済',
}

const STATUS_COLOR: Record<ClockStatus, string> = {
  loading:       'text-slate-300',
  none:          'text-slate-400',
  'clocked-in':  'text-emerald-600',
  'clocked-out': 'text-slate-500',
}

export function ClockPanel({ employees, selectedId, setSelectedId }: Props) {
  const [now, setNow]                 = useState(new Date())
  const [clockStatus, setClockStatus] = useState<ClockStatus>('loading')
  const [message, setMessage]         = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading]         = useState<'in' | 'out' | null>(null)
  const [resetting, setResetting]     = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchStatus = (employeeId: string) => {
    setClockStatus('loading')
    setMessage(null)
    api.getHistory(employeeId).then((logs: AttendanceLog[]) => {
      const today = new Date().toDateString()
      const todayLog = logs.find(l => l.clockIn && new Date(l.clockIn).toDateString() === today)
      if (!todayLog)               setClockStatus('none')
      else if (!todayLog.clockOut) setClockStatus('clocked-in')
      else                         setClockStatus('clocked-out')
    })
  }

  useEffect(() => {
    if (!selectedId) return
    fetchStatus(selectedId)
  }, [selectedId])

  const handleClock = async (type: 'in' | 'out') => {
    if (!selectedId) return
    setLoading(type)
    setMessage(null)
    try {
      const res = type === 'in'
        ? await api.clockIn(selectedId)
        : await api.clockOut(selectedId)
      if (res.ok) {
        setClockStatus(type === 'in' ? 'clocked-in' : 'clocked-out')
        setMessage({ ok: true, text: type === 'in' ? '出勤打刻しました' : '退勤打刻しました' })
      } else if (res.status === 409) {
        setMessage({ ok: false, text: '既に出勤打刻済みです' })
      } else {
        setMessage({ ok: false, text: type === 'out' ? '出勤打刻が見つかりません' : '打刻に失敗しました' })
      }
    } catch {
      setMessage({ ok: false, text: '通信エラーが発生しました' })
    } finally {
      setLoading(null)
    }
  }

  const handleDemoReset = async () => {
    setResetting(true)
    setMessage(null)
    try {
      await api.demoReset()
      setMessage({ ok: true, text: 'リセット完了。直近60日を再生成しました' })
      fetchStatus(selectedId)
    } catch {
      setMessage({ ok: false, text: 'リセットに失敗しました' })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-8 relative">

      {/* デモリセット（右上） */}
      <div className="md:absolute top-4 right-4 flex flex-col items-end gap-1 mb-6 md:mb-0">
        <button
          onClick={handleDemoReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400
            border border-slate-200 rounded-md bg-white
            hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300
            transition-colors disabled:opacity-40"
        >
          <span>↺</span>
          <span>{resetting ? '処理中...' : 'デモリセット'}</span>
        </button>
        <span className="text-xs text-slate-300">直近60日を再生成・当日は打刻体験用に空欄</span>
      </div>

      {/* 社員選択 + 状態 */}
      <div className="flex flex-wrap items-center gap-3 mb-8 mt-12 md:mt-0">
        <label className="text-sm text-slate-600 font-medium whitespace-nowrap">社員:</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-xs"
        >
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.id}　{e.name}</option>
          ))}
        </select>
        <span className={`text-sm font-medium ${STATUS_COLOR[clockStatus]}`}>
          {STATUS_LABEL[clockStatus]}
        </span>
      </div>

      {/* 時計 */}
      <div className="text-center mb-10">
        <div className="text-4xl sm:text-5xl font-mono text-slate-800 tracking-wide">
          {now.toLocaleTimeString('ja-JP')}
        </div>
        <div className="text-sm text-slate-500 mt-2">
          {now.toLocaleDateString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
          })}
        </div>
      </div>

      {/* 打刻ボタン */}
      <div className="flex justify-center gap-4 sm:gap-6 mb-4 w-full">
        <button
          onClick={() => handleClock('in')}
          disabled={clockStatus !== 'none' || loading !== null}
          className="flex-1 max-w-[144px] py-4 rounded-lg font-medium text-base transition-colors
            bg-emerald-600 hover:bg-emerald-700 text-white
            disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"
        >
          {loading === 'in' ? '...' : '出勤'}
        </button>
        <button
          onClick={() => handleClock('out')}
          disabled={clockStatus !== 'clocked-in' || loading !== null}
          className="flex-1 max-w-[144px] py-4 rounded-lg font-medium text-base transition-colors
            bg-slate-700 hover:bg-slate-800 text-white
            disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"
        >
          {loading === 'out' ? '...' : '退勤'}
        </button>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`text-sm text-center py-1 ${message.ok ? 'text-emerald-600' : 'text-red-500'}`}>
          {message.ok ? '✓ ' : '✕ '}{message.text}
        </div>
      )}
    </div>
  )
}
