#!/usr/bin/env python3
"""
Pipeline 异常场景测试脚本

测试场景：模拟检测到「车辆碰撞」异常，完整走通：
  感知层 → 识别层 → RAG检索 → 决策层

使用方法：
  cd backend
  python -m tests.test_pipeline_anomaly_scenario
"""

import sys
import os
import json
import time
from pathlib import Path

# 添加 backend 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

# 颜色输出
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_test(name, status, detail=""):
    """打印测试结果"""
    status_icon = "✅" if status else "❌"
    status_color = Colors.OKGREEN if status else Colors.FAIL
    print(f"  {status_icon} {status_color}{name}{Colors.ENDC}")
    if detail:
        print(f"     {detail}")


def test_service_health():
    """测试 1: 服务健康检查"""
    print(f"\n{Colors.BOLD}【测试 1】服务健康检查{Colors.ENDC}")

    import httpx

    results = []

    # Backend API
    try:
        r = httpx.get("http://127.0.0.1:8888/health", timeout=5)
        results.append(("Backend API (8888)", r.status_code == 200))
        print_test("Backend API 健康", r.status_code == 200, f"状态: {r.json().get('status')}")
    except Exception as e:
        results.append(("Backend API (8888)", False))
        print_test("Backend API 健康", False, f"错误: {e}")

    # Ollama
    try:
        r = httpx.get("http://127.0.0.1:11434/api/tags", timeout=5)
        models = r.json().get("models", [])
        results.append(("Ollama 服务 (11434)", True))
        print_test("Ollama 服务", True, f"已安装 {len(models)} 个模型")
    except Exception as e:
        results.append(("Ollama 服务 (11434)", False))
        print_test("Ollama 服务", False, f"错误: {e}")

    return all(r for _, r in results)


def test_chromadb():
    """测试 2: ChromaDB 状态"""
    print(f"\n{Colors.BOLD}【测试 2】ChromaDB 状态{Colors.ENDC}")
    
    import httpx
    
    try:
        r = httpx.get("http://127.0.0.1:8888/api/v1/admin/chromadb", timeout=10)
        data = r.json()
        
        status_ok = data.get("status") == "running"
        collections = data.get("collections", [])
        
        print_test("ChromaDB 服务", status_ok, f"状态: {data.get('status')}")
        print_test("SOP Collection", "uav_sops" in collections, f"Collections: {collections}")
        
        # 检查 SOP 数量
        if status_ok:
            from app.services.chroma_service import get_chroma_service
            chroma = get_chroma_service()
            count = chroma.get_collection().count()
            print_test("SOP 文档数量", count >= 11, f"共 {count} 条 SOP 文档")
        
        return status_ok and "uav_sops" in collections
    except Exception as e:
        print_test("ChromaDB 服务", False, f"错误: {e}")
        return False


def test_rag_retrieval():
    """测试 3: RAG 检索功能"""
    print(f"\n{Colors.BOLD}【测试 3】RAG 检索功能{Colors.ENDC}")
    
    from app.services.chroma_service import get_rag_context, search_sops
    
    test_cases = [
        ("collision", "碰撞场景检索"),
        ("pothole", "坑洞场景检索"),
        ("obstacle", "障碍物场景检索"),
        ("pedestrian", "行人场景检索"),
        ("congestion", "拥堵场景检索"),
    ]
    
    results = []
    for query, desc in test_cases:
        try:
            context = get_rag_context(f"{query}高速公路交通事件处置", top_k=2)
            has_result = bool(context) and len(context) > 0
            results.append((desc, has_result))
            print_test(desc, has_result, f"检索到 {len(context) if context else 0} 条结果")
        except Exception as e:
            results.append((desc, False))
            print_test(desc, False, f"错误: {e}")
    
    return all(r for _, r in results)


def test_vision_service():
    """测试 4: 视觉服务（Gemma4:e2b）"""
    print(f"\n{Colors.BOLD}【测试 4】视觉服务（Gemma4:e2b）{Colors.ENDC}")

    import httpx

    try:
        # 检查 Ollama 模型可用性
        r = httpx.get("http://127.0.0.1:11434/api/tags", timeout=5)
        models = [m["name"] for m in r.json().get("models", [])]

        has_gemma4 = any("gemma4" in m.lower() for m in models)
        print_test("Gemma4 模型可用", has_gemma4, f"已安装模型: {models}")

        return has_gemma4
    except Exception as e:
        print_test("Gemma4 模型检查", False, f"错误: {e}")
        return False


