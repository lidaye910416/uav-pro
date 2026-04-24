export default function DevicesPage() {
  const devices = [
    { id: "UAV-001", name: "巡检无人机A", type: "uav", status: "online", battery: 87 },
    { id: "UAV-002", name: "巡检无人机B", type: "uav", status: "offline", battery: 0 },
    { id: "CAM-001", name: "K120摄像头", type: "camera", status: "online", battery: null },
  ]

  const statusColors: Record<string, string> = {
    online: "bg-green-100 text-green-700",
    offline: "bg-gray-100 text-gray-500",
    error: "bg-red-100 text-red-700",
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">设备管理</h1>
        <button className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm">
          + 添加设备
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-500">
              <th className="px-6 py-3 font-medium">设备ID</th>
              <th className="px-6 py-3 font-medium">名称</th>
              <th className="px-6 py-3 font-medium">类型</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">电量</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-600">{device.id}</td>
                <td className="px-6 py-4 font-medium">{device.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{device.type}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[device.status]}`}>
                    {device.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {device.battery !== null ? `${device.battery}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
