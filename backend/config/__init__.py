"""配置管理模块"""
from config.loader import load_config

llm_config = load_config("config/llm.yaml")
pipeline_config = load_config("config/pipeline.yaml")