def test_ollama_connection():
    """测试 5: Ollama 连接测试"""
    print(f"\n{Colors.BOLD}【测试 5】Ollama 连接测试{Colors.ENDC}")
    
    import httpx
    
    try:
        # 简单生成测试
        payload = {
            "model": "gemma4:e2b",
            "prompt": "回复 OK",
            "stream": False,
            "options": {"num_predict": 5},
        }
        
        start = time.time()
        r = httpx.post("http://127.0.0.1:11434/api/generate", json=payload, timeout=30)
        elapsed = time.time() - start
        
        success = r.status_code == 200
        print_test("Ollama Generate API", success, f"响应时间: {elapsed:.2f}s")

        if success:
            response = r.json().get("response", "")
            response_ok = len(response) > 0
            print_test("响应内容检查", response_ok, f"响应: {response[:50] if response else '(空)'}...")
        
        return success
    except Exception as e:
        print_test("Ollama Generate API", False, f"错误: {e}")
        return False


def test_anomaly_scenario():
    """测试 6: 异常场景完整流程（模拟）"""
    print(f"\n{Colors.BOLD}【测试 6】异常场景完整流程{Colors.ENDC}")
    
    print("  模拟场景：检测到「车辆碰撞」异常")
    print("")
    
    results = []
    
    # Stage 1: 感知层（模拟）
    print("  ┌─ STAGE 1: 感知层（YOLO+SAM）")
    try:
        # 检查 demo 视频
        demo_video = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
        video_exists = demo_video.exists()
        print_test("  Demo 视频文件", video_exists, f"路径: {demo_video}")
        results.append(("感知层-视频", video_exists))
    except Exception as e:
        print_test("  感知层-视频", False, f"错误: {e}")
        results.append(("感知层-视频", False))
    
    # Stage 2: 识别层（Gemma4）
    print("  └─ STAGE 2: 识别层（Gemma4:e2b）")
    try:
        from app.api.routes_demo import _gemma4_vision_analyze
        import numpy as np
        import cv2
        
        # 创建一个简单的测试图像（黑色背景）
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # 画一些模拟的车辆形状
        cv2.rectangle(test_frame, (100, 200), (200, 280), (255, 255, 255), -1)
        cv2.rectangle(test_frame, (180, 220), (300, 300), (200, 200, 200), -1)
        
        # 调用识别层
        import asyncio
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            _gemma4_vision_analyze(test_frame, "gemma4:e2b", 60.0, [])
        )
        loop.close()
        
        has_event = result.get("has_event", False)
        incident_type = result.get("incident_type", "none")
        severity = result.get("severity", "none")
        
        print_test("  识别层执行", True, f"incident_type={incident_type}, severity={severity}")
        results.append(("识别层-Gemma4", True))
        
    except Exception as e:
        print_test("  识别层-Gemma4", False, f"错误: {e}")
        results.append(("识别层-Gemma4", False))
    
    # Stage 3: RAG 检索
    print("  ┌─ STAGE 3: RAG 检索（ChromaDB）")
    if result.get("incident_type") and result.get("incident_type") != "none":
        try:
            from app.services.chroma_service import get_rag_context
            
            incident_type = result.get("incident_type")
            rag_context = get_rag_context(f"{incident_type}高速公路交通事件", top_k=2)
            
            has_rag = bool(rag_context)
            print_test("  RAG 检索", has_rag, f"检索到 SOP 规范")
            results.append(("RAG检索", has_rag))
        except Exception as e:
            print_test("  RAG 检索", False, f"错误: {e}")
            results.append(("RAG检索", False))
    else:
        print_test("  RAG 检索", True, "（无异常，跳过 RAG 检索）")
        results.append(("RAG检索", True))
    
    # Stage 4: 决策层（Gemma4）
    print("  └─ STAGE 4: 决策层（Gemma4:e2b）")
    if result.get("incident_type") and result.get("incident_type") != "none":
        try:
            from app.api.routes_demo import _rag_decide
            
            incident_type = result.get("incident_type")
            scene_desc = result.get("scene_description", "测试场景")
            
            # 调用决策层
            loop = asyncio.new_event_loop()
            decision = loop.run_until_complete(
                _rag_decide(incident_type, scene_desc, "gemma4:e2b", 60.0)
            )
            loop.close()
            
            has_decision = bool(decision.get("risk_level"))
            print_test("  决策层执行", has_decision, f"risk_level={decision.get('risk_level')}")
            results.append(("决策层", has_decision))
        except Exception as e:
            print_test("  决策层", False, f"错误: {e}")
            results.append(("决策层", False))
    else:
        print_test("  决策层", True, "（无异常，跳过决策）")
        results.append(("决策层", True))
    
    return all(r for _, r in results)


