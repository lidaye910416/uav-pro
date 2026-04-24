"""YAML 配置文件加载器"""
import yaml
from pathlib import Path
from functools import lru_cache


@lru_cache(maxsize=4)
def load_config(name: str) -> dict:
    """
    加载 YAML 配置文件。
    路径相对于 backend/ 根目录。
    """
    # 在 backend 根目录查找
    backend_root = Path(__file__).parent.parent
    path = backend_root / name
    if not path.exists():
        raise FileNotFoundError(f"配置文件不存在: {path}")
    with open(path) as f:
        return yaml.safe_load(f)
