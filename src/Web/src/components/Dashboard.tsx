import { useState, useEffect, useCallback, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { api } from '../api'
import type { CurrentAttendance } from '../types'

interface Props {
  isAdmin: boolean
}

interface AlertItem {
  id:          string
  type:        'overtime' | 'lateStay'
  message:     string
  receivedAt:  Date
}

const BASE = import.meta.env.VITE_API_URL ?? ''

export function Dashboard({ isAdmin }: Props) {
  const [current,   setCurrent]   = useState<CurrentAttendance[]>([])
  const [alerts,    setAlerts]    = useState<AlertItem[]>([])
  const [connected, setConnected] = useState(false)
  const connRef = useRef<signalR.HubConnection | null>(null)

  const loadCurrent = useCallback(async () => {
    const data = await api.getCurrentAttendance()
    setCurrent(data)
  }, [])

  // SignalR 接続 (マウント時1回)
  useEffect(() => {
    loadCurrent()

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE}/hubs/attendance`)
      .withAutomaticReconnect()
      .build()

    conn.on('ClockUpdate', () => {
      loadCurrent()
    })

    conn.on('OvertimeAlert', (data: {
      employeeId: string
      employeeName: string
      overtimeHours: number
      threshold: number
    }) => {
      setAlerts(prev => [{
        id:         `ot-${data.employeeId}-${Date.now()}`,
        type:       'overtime' as const,
        message:    `${data.employeeName}: 今月の残業 ${data.overtimeHours}h が ${data.threshold}h を超過`,
        receivedAt: new Date(),
      }, ...prev].slice(0, 20))
    })

    conn.on('LateStayAlert', (data: {
      employeeId: string
      employeeName: string
      avgClockout: string
    }) => {
      setAlerts(prev => [{
        id:         `ls-${data.employeeId}-${Date.now()}`,
        type:       'lateStay' as const,
        message:    `${data.employeeName}: 平均退勤 ${data.avgClockout} から1時間超過（未退勤）`,
        receivedAt: new Date(),
      }, ...prev].slice(0, 20))
    })

    conn.start()
      .then(() => setConnected(true))
      .catch(err => console.error('SignalR:', err))

    connRef.current = conn
    return () => { conn.stop() }
  }, [loadCurrent])

  // 管理者グループ参加・離脱
  useEffect(() => {
    const conn = connRef.current
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return
    if (isAdmin) {
      conn.invoke('JoinAdminGroup').catch(() => {})
    } else {
      conn.invoke('LeaveAdminGroup').catch(() => {})
    }
  }, [isAdmin, connected])

  const dismissAlert = (id: string) =>
    setAlerts(prev => prev.filter(a => a.id !== id))

  return (
    <div className="space-y-6">

      {/* 接続状態 */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
        {connected ? 'WebSocket 接続中' : '接続中...'}
      </div>

      {/* リアルタイム出勤ボード */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">リアルタイム出勤ボード</h2>
        {current.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            現在出勤中の社員はいません
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {current.map(emp => (
              <div
                key={emp.employeeId}
                className="bg-white rounded-xl border border-emerald-200 px-4 py-3 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <span className="font-medium text-slate-800 text-sm truncate">{emp.employeeName}</span>
                </div>
                <div className="text-xs text-slate-400 font-mono pl-4">
                  {new Date(emp.clockIn).toLocaleTimeString('ja-JP', {
                    hour: '2-digit', minute: '2-digit',
                  })} 出勤
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 管理者アラート */}
      {isAdmin ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">
              管理者アラート
              {alerts.length > 0 && (
                <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-normal">
                  {alerts.length}
                </span>
              )}
            </h2>
            {alerts.length > 0 && (
              <button
                onClick={() => setAlerts([])}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                全て削除
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
              アラートなし
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${
                    alert.type === 'overtime'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50   border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-base mt-0.5 flex-shrink-0">
                      {alert.type === 'overtime' ? '⚠️' : '🔴'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {alert.receivedAt.toLocaleTimeString('ja-JP')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <p className="text-xs text-slate-400 text-center">
          管理者ログイン後、36協定アラート・未退勤アラートを受信できます
        </p>
      )}

      {/* Before/After デモポイント */}
      <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100 leading-relaxed">
        <span className="font-medium text-slate-500">After のポイント: </span>
        WebForms はサーバー Push が構造的に不可能（出勤状況確認にページリロード必須）。
        .NET 8 SignalR により打刻を即時配信。未退勤・36協定超過は当日中に管理者へ自動 Push。
      </div>
    </div>
  )
}
