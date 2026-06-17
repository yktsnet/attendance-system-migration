import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { Employee } from '../types'

interface Props {
  token: string
}

interface FormData {
  id: string
  name: string
  hourlyWage: number
  roundUnitMinutes: number
}

const EMPTY: FormData = { id: '', name: '', hourlyWage: 1000, roundUnitMinutes: 1 }
const ROUND_OPTIONS   = [1, 5, 10, 15, 30]

export function EmployeeManager({ token }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [modal, setModal]         = useState<'add' | 'edit' | null>(null)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState<FormData>(EMPTY)
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const load = useCallback(() => {
    api.getEmployees().then(setEmployees)
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm(EMPTY)
    setEditId(null)
    setError('')
    setModal('add')
  }

  const openEdit = (emp: Employee) => {
    setForm({
      id: emp.id,
      name: emp.name,
      hourlyWage: emp.hourlyWage,
      roundUnitMinutes: emp.roundUnitMinutes,
    })
    setEditId(emp.id)
    setError('')
    setModal('edit')
  }

  const closeModal = () => setModal(null)

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？\n関連する打刻履歴も全て削除されます。`)) return
    await api.deleteEmployee(id, token)
    load()
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (modal === 'add') {
        const res = await api.createEmployee(
          {
            id: form.id,
            name: form.name,
            hourlyWage: Number(form.hourlyWage),
            roundUnitMinutes: Number(form.roundUnitMinutes),
          },
          token
        )
        if (!res.ok) {
          setError('登録失敗（IDが重複している可能性があります）。')
          return
        }
      } else if (modal === 'edit' && editId) {
        const res = await api.updateEmployee(
          editId,
          {
            name: form.name,
            hourlyWage: Number(form.hourlyWage),
            roundUnitMinutes: Number(form.roundUnitMinutes),
          },
          token
        )
        if (!res.ok) { setError('更新に失敗しました。'); return }
      }
      closeModal()
      load()
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    form.name.trim() !== '' &&
    (modal === 'edit' || form.id.trim() !== '') &&
    form.hourlyWage > 0

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">社員管理</h2>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg
                     hover:bg-emerald-700 transition-colors"
        >
          ＋ 社員追加
        </button>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left   text-slate-600 font-medium">ID</th>
              <th className="px-4 py-3 text-left   text-slate-600 font-medium">名前</th>
              <th className="px-4 py-3 text-right  text-slate-600 font-medium">時給</th>
              <th className="px-4 py-3 text-right  text-slate-600 font-medium">丸め単位</th>
              <th className="px-4 py-3 text-center text-slate-600 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-500 text-xs">{emp.id}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{emp.name}</td>
                <td className="px-4 py-3 text-right text-slate-700">
                  ¥{emp.hourlyWage.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {emp.roundUnitMinutes}分
                </td>
                <td className="px-4 py-3 text-center space-x-2">
                  <button
                    onClick={() => openEdit(emp)}
                    className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded
                               hover:bg-slate-200 transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(emp.id, emp.name)}
                    className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded
                               hover:bg-red-100 transition-colors"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* モーダル */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-800 mb-5">
              {modal === 'add' ? '社員追加' : '社員情報編集'}
            </h3>

            <div className="space-y-4">
              {modal === 'add' && (
                <Field label="社員ID">
                  <input
                    type="text"
                    value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                    placeholder="EMP-004"
                    className={inputCls}
                  />
                </Field>
              )}

              <Field label="名前">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="山田 太郎"
                  className={inputCls}
                />
              </Field>

              <Field label="時給（円）">
                <input
                  type="number"
                  value={form.hourlyWage}
                  onChange={e => setForm(f => ({ ...f, hourlyWage: Number(e.target.value) }))}
                  min={900}
                  className={inputCls}
                />
              </Field>

              <Field label="丸め単位">
                <select
                  value={form.roundUnitMinutes}
                  onChange={e =>
                    setForm(f => ({ ...f, roundUnitMinutes: Number(e.target.value) }))
                  }
                  className={inputCls}
                >
                  {ROUND_OPTIONS.map(v => (
                    <option key={v} value={v}>{v}分</option>
                  ))}
                </select>
              </Field>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300
                           rounded-lg hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg
                           hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
