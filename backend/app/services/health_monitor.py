"""
后台服务健康监控
运行独立的 asyncio 任务，定期检测所有依赖服务的可用性
当检测到服务离线时，输出警告日志，但不自动重启（由 PM2 或 start.sh 管理）
"""
from __future__ import annotations

import asyncio
import httpx
import logging
import time
from typing import Callable, Awaitable, Optional, Tuple, Dict, List, Any

from app.core.config import settings

logger = logging.getLogger("health_monitor")


class HealthMonitor:
    """后台健康监控器"""

    # 服务检查配置: (name, url, expected_status, timeout)
    SERVICES: List[Tuple[str, str, int, float]] = [
        ("ollama", f"{settings.OLLAMA_BASE_URL}/api/tags", 200, 5.0),
        ("chromadb", f"{settings.CHROMADB_URL}/api/v1/heartbeat", 200, 5.0),
        ("backend", f"http://localhost:{settings.BACKEND_PORT}/health", 200, 3.0),
    ]

    def __init__(self, check_interval: float = 30.0):
        """
        Args:
            check_interval: 检查间隔（秒）
        """
        self.check_interval = check_interval
        self._running = False
        self._task: Optional[asyncio.Task] = None
        # 当前状态: service_name -> (status: bool, latency_ms: float, last_check: float)
        self._status: Dict[str, Tuple[bool, float, float]] = {}
        self._on_status_change: List[Callable[[str, bool, float], Awaitable[None]]] = []

    def register_callback(self, cb: Callable[[str, bool, float], Awaitable[None]]) -> None:
        """注册状态变更回调"""
        self._on_status_change.append(cb)

    async def check_service(self, name: str, url: str, expected: int, timeout: float) -> Tuple[bool, float]:
        """检查单个服务，返回 (is_healthy, latency_ms)"""
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.get(url)
                latency_ms = (time.perf_counter() - t0) * 1000
                if r.status_code == expected:
                    return True, latency_ms
                return False, latency_ms
        except Exception:
            latency_ms = (time.perf_counter() - t0) * 1000
            return False, latency_ms

    async def check_all(self) -> Dict[str, Tuple[bool, float]]:
        """并行检查所有服务"""
        tasks = [
            self.check_service(name, url, expected, timeout)
            for name, url, expected, timeout in self.SERVICES
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return {
            name: (False, 0.0) if isinstance(r, Exception) else r
            for (name, _, _, _), r in zip(self.SERVICES, results)
        }

    async def _loop(self) -> None:
        """监控循环"""
        logger.info("健康监控已启动 (间隔 %.0f秒)", self.check_interval)
        while self._running:
            results = await self.check_all()
            now = time.time()

            for name, (healthy, latency_ms) in results.items():
                prev = self._status.get(name)
                prev_healthy = prev[0] if prev else None

                self._status[name] = (healthy, latency_ms, now)

                if prev_healthy is None:
                    # 首次检查，只记录
                    if healthy:
                        logger.info("✓ %s 在线 (%.0fms)", name, latency_ms)
                    else:
                        logger.warning("✗ %s 离线", name)

                elif prev_healthy != healthy:
                    # 状态变更
                    if healthy:
                        logger.warning("⚠ %s 已恢复 (%.0fms)", name, latency_ms)
                    else:
                        logger.error("✗ %s 已离线，请手动重启", name)

            await asyncio.sleep(self.check_interval)

    async def start(self) -> None:
        """启动监控任务"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        """停止监控任务"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def get_status(self) -> Dict[str, Dict[str, Any]]:
        """返回当前所有服务的状态快照"""
        now = time.time()
        result = {}
        for name, (healthy, latency_ms, last_check) in self._status.items():
            result[name] = {
                "healthy": healthy,
                "latency_ms": round(latency_ms, 1),
                "last_check": last_check,
                "ago_seconds": round(now - last_check, 1),
            }
        return result


# 全局单例
_monitor: Optional[HealthMonitor] = None


def get_monitor() -> HealthMonitor:
    global _monitor
    if _monitor is None:
        _monitor = HealthMonitor(check_interval=30.0)
    return _monitor


async def start_monitor() -> None:
    """启动全局健康监控（可多次调用）"""
    monitor = get_monitor()
    await monitor.start()


async def stop_monitor() -> None:
    """停止全局健康监控"""
    global _monitor
    if _monitor:
        await _monitor.stop()
        _monitor = None