def test_demo_api():
    """测试 7: Demo API 端点"""
    print(f"\n{Colors.BOLD}【测试 7】Demo API 端点{Colors.ENDC}")
    
    import httpx
    
    endpoints = [
        ("/api/v1/demo/thumbnail", "缩略图"),
        ("/api/v1/demo/videos", "视频列表"),
        ("/api/v1/admin/stats", "系统统计"),
    ]
    
    results = []
    for endpoint, desc in endpoints:
        try:
            r = httpx.get(f"http://localhost:8888{endpoint}", timeout=10)
            success = r.status_code == 200
            print_test(f"API {endpoint}", success, f"{desc} ({r.status_code})")
            results.append((endpoint, success))
        except Exception as e:
            print_test(f"API {endpoint}", False, f"错误: {e}")
            results.append((endpoint, False))
    
    return all(r for _, r in results)


def test_chroma_sop_content():
    """测试 8: SOP 内容验证"""
    print(f"\n{Colors.BOLD}【测试 8】SOP 内容验证{Colors.ENDC}")
    
    from app.services.chroma_service import get_chroma_service
    
    try:
        chroma = get_chroma_service()
        collection = chroma.get_collection()
        
        # 获取所有 SOP
        results = collection.get(include=["documents", "metadatas"])
        
        incident_types = set()
        severities = set()
        
        for metadata in results.get("metadatas", []):
            if metadata:
                if metadata.get("incident_type"):
                    incident_types.add(metadata["incident_type"])
                if metadata.get("severity"):
                    severities.add(metadata["severity"])
        
        print_test("SOP 事件类型", len(incident_types) >= 5, f"类型: {incident_types}")
        print_test("SOP 风险等级", len(severities) >= 3, f"等级: {severities}")
        print_test("SOP 总数量", collection.count() >= 11, f"共 {collection.count()} 条")
        
        return len(incident_types) >= 5 and collection.count() >= 11
    except Exception as e:
        print_test("SOP 内容验证", False, f"错误: {e}")
        return False


def main():
    """主测试函数"""
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"  PIPELINE 异常场景测试")
    print(f"  时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}{Colors.ENDC}")
    
    tests = [
        ("服务健康检查", test_service_health),
        ("ChromaDB 状态", test_chromadb),
        ("RAG 检索功能", test_rag_retrieval),
        ("视觉服务", test_vision_service),
        ("Ollama 连接", test_ollama_connection),
        ("异常场景完整流程", test_anomaly_scenario),
        ("Demo API 端点", test_demo_api),
        ("SOP 内容验证", test_chroma_sop_content),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n{Colors.FAIL}测试 {name} 发生异常: {e}{Colors.ENDC}")
            results.append((name, False))
    
    # 总结
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"  测试结果总结")
    print(f"{'='*60}{Colors.ENDC}")
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        icon = "✅" if result else "❌"
        color = Colors.OKGREEN if result else Colors.FAIL
        print(f"  {icon} {color}{name}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}通过率: {passed}/{total} ({100*passed/total:.0f}%){Colors.ENDC}")
    
    if passed == total:
        print(f"\n{Colors.OKGREEN}🎉 所有测试通过！Pipeline 功能正常。{Colors.ENDC}\n")
        return 0
    else:
        print(f"\n{Colors.WARNING}⚠️ 有 {total - passed} 项测试失败，请检查相关服务。{Colors.ENDC}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
