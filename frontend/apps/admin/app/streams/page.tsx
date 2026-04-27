"use client"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/AuthContext"
import { fetchStreams, addStream, removeStream, startStream, stopStream } from "@/lib/api"

const DEMO_STREAMS = [
  { name: "gal_1 测试视频", path: "/videos/gal_1.mp4", type: "file" },
  { name: "gal_2 测试视频", path: "/videos/gal_2.mp4", type: "file" },
  { name: "gal_3 测试视频", path: "/videos/gal_3.mp4", type: "file" },
]

export default function StreamsPage() {
  const { user } = useAuth()
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", source_type: "file", source_path: "", auto_analyze: false, interval_sec: 5 })
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!user) return
    try { setStreams(await fetchStreams(user.token)) } catch { /* */ }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.name || !form.source_path || !user) { setError("请填写完整信息"); return }
    try {
      await addStream(user.token, form)
      setShowAdd(false)
      setForm({ name: "", source_type: "file", source_path: "", auto_analyze: false, interval_sec: 5 })
      load()
    } catch (e: any) { setError(e.message) }
  }

  async function handleRemove(id: string) {
    if (!confirm("确认删除此流？") || !user) return
    await removeStream(user.token, id)
    load()
  }

  async function handleStart(id: string) {
    if (!user) return
    await startStream(user.token, id)
    load()
  }

  async function handleStop(id: string) {
    if (!user) return
    await stopStream(user.token, id)
    load()
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider">感知流管理</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>注册视频文件 / RTSP 流，持续提取帧并触发分析</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all hover:brightness-110"
          style={{ background: showAdd ? "var(--bg-card)" : "var(--accent-amber)", color: showAdd ? "var(--text-secondary)" : "#000", border: `1px solid ${showAdd ? "var(--border)" : "var(--accent-amber)"}` }}>
          {showAdd ? "取消" : "+ 注册新流"}
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl p-5 mb-6 animate-fade-in" style={{ background: "var(--bg-card)", border: "1px solid var(--accent-amber)30" }}>
          <div className="font-mono text-base font-bold mb-4" style={{ color: "var(--accent-amber)" }}>注册新感知流</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-mono mb-1 block" style={{ color: "var(--text-secondary)" }}>流名称</label>
              <input className="w-full px-3 py-2 rounded-lg text-sm font-mono" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如: 高速公路-东向西"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
            </div>
            <div>
              <label className="text-sm font-mono mb-1 block" style={{ color: "var(--text-secondary)" }}>源类型</label>
              <select className="w-full px-3 py-2 rounded-lg text-sm font-mono" value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}>
                <option value="file">本地视频文件</option>
                <option value="rtsp">RTSP 视频流</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-mono mb-1 block" style={{ color: "var(--text-secondary)" }}>路径 / URL</label>
              <input className="w-full px-3 py-2 rounded-lg text-sm font-mono" value={form.source_path} onChange={e => setForm({ ...form, source_path: e.target.value })} placeholder={form.source_type === "rtsp" ? "rtsp://..." : "/app/data/streams/video.mp4"}
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
            </div>
            <div>
              <label className="text-sm font-mono mb-1 block" style={{ color: "var(--text-secondary)" }}>分析间隔 (秒)</label>
              <input className="w-full px-3 py-2 rounded-lg text-sm font-mono" type="number" min="1" max="60" value={form.interval_sec} onChange={e => setForm({ ...form, interval_sec: Number(e.target.value) })}
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={form.auto_analyze} onChange={e => setForm({ ...form, auto_analyze: e.target.checked })} />
                启用自动分析
              </label>
            </div>
          </div>
          {error && <p className="text-sm mt-2" style={{ color: "var(--accent-red)" }}>{error}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all hover:brightness-110"
              style={{ background: "var(--accent-amber)", color: "#000" }}>确认注册</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-mono transition-all"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>取消</button>
          </div>
        </div>
      )}

      {/* Quick add */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="font-mono text-sm font-bold mb-3" style={{ color: "var(--text-muted)" }}>快速添加</div>
        <div className="flex gap-2 flex-wrap">
          {DEMO_STREAMS.map((d) => (
            <button key={d.path}
              onClick={async () => { try { await addStream(user!.token, { name: d.name, source_type: d.type, source_path: d.path, auto_analyze: false, interval_sec: 5 }); load() } catch { /* */ } }}
              className="px-3 py-1.5 rounded-lg text-sm font-mono transition-all hover:brightness-110"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              + {d.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-sm font-mono" style={{ color: "var(--text-muted)" }}>◈ 加载中…</div>
      ) : streams.length === 0 ? (
        <div className="rounded-xl text-center py-16" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-3 opacity-20">◎</div>
          <div className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>暂无感知流，请先注册</div>
        </div>
      ) : (
        <div className="space-y-4">
          {streams.map((s) => (
            <div key={s.id} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm" style={{ color: "var(--accent-amber)" }}>{s.name}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: s.status === "running" ? "rgba(0,229,160,0.1)" : "var(--bg-primary)", color: s.status === "running" ? "var(--accent-green)" : "var(--text-muted)" }}>
                    {s.status === "running" ? "运行中" : "已停止"}
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>ID: {s.id}</span>
              </div>
              <div className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                类型: {s.source_type} · 路径: {s.source_path} · 间隔: {s.interval_sec}s · 自动: {s.auto_analyze ? "启用" : "禁用"}
                {s.last_frame_ts && <> · 最后帧: {new Date(s.last_frame_ts * 1000).toLocaleTimeString()}</>}
              </div>
              <div className="flex gap-2">
                {s.status === "running" ? (
                  <button onClick={() => handleStop(s.id)}
                    className="px-3 py-1.5 rounded-lg text-sm font-mono transition-all hover:brightness-110"
                    style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent-red)" }}>停止</button>
                ) : (
                  <button onClick={() => handleStart(s.id)}
                    className="px-3 py-1.5 rounded-lg text-sm font-mono transition-all hover:brightness-110"
                    style={{ background: "var(--accent-amber)", color: "#000" }}>启动感知</button>
                )}
                <button onClick={() => handleRemove(s.id)}
                  className="px-3 py-1.5 rounded-lg text-sm font-mono transition-all"
                  style={{ border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent-red)" }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
